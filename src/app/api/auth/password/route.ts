import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { hashPassword, issueSession, passwordProblem, verifyPassword } from "@/lib/auth";
import { bad } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = api(null, async (ctx) => {
  const b = await ctx.json(z.object({ current: z.string(), next: z.string().max(200) }));
  const [u] = await db.select().from(t.users).where(eq(t.users.id, ctx.user.id));
  if (!(await verifyPassword(b.current, u.passwordHash))) throw bad("Current password is incorrect");
  const p = passwordProblem(b.next); if (p) throw bad(p);
  if (b.current === b.next) throw bad("New password must differ from the current one");
  const tv = u.tokenVersion + 1;
  await db.update(t.users).set({ passwordHash: await hashPassword(b.next), mustChangePassword: false, tokenVersion: tv }).where(eq(t.users.id, u.id));
  await issueSession(u.id, tv); // other sessions are revoked
  await audit(ctx, "password_changed", "auth", u.id);
  return { ok: true, message: "Password updated" };
});
