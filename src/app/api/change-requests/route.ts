import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export const GET = api(["cr.create", "cr.manage", "cr.approve"], async (ctx) => {
  const seeAll = ctx.can("cr.manage") || ctx.can("cr.approve");
  const rows = await db.query.changeRequests.findMany({
    where: seeAll ? undefined : eq(t.changeRequests.requestedById, ctx.user.id),
    with: {
      requestedBy: { columns: { id: true, name: true, email: true } },
      assignedTo: { columns: { id: true, name: true, email: true } },
    },
    orderBy: desc(t.changeRequests.createdAt),
  });

  return { changeRequests: rows };
});

export const POST = api(["cr.create"], async (ctx) => {
  const b = await ctx.json(z.object({ title: z.string().trim().min(3).max(200), description: z.string().trim().min(5).max(8000), businessReason: z.string().max(4000).nullable().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), category: z.enum(["CONFIGURATION", "DATA", "DEVELOPMENT", "SECURITY", "INFRASTRUCTURE"]) }));
  const { rows } = await db.execute<{ n: string }>(sql`select nextval('change_request_seq') as n`);
  const code = `CR-${String(rows[0].n).padStart(4, "0")}`;
  const approvalRequired = ["SECURITY", "INFRASTRUCTURE"].includes(b.category) || /permission|role|access|super admin|delete|backup/i.test(`${b.title} ${b.description}`);
  const [cr] = await db.insert(t.changeRequests).values({ ...b, code, requestedById: ctx.user.id, approvalRequired, approvalStatus: approvalRequired ? "PENDING" : "NOT_REQUIRED",
    history: [{ at: new Date().toISOString(), by: ctx.user.name, action: "Requested" }] }).returning();
  const { rows: techs } = await db.execute<{ id: string }>(sql`select u.id from users u join roles r on r.id = u.role_id where u.active and 'cr.manage' = any(r.permissions) and u.id <> ${ctx.user.id}`);
  await notify(techs.map((x) => x.id), { type: "CHANGE_REQUEST", title: `${code}: ${b.title}`, body: `${b.category} · ${b.priority}`, link: `/change-requests/${cr.id}` });
  await audit(ctx, "create", "change_request", cr.id, null, { code, ...b, approvalRequired });
  return { id: cr.id };
});
