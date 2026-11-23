import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { issueSession, verifyPassword } from "@/lib/auth";
import { getGeoLocation, parseUserAgent } from "@/lib/geo";
import { logActivity } from "@/lib/activity";

const MAX_FAILS = 5, LOCK_MIN = 15;
const DUMMY = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.Kq5aF5H7Q4nVQm2b1T6zRk3cFj5G";

export async function POST(req: NextRequest) {
  const body = z.object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
    clientAddress: z.string().optional(),
    clientLat: z.number().optional(),
    clientLon: z.number().optional(),
  }).safeParse(await req.json().catch(() => null));

  if (!body.success) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const email = body.data.email.toLowerCase().trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const uaStr = req.headers.get("user-agent") ?? null;

  const [u] = await db.select().from(t.users).where(sql`lower(${t.users.email}) = ${email}`);

  const fail = async (reason: string) => {
    await db.insert(t.auditLogs).values({
      actorName: email,
      action: "login_failed",
      entityType: "auth",
      entityId: u?.id ?? null,
      after: { reason },
      ip,
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  };

  if (!u) { await verifyPassword(body.data.password, DUMMY); return fail("unknown user"); }
  if (!u.active) return fail("disabled");
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    return NextResponse.json({
      error: `Account locked. Try again after ${u.lockedUntil.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })}.`
    }, { status: 429 });
  }

  if (!(await verifyPassword(body.data.password, u.passwordHash))) {
    const n = u.failedLogins + 1;
    await db.update(t.users).set({
      failedLogins: n >= MAX_FAILS ? 0 : n,
      lockedUntil: n >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null,
    }).where(eq(t.users.id, u.id));
    return fail(n >= MAX_FAILS ? "locked" : "bad password");
  }

  // Password verified! Resolve geolocation and user agent
  const geo = await getGeoLocation(ip);
  const ua = parseUserAgent(uaStr);

  const address = body.data.clientAddress || geo.address;
  const lat = body.data.clientLat ?? geo.latitude;
  const lon = body.data.clientLon ?? geo.longitude;

  // 1. Create a userSession record
  const [session] = await db.insert(t.userSessions).values({
    userId: u.id,
    tokenVersion: u.tokenVersion,
    loginAt: new Date(),
    lastActiveAt: new Date(),
    durationSeconds: 0,
    ip,
    city: geo.city,
    region: geo.region,
    country: geo.country,
    postalCode: geo.postalCode,
    isp: geo.isp,
    address,
    latitude: lat != null ? String(lat) : null,
    longitude: lon != null ? String(lon) : null,
    deviceType: ua.deviceType,
    browser: ua.browser,
    os: ua.os,
    userAgent: uaStr,
    status: "ACTIVE",
    metadata: {
      clientAddress: body.data.clientAddress ?? null,
      loginTimestamp: new Date().toISOString(),
    },
  }).returning();

  // 2. Update user state
  await db.update(t.users).set({
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  }).where(eq(t.users.id, u.id));

  // 3. Issue session token linked with session.id
  const jwt = await issueSession(u.id, u.tokenVersion, session.id);

  const userWithRole = await db.query.users.findFirst({
    where: eq(t.users.id, u.id),
    with: { role: true },
  });

  const roleKey = userWithRole?.role.key ?? "USER";

  // 4. Log in auditLogs
  await db.insert(t.auditLogs).values({
    actorId: u.id,
    actorName: u.name,
    actorRole: roleKey,
    action: "login",
    entityType: "auth",
    entityId: u.id,
    ip,
    after: {
      sessionId: session.id,
      address,
      city: geo.city,
      region: geo.region,
      isp: geo.isp,
      device: `${ua.browser} on ${ua.os} (${ua.deviceType})`,
    },
  });

  // 5. Log in userActivityLogs
  await logActivity({
    sessionId: session.id,
    userId: u.id,
    userName: u.name,
    userEmail: u.email,
    roleKey,
    activityType: "LOGIN",
    title: `Logged in from ${address} (${ua.browser} on ${ua.os})`,
    route: "/login",
    ip,
    location: address,
    details: {
      sessionId: session.id,
      address,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      postalCode: geo.postalCode,
      isp: geo.isp,
      deviceType: ua.deviceType,
      browser: ua.browser,
      os: ua.os,
    },
  });

  return NextResponse.json({
    ok: true,
    token: jwt,
    sessionId: session.id,
    mustChangePassword: u.mustChangePassword,
    user: userWithRole
      ? {
          id: userWithRole.id,
          name: userWithRole.name,
          email: userWithRole.email,
          teamId: userWithRole.teamId,
          isFounder: userWithRole.isFounder,
          role: userWithRole.role.key,
          roleName: userWithRole.role.name,
          permissions: userWithRole.role.permissions,
        }
      : null,
  });
}
