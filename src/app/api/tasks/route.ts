import { and, asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { parseIndianDate } from "@/lib/format";

export const GET = api(null, async (ctx, req) => {
  const sp = req.nextUrl.searchParams;
  const showAll = sp.get("all") === "1" && ctx.can("dashboard.founder");
  const status = sp.get("status");

  const whereClause = and(
    status ? eq(t.tasks.status, status as any) : eq(t.tasks.status, "OPEN"),
    showAll ? undefined : or(eq(t.tasks.assigneeId, ctx.user.id), eq(t.tasks.createdById, ctx.user.id))
  );

  const rows = await db.query.tasks.findMany({
    where: whereClause,
    with: {
      assignee: { columns: { id: true, name: true, email: true } },
      creator: { columns: { id: true, name: true, email: true } },
      institution: { columns: { id: true, legalName: true, leadCode: true } },
    },
    orderBy: asc(t.tasks.dueAt),
  });

  return { tasks: rows };
});

const d = z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? parseIndianDate(v) : new Date(v as any)), z.date().nullable()).optional();
export const POST = api(null, async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(z.object({ title: z.string().trim().min(3).max(300), description: z.string().max(4000).nullable().optional(), assigneeId: z.string().uuid().nullable().optional(),
    institutionId: z.string().uuid().nullable().optional(), dueAt: d, priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM") }));
  const assigneeId = b.assigneeId ?? ctx.user.id;
  if (assigneeId !== ctx.user.id && !ctx.can("tasks.manage")) throw forbidden("You can only create tasks for yourself");
  if (assigneeId !== ctx.user.id && ctx.scope !== "ALL" && !ctx.teamUserIds.includes(assigneeId)) throw forbidden("Outside your team");
  if (b.institutionId) await getInstitutionOr404(ctx, b.institutionId);
  const [x] = await db.insert(t.tasks).values({ ...b, assigneeId, createdById: ctx.user.id } as any).returning();
  if (assigneeId !== ctx.user.id) await notify([assigneeId], { type: "TASK", title: `New task: ${b.title}`, link: "/tasks" });
  await audit(ctx, "create", "task", x.id, null, { title: x.title, assigneeId }); return { id: x.id };
});
