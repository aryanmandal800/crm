import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { bad, forbidden } from "@/lib/errors";
import { roleKey, tempPassword } from "@/lib/users";

export const GET = api(["users.manage", "users.support"], async () => {
  const [rows, roles, teams] = await Promise.all([
    db
      .select({
        id: t.users.id,
        name: t.users.name,
        email: t.users.email,
        phone: t.users.phone,
        active: t.users.active,
        isFounder: t.users.isFounder,
        mustChangePassword: t.users.mustChangePassword,
        lockedUntil: t.users.lockedUntil,
        lastLoginAt: t.users.lastLoginAt,
        roleId: t.users.roleId,
        roleName: t.roles.name,
        roleKey: t.roles.key,
        teamId: t.users.teamId,
        teamName: t.teams.name,
        createdAt: t.users.createdAt,
      })
      .from(t.users)
      .innerJoin(t.roles, eq(t.roles.id, t.users.roleId))
      .leftJoin(t.teams, eq(t.teams.id, t.users.teamId))
      .orderBy(asc(t.users.name)),
    db.select().from(t.roles).orderBy(asc(t.roles.name)),
    db.select().from(t.teams).orderBy(asc(t.teams.name)),
  ]);

  return { users: rows, roles, teams };
});

export const POST = api(["users.manage"], async (ctx) => {
  const b = await ctx.json(z.object({ name: z.string().trim().min(2).max(100), email: z.string().email().max(200), phone: z.string().max(20).nullable().optional(), roleId: z.string().uuid(), teamId: z.string().uuid().nullable().optional() }));
  const rk = await roleKey(b.roleId); if (!rk) throw bad("Unknown role");
  if (rk === "SUPER_ADMIN" && !ctx.user.isFounder) throw forbidden("Only the Founder can create another Super Admin");
  const email = b.email.toLowerCase();
  const exists = await db.execute(sql`select 1 from users where lower(email) = ${email}`); if (exists.rows.length) throw bad("Email already in use");
  const pw = tempPassword();
  const [u] = await db.insert(t.users).values({ ...b, email, passwordHash: await hashPassword(pw), mustChangePassword: true }).returning();
  await audit(ctx, "create", "user", u.id, null, { name: u.name, email, role: rk });
  return { id: u.id, message: `User created. Temporary password (shown once): ${pw}` };
});
