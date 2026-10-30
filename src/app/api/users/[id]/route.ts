import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden, notFound } from "@/lib/errors";
import { roleKey, userWithRole } from "@/lib/users";

export const PATCH = api<{ id: string }>(["users.manage"], async (ctx, _r, { id }) => {
  const target = await userWithRole(id); if (!target) throw notFound();
  const b = await ctx.json(z.object({ name: z.string().trim().min(2).max(100).optional(), phone: z.string().max(20).nullable().optional(), roleId: z.string().uuid().optional(), teamId: z.string().uuid().nullable().optional(), active: z.boolean().optional() }));
  // Founder account protections — nobody else can touch it, and the Founder cannot lock themself out.
  if (target.u.isFounder) {
    if (!ctx.user.isFounder) throw forbidden("The Founder's account can only be changed by the Founder");
    if (b.active === false || (b.roleId && b.roleId !== target.u.roleId)) throw forbidden("The Founder's account cannot be disabled or demoted");
  }
  if (target.roleKey === "SUPER_ADMIN" && !ctx.user.isFounder) throw forbidden("Only the Founder can change Super Admin accounts");
  if (b.roleId && b.roleId !== target.u.roleId) {
    const rk = await roleKey(b.roleId); if (!rk) throw bad("Unknown role");
    if (rk === "SUPER_ADMIN" && !ctx.user.isFounder) throw forbidden("Only the Founder can grant Super Admin");
  }
  if (b.active === false && id === ctx.user.id) throw bad("You cannot disable your own account");
  const patch: Record<string, any> = { ...b };
  if (b.active === false || (b.roleId && b.roleId !== target.u.roleId)) patch.tokenVersion = sql`${t.users.tokenVersion} + 1`; // revoke sessions
  await db.update(t.users).set(patch).where(eq(t.users.id, id));
  await audit(ctx, "update", "user", id, { roleId: target.u.roleId, active: target.u.active, teamId: target.u.teamId }, b);
  return { id };
});
