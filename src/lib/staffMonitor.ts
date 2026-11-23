import { sql } from "drizzle-orm";
import { db } from "@/db";
import { formatDuration } from "@/lib/geo";

export type StaffMonitorFilter = {
  role?: "ALL" | "TECH" | "BDM";
  userId?: string;
  sessionId?: string;
  range?: "today" | "yesterday" | "7days" | "30days" | "all";
  activityType?: string;
  status?: "ALL" | "ACTIVE" | "LOGGED_OUT";
  search?: string;
  limit?: number;
};

export async function getStaffMonitoringData(filters: StaffMonitorFilter = {}) {
  const {
    role = "ALL",
    userId,
    sessionId,
    range = "today",
    activityType = "ALL",
    status = "ALL",
    search,
    limit = 200,
  } = filters;

  // Build date filter
  let dateCondition = sql`true`;
  if (range === "today") {
    dateCondition = sql`s.login_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;
  } else if (range === "yesterday") {
    dateCondition = sql`s.login_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 day') AT TIME ZONE 'Asia/Kolkata'
      AND s.login_at < date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;
  } else if (range === "7days") {
    dateCondition = sql`s.login_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '7 days') AT TIME ZONE 'Asia/Kolkata'`;
  } else if (range === "30days") {
    dateCondition = sql`s.login_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '30 days') AT TIME ZONE 'Asia/Kolkata'`;
  }

  // 1. Fetch monitored users (Tech Admins & Sales BDMs)
  let roleUserCondition = sql`r.key IN ('TECH_ADMIN', 'BDM', 'SALES_MANAGER')`;
  if (role === "TECH") {
    roleUserCondition = sql`r.key = 'TECH_ADMIN'`;
  } else if (role === "BDM") {
    roleUserCondition = sql`r.key IN ('BDM', 'SALES_MANAGER')`;
  }

  const monitoredStaffRaw = (await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      r.key as role_key,
      r.name as role_name,
      t.name as team_name,
      u.last_login_at,
      -- active session check: logout_at is null AND last_active_at within 15 minutes
      EXISTS (
        SELECT 1 FROM user_sessions s
        WHERE s.user_id = u.id
          AND s.logout_at IS NULL
          AND s.last_active_at >= now() - interval '15 minutes'
      ) as is_online,
      -- latest active session
      (
        SELECT json_build_object(
          'id', s.id,
          'loginAt', s.login_at,
          'lastActiveAt', s.last_active_at,
          'durationSeconds', GREATEST(s.duration_seconds, EXTRACT(EPOCH FROM (now() - s.login_at))::int),
          'ip', s.ip,
          'address', s.address,
          'city', s.city,
          'isp', s.isp,
          'browser', s.browser,
          'os', s.os,
          'deviceType', s.device_type,
          'status', s.status
        )
        FROM user_sessions s
        WHERE s.user_id = u.id AND s.logout_at IS NULL
        ORDER BY s.login_at DESC
        LIMIT 1
      ) as current_session,
      -- today's total active duration in seconds
      COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN s.logout_at IS NULL AND s.last_active_at >= now() - interval '15 minutes'
                THEN GREATEST(s.duration_seconds, EXTRACT(EPOCH FROM (now() - s.login_at))::int)
              ELSE s.duration_seconds
            END
          )::int
          FROM user_sessions s
          WHERE s.user_id = u.id
            AND s.login_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
        ), 0
      ) as today_duration_seconds,
      -- today's session count
      (
        SELECT COUNT(*)::int
        FROM user_sessions s
        WHERE s.user_id = u.id
          AND s.login_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      ) as today_session_count,
      -- today's activity count
      (
        SELECT COUNT(*)::int
        FROM user_activity_logs a
        WHERE a.user_id = u.id
          AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      ) as today_activity_count,
      -- most recent activity
      (
        SELECT a.title
        FROM user_activity_logs a
        WHERE a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 1
      ) as last_action_title,
      (
        SELECT a.created_at
        FROM user_activity_logs a
        WHERE a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 1
      ) as last_action_at,
      (
        SELECT a.route
        FROM user_activity_logs a
        WHERE a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 1
      ) as last_action_route,
      -- most recent address
      (
        SELECT s.address
        FROM user_sessions s
        WHERE s.user_id = u.id AND s.address IS NOT NULL
        ORDER BY s.login_at DESC
        LIMIT 1
      ) as last_address,
      (
        SELECT s.ip
        FROM user_sessions s
        WHERE s.user_id = u.id AND s.ip IS NOT NULL
        ORDER BY s.login_at DESC
        LIMIT 1
      ) as last_ip
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.active AND ${roleUserCondition}
    ORDER BY is_online DESC, today_duration_seconds DESC, u.name ASC
  `)).rows as any[];

  const staff = monitoredStaffRaw.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    roleKey: m.role_key,
    roleName: m.role_name,
    teamName: m.team_name,
    lastLoginAt: m.last_login_at,
    isOnline: Boolean(m.is_online),
    currentSession: m.current_session,
    todayDurationSeconds: Number(m.today_duration_seconds ?? 0),
    todayDurationFormatted: formatDuration(Number(m.today_duration_seconds ?? 0)),
    todaySessionCount: Number(m.today_session_count ?? 0),
    todayActivityCount: Number(m.today_activity_count ?? 0),
    lastActionTitle: m.last_action_title,
    lastActionAt: m.last_action_at,
    lastActionRoute: m.last_action_route,
    lastAddress: m.last_address || "Pune, Maharashtra, India",
    lastIp: m.last_ip,
  }));

  // 2. Fetch Sessions
  let sessionConditions = sql`${dateCondition}`;
  if (userId) {
    sessionConditions = sql`${sessionConditions} AND s.user_id = ${userId}::uuid`;
  }
  if (role === "TECH") {
    sessionConditions = sql`${sessionConditions} AND r.key = 'TECH_ADMIN'`;
  } else if (role === "BDM") {
    sessionConditions = sql`${sessionConditions} AND r.key IN ('BDM', 'SALES_MANAGER')`;
  }
  if (status === "ACTIVE") {
    sessionConditions = sql`${sessionConditions} AND s.logout_at IS NULL AND s.last_active_at >= now() - interval '15 minutes'`;
  } else if (status === "LOGGED_OUT") {
    sessionConditions = sql`${sessionConditions} AND (s.logout_at IS NOT NULL OR s.last_active_at < now() - interval '15 minutes')`;
  }
  if (search) {
    sessionConditions = sql`${sessionConditions} AND (
      u.name ILIKE ${`%${search}%`} OR
      u.email ILIKE ${`%${search}%`} OR
      s.address ILIKE ${`%${search}%`} OR
      s.city ILIKE ${`%${search}%`} OR
      s.ip ILIKE ${`%${search}%`}
    )`;
  }

  const sessionsRaw = (await db.execute(sql`
    SELECT
      s.id,
      s.user_id,
      u.name as user_name,
      u.email as user_email,
      r.key as role_key,
      r.name as role_name,
      s.login_at,
      s.logout_at,
      s.last_active_at,
      CASE
        WHEN s.logout_at IS NULL AND s.last_active_at >= now() - interval '15 minutes'
          THEN GREATEST(s.duration_seconds, EXTRACT(EPOCH FROM (now() - s.login_at))::int)
        ELSE s.duration_seconds
      END as duration_seconds,
      s.ip,
      s.city,
      s.region,
      s.country,
      s.postal_code,
      s.isp,
      s.address,
      s.latitude,
      s.longitude,
      s.device_type,
      s.browser,
      s.os,
      s.user_agent,
      CASE
        WHEN s.logout_at IS NOT NULL THEN 'LOGGED_OUT'
        WHEN s.last_active_at < now() - interval '15 minutes' THEN 'TIMED_OUT'
        ELSE 'ACTIVE'
      END as status,
      (
        SELECT COUNT(*)::int FROM user_activity_logs a WHERE a.session_id = s.id
      ) as activity_count
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE ${sessionConditions}
    ORDER BY s.login_at DESC
    LIMIT ${limit}
  `)).rows as any[];

  const sessions = sessionsRaw.map((s) => ({
    id: s.id,
    userId: s.user_id,
    userName: s.user_name,
    userEmail: s.user_email,
    roleKey: s.role_key,
    roleName: s.role_name,
    loginAt: s.login_at,
    logoutAt: s.logout_at,
    lastActiveAt: s.last_active_at,
    durationSeconds: Number(s.duration_seconds ?? 0),
    durationFormatted: formatDuration(Number(s.duration_seconds ?? 0)),
    ip: s.ip,
    city: s.city,
    region: s.region,
    country: s.country,
    postalCode: s.postal_code,
    isp: s.isp,
    address: s.address || `${s.city || "Pune"}, ${s.region || "Maharashtra"}, ${s.country || "India"}`,
    latitude: s.latitude,
    longitude: s.longitude,
    deviceType: s.device_type || "Desktop",
    browser: s.browser || "Chrome",
    os: s.os || "macOS",
    userAgent: s.user_agent,
    status: s.status,
    activityCount: Number(s.activity_count ?? 0),
  }));

  // 3. Fetch Activities
  let activityDateCondition = sql`true`;
  if (range === "today") {
    activityDateCondition = sql`a.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;
  } else if (range === "yesterday") {
    activityDateCondition = sql`a.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 day') AT TIME ZONE 'Asia/Kolkata'
      AND a.created_at < date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;
  } else if (range === "7days") {
    activityDateCondition = sql`a.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '7 days') AT TIME ZONE 'Asia/Kolkata'`;
  } else if (range === "30days") {
    activityDateCondition = sql`a.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '30 days') AT TIME ZONE 'Asia/Kolkata'`;
  }

  let activityConditions = sql`${activityDateCondition}`;
  if (userId) {
    activityConditions = sql`${activityConditions} AND a.user_id = ${userId}::uuid`;
  }
  if (sessionId) {
    activityConditions = sql`${activityConditions} AND a.session_id = ${sessionId}::uuid`;
  }
  if (role === "TECH") {
    activityConditions = sql`${activityConditions} AND a.role_key = 'TECH_ADMIN'`;
  } else if (role === "BDM") {
    activityConditions = sql`${activityConditions} AND a.role_key IN ('BDM', 'SALES_MANAGER')`;
  }
  if (activityType !== "ALL") {
    activityConditions = sql`${activityConditions} AND a.activity_type = ${activityType}`;
  }
  if (search) {
    activityConditions = sql`${activityConditions} AND (
      a.user_name ILIKE ${`%${search}%`} OR
      a.title ILIKE ${`%${search}%`} OR
      a.route ILIKE ${`%${search}%`} OR
      a.location ILIKE ${`%${search}%`} OR
      a.ip ILIKE ${`%${search}%`}
    )`;
  }

  const activitiesRaw = (await db.execute(sql`
    SELECT
      a.id,
      a.session_id,
      a.user_id,
      a.user_name,
      a.user_email,
      a.role_key,
      a.activity_type,
      a.title,
      a.route,
      a.entity_type,
      a.entity_id,
      a.details,
      a.ip,
      a.location,
      a.created_at
    FROM user_activity_logs a
    WHERE ${activityConditions}
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `)).rows as any[];

  const activities = activitiesRaw.map((a) => ({
    id: Number(a.id),
    sessionId: a.session_id,
    userId: a.user_id,
    userName: a.user_name || "Staff Member",
    userEmail: a.user_email || "",
    roleKey: a.role_key || "USER",
    activityType: a.activity_type || "PAGE_VIEW",
    title: a.title || "User activity",
    route: a.route || null,
    entityType: a.entity_type || null,
    entityId: a.entity_id || null,
    details: a.details || null,
    ip: a.ip || null,
    location: a.location || null,
    createdAt: a.created_at,
  }));

  // 4. Compute Summary KPIs
  const totalMonitoredStaff = staff.length;
  const currentlyOnline = staff.filter((s) => s.isOnline).length;
  const totalSecondsToday = staff.reduce((acc, s) => acc + s.todayDurationSeconds, 0);
  const totalActionsToday = staff.reduce((acc, s) => acc + s.todayActivityCount, 0);

  return {
    staff,
    sessions,
    activities,
    summary: {
      totalMonitoredStaff,
      currentlyOnline,
      totalHoursTodayFormatted: formatDuration(totalSecondsToday),
      totalActionsToday,
      totalSessionsToday: staff.reduce((acc, s) => acc + s.todaySessionCount, 0),
    },
  };
}
