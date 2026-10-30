import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
export const tempPassword = () => randomBytes(9).toString("base64url") + "7a";
export async function userWithRole(id: string) {
  const [u] = await db.select({ u: t.users, roleKey: t.roles.key }).from(t.users).innerJoin(t.roles, eq(t.roles.id, t.users.roleId)).where(eq(t.users.id, id));
  return u;
}
export async function roleKey(roleId: string) { const [r] = await db.select({ key: t.roles.key }).from(t.roles).where(eq(t.roles.id, roleId)); return r?.key; }
