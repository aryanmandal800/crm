import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { userWithRole } from "@/lib/users";
export const POST = api(["grants.manage"], async (ctx) => {
  const b = await ctx.json(z.object({ userId: z.string().uuid(), hours: z.number().int().min(1).max(72), scope: z.enum(["READ", "READ_EXPORT"]), reason: z.string().trim().min(10).max(1000) }));
  const u = await userWithRole(b.userId); if (!u) throw bad("Unknown user");
  if (u.roleKey === "SUPER_ADMIN") throw bad("Super Admins already have full access");
  const [g] = await db.insert(t.dataAccessGrants).values({ userId: b.userId, grantedById: ctx.user.id, scope: b.scope, reason: b.reason, expiresAt: new Date(Date.now() + b.hours * 3600e3) }).returning();
  await audit(ctx, "grant_data_access", "grant", g.id, null, b);
  await notify([b.userId], { type: "GRANT", title: `Read-only business data access granted for ${b.hours}h`, body: b.reason });
  return { id: g.id, message: "Access granted" };
});
