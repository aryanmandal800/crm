import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import type { Permission } from "./permissions";

export const COOKIE = "fp_session";
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 12);

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function passwordProblem(p: string): string | null {
  if (p.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Password must contain letters and numbers";
  return null;
}

export async function issueSession(userId: string, tokenVersion: number) {
  const jwt = await new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`).sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600,
    secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
  });
}

export async function clearSession() { (await cookies()).delete(COOKIE); }

export type DataScope = "ALL" | "TEAM" | "OWN" | "NONE";

export type Ctx = {
  user: { id: string; name: string; email: string; teamId: string | null; isFounder: boolean; mustChangePassword: boolean };
  role: { key: string; name: string };
  perms: Set<string>;
  can: (p: Permission) => boolean;
  scope: DataScope;           // institution / deal visibility
  grant: { scope: string; expiresAt: Date } | null; // active break-glass grant (tech admin)
  teamUserIds: string[];       // for TEAM scope
  ip: string | null;
};

/** Loads and validates the session on every request (revocation, disabled accounts, role changes take effect immediately). */
export async function getCtx(): Promise<Ctx | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let sub: string, tv: number;
  try {
    const { payload } = await jwtVerify(token, secret());
    sub = payload.sub as string; tv = payload.tv as number;
  } catch { return null; }
  const row = await db.query.users.findFirst({ where: eq(t.users.id, sub), with: { role: true } });
  if (!row || !row.active || row.tokenVersion !== tv) return null;

  const perms = new Set<string>(row.role.permissions);
  let grant: Ctx["grant"] = null;
  if (!perms.has("lead.view.all") && !perms.has("lead.view.team") && !perms.has("lead.view.own")) {
    const g = await db.query.dataAccessGrants.findFirst({
      where: and(eq(t.dataAccessGrants.userId, row.id), isNull(t.dataAccessGrants.revokedAt), gt(t.dataAccessGrants.expiresAt, new Date())),
    });
    if (g) {
      grant = { scope: g.scope, expiresAt: g.expiresAt };
      // read-only business visibility for the grant window
      ["lead.view.all", "deal.view", "competitor.view", "onboarding.view", "reports.view.all", "performance.view.all", "pricing.view"].forEach((p) => perms.add(p));
      if (g.scope === "READ_EXPORT") perms.add("reports.export");
    }
  }
  const scope: DataScope = perms.has("lead.view.all") ? "ALL" : perms.has("lead.view.team") ? "TEAM" : perms.has("lead.view.own") ? "OWN" : "NONE";

  let teamUserIds: string[] = [row.id];
  if (scope === "TEAM") {
    const managed = await db.select({ id: t.teams.id }).from(t.teams).where(eq(t.teams.managerId, row.id));
    const teamIds = [...managed.map((m) => m.id), ...(row.teamId ? [row.teamId] : [])];
    if (teamIds.length) {
      const { inArray } = await import("drizzle-orm");
      const members = await db.select({ id: t.users.id }).from(t.users).where(inArray(t.users.teamId, teamIds));
      teamUserIds = [...new Set([row.id, ...members.map((m) => m.id)])];
    }
  }
  const h = await headers();
  return {
    user: { id: row.id, name: row.name, email: row.email, teamId: row.teamId, isFounder: row.isFounder, mustChangePassword: row.mustChangePassword },
    role: { key: row.role.key, name: row.role.name },
    perms, can: (p) => perms.has(p), scope, grant, teamUserIds,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
  };
}

/** Page guard: redirects to login / forbidden. */
export async function requirePage(...anyOf: Permission[]): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (ctx.user.mustChangePassword) redirect("/change-password");
  if (anyOf.length && !anyOf.some((p) => ctx.can(p))) redirect("/forbidden");
  return ctx;
}
