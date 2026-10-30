import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { issueSession, verifyPassword } from "@/lib/auth";

const MAX_FAILS = 5, LOCK_MIN = 15;
const DUMMY = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.Kq5aF5H7Q4nVQm2b1T6zRk3cFj5G";

export async function POST(req: NextRequest) {
  const body = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  const email = body.data.email.toLowerCase().trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const [u] = await db.select().from(t.users).where(sql`lower(${t.users.email}) = ${email}`);
  const fail = async (reason: string) => {
    await db.insert(t.auditLogs).values({ actorName: email, action: "login_failed", entityType: "auth", entityId: u?.id ?? null, after: { reason }, ip });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  };
  if (!u) { await verifyPassword(body.data.password, DUMMY); return fail("unknown user"); }
  if (!u.active) return fail("disabled");
  if (u.lockedUntil && u.lockedUntil > new Date()) return NextResponse.json({ error: `Account locked. Try again after ${u.lockedUntil.toLocaleTimeString("en-IN")}.` }, { status: 429 });
  if (!(await verifyPassword(body.data.password, u.passwordHash))) {
    const n = u.failedLogins + 1;
    await db.update(t.users).set({ failedLogins: n >= MAX_FAILS ? 0 : n, lockedUntil: n >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null }).where(eq(t.users.id, u.id));
    return fail(n >= MAX_FAILS ? "locked" : "bad password");
  }
  await db.update(t.users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(t.users.id, u.id));
  await issueSession(u.id, u.tokenVersion);
  await db.insert(t.auditLogs).values({ actorId: u.id, actorName: u.name, action: "login", entityType: "auth", entityId: u.id, ip });
  return NextResponse.json({ ok: true, mustChangePassword: u.mustChangePassword });
}
