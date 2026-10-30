import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/errors";
import { tempPassword, userWithRole } from "@/lib/users";
/** Reset password + unlock. Support staff cannot touch admin accounts. */
export const POST = api<{ id: string }>(["users.manage", "users.support"], async (ctx, _r, { id }) => {
  const target = await userWithRole(id); if (!target) throw notFound();
  if (target.u.isFounder && !ctx.user.isFounder) throw forbidden("The Founder's account cannot be reset by anyone else");
  if (!ctx.can("users.manage") && ["SUPER_ADMIN", "TECH_ADMIN"].includes(target.roleKey)) throw forbidden("Support can only reset non-admin accounts");
  if (id === ctx.user.id) throw forbidden("Use Change password for your own account");
  const pw = tempPassword();
  await db.update(t.users).set({ passwordHash: await hashPassword(pw), mustChangePassword: true, failedLogins: 0, lockedUntil: null, tokenVersion: sql`${t.users.tokenVersion} + 1` }).where(eq(t.users.id, id));
  await audit(ctx, "password_reset", "user", id, null, { by: ctx.user.name });
  return { id, message: `Temporary password for ${target.u.name} (shown once): ${pw}` };
});
