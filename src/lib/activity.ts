import { db, t } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

export type LogActivityParams = {
  sessionId?: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  roleKey: string;
  activityType: string; // PAGE_VIEW | ACTION | API_CALL | LOGIN | LOGOUT | FORM_SUBMIT | EXPORT | TASK | DEAL | LEAD
  title: string;
  route?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  location?: string | null;
};

/**
 * Log a user action or navigation event.
 * Also touches active userSession to keep duration and last_active_at live.
 */
export async function logActivity(params: LogActivityParams) {
  try {
    const {
      sessionId,
      userId,
      userName,
      userEmail,
      roleKey,
      activityType,
      title,
      route,
      entityType,
      entityId,
      details,
      ip,
      location,
    } = params;

    // 1. Insert into user_activity_logs
    await db.insert(t.userActivityLogs).values({
      sessionId: sessionId || null,
      userId,
      userName,
      userEmail,
      roleKey,
      activityType,
      title,
      route: route || null,
      entityType: entityType || null,
      entityId: entityId || null,
      details: details || {},
      ip: ip || null,
      location: location || null,
      createdAt: new Date(),
    });

    // 2. Touch the session if sessionId is provided or find user's latest active session
    let sid = sessionId;
    if (!sid) {
      const active = await db.query.userSessions.findFirst({
        where: and(eq(t.userSessions.userId, userId), eq(t.userSessions.status, "ACTIVE")),
        orderBy: [desc(t.userSessions.loginAt)],
      });
      if (active) sid = active.id;
    }

    if (sid) {
      const now = new Date();
      await db.execute(sql`
        UPDATE user_sessions
        SET last_active_at = ${now},
            duration_seconds = GREATEST(duration_seconds, EXTRACT(EPOCH FROM (${now} - login_at))::int),
            updated_at = ${now}
        WHERE id = ${sid}::uuid
      `);
    }
  } catch (err) {
    console.error("Failed to log user activity:", err);
  }
}

/**
 * Marks session as LOGGED_OUT and records final duration and logout timestamp.
 */
export async function closeSession(sessionId?: string | null, userId?: string | null, ip?: string | null) {
  try {
    const now = new Date();
    let session = null;

    if (sessionId) {
      session = await db.query.userSessions.findFirst({
        where: eq(t.userSessions.id, sessionId),
      });
    }

    if (!session && userId) {
      session = await db.query.userSessions.findFirst({
        where: and(eq(t.userSessions.userId, userId), eq(t.userSessions.status, "ACTIVE")),
        orderBy: [desc(t.userSessions.loginAt)],
      });
    }

    if (!session) return;

    const durationSeconds = Math.max(0, Math.floor((now.getTime() - new Date(session.loginAt).getTime()) / 1000));

    await db.update(t.userSessions).set({
      logoutAt: now,
      lastActiveAt: now,
      durationSeconds,
      status: "LOGGED_OUT",
      updatedAt: now,
    }).where(eq(t.userSessions.id, session.id));

    // Get user details for activity log
    const u = await db.query.users.findFirst({
      where: eq(t.users.id, session.userId),
      with: { role: true },
    });

    if (u) {
      const minutes = Math.floor(durationSeconds / 60);
      const hours = Math.floor(minutes / 60);
      const remMins = minutes % 60;
      const durStr = hours > 0 ? `${hours} hr ${remMins} min` : `${minutes} min`;

      await logActivity({
        sessionId: session.id,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        roleKey: u.role.key,
        activityType: "LOGOUT",
        title: `Logged out (Session active for ${durStr})`,
        route: "/api/auth/logout",
        ip: ip || session.ip,
        location: session.address,
        details: {
          durationSeconds,
          durationFormatted: durStr,
          loginAt: session.loginAt,
          logoutAt: now,
        },
      });
    }
  } catch (err) {
    console.error("Failed to close user session:", err);
  }
}

/**
 * Updates session active timestamp and duration on client heartbeat.
 */
export async function touchSession(sessionId?: string | null, userId?: string | null, currentRoute?: string | null) {
  try {
    const now = new Date();
    let sid = sessionId;

    if (!sid && userId) {
      const active = await db.query.userSessions.findFirst({
        where: and(eq(t.userSessions.userId, userId), eq(t.userSessions.status, "ACTIVE")),
        orderBy: [desc(t.userSessions.loginAt)],
      });
      if (active) sid = active.id;
    }

    if (!sid) return;

    await db.execute(sql`
      UPDATE user_sessions
      SET last_active_at = ${now},
          duration_seconds = GREATEST(duration_seconds, EXTRACT(EPOCH FROM (${now} - login_at))::int),
          status = 'ACTIVE',
          updated_at = ${now}
      WHERE id = ${sid}::uuid
    `);
  } catch (err) {
    console.error("Failed to touch session:", err);
  }
}
