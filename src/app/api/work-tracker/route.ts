import { and, desc, asc, eq, gte, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Helper to determine department access
function getDepartmentScope(ctx: any): { isCeo: boolean; enforcedDept: "BDM" | "TECH" | null } {
  const isCeo = Boolean(ctx.user?.isFounder || ctx.role?.key === "SUPER_ADMIN" || ctx.can?.("dashboard.founder"));
  if (isCeo) return { isCeo: true, enforcedDept: null };
  if (ctx.role?.key === "TECH_ADMIN" || String(ctx.role?.key).includes("TECH")) {
    return { isCeo: false, enforcedDept: "TECH" };
  }
  return { isCeo: false, enforcedDept: "BDM" };
}

export const GET = api(null, async (ctx, req) => {
  const url = req.nextUrl;
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDate = url.searchParams.get("date") || todayStr;
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const reqDept = url.searchParams.get("department") || "ALL"; // ALL | BDM | TECH
  const userId = url.searchParams.get("userId"); // specific user or 'all' or empty
  const view = url.searchParams.get("view") || "day";

  // Enforce role-based department isolation:
  // - Tech users can ONLY see TECH
  // - BDM users can ONLY see BDM
  // - CEO can see ALL, BDM, or TECH
  const { isCeo, enforcedDept } = getDepartmentScope(ctx);
  const department = enforcedDept ? enforcedDept : reqDept;

  // Build filters
  const conditions = [];

  // User filter
  if (userId && userId !== "all") {
    conditions.push(or(eq(t.tasks.assigneeId, userId), eq(t.tasks.createdById, userId)));
  }

  // Department filter
  if (department && department !== "ALL") {
    conditions.push(eq(t.tasks.department, department));
  }

  // Date filter
  if (startDate && endDate) {
    conditions.push(
      or(
        and(gte(t.tasks.scheduledDate, startDate), lte(t.tasks.scheduledDate, endDate)),
        and(
          sql`${t.tasks.scheduledDate} IS NULL`,
          or(
            and(gte(t.tasks.dueAt, new Date(startDate)), lte(t.tasks.dueAt, new Date(endDate + "T23:59:59.999Z"))),
            and(gte(t.tasks.createdAt, new Date(startDate)), lte(t.tasks.createdAt, new Date(endDate + "T23:59:59.999Z")))
          )
        )
      )
    );
  } else {
    // Single date filter
    conditions.push(
      or(
        eq(t.tasks.scheduledDate, targetDate),
        and(sql`${t.tasks.scheduledDate} IS NULL`, sql`to_char(${t.tasks.dueAt}, 'YYYY-MM-DD') = ${targetDate}`),
        and(sql`${t.tasks.scheduledDate} IS NULL AND ${t.tasks.dueAt} IS NULL`, sql`to_char(${t.tasks.createdAt}, 'YYYY-MM-DD') = ${targetDate}`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rawTasks = await db.query.tasks.findMany({
    where: whereClause,
    with: {
      assignee: {
        columns: { id: true, name: true, email: true },
      },
      creator: {
        columns: { id: true, name: true, email: true },
      },
      institution: {
        columns: { id: true, legalName: true, leadCode: true },
      },
      activityLogs: {
        with: {
          user: { columns: { id: true, name: true, email: true } },
        },
        orderBy: desc(t.taskActivityLogs.createdAt),
      },
    },
    orderBy: [asc(t.tasks.priority), desc(t.tasks.createdAt)],
  });

  // Calculate statistics
  const total = rawTasks.length;
  const completed = rawTasks.filter((x) => x.status === "DONE").length;
  const inProgress = rawTasks.filter((x) => x.status === "IN_PROGRESS").length;
  const blocked = rawTasks.filter((x) => x.status === "BLOCKED").length;
  const pending = rawTasks.filter((x) => x.status === "OPEN" || x.status === "TODO").length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Breakdown by department (only compute if CEO or specific department)
  const bdmTasks = rawTasks.filter((x) => x.department === "BDM");
  const techTasks = rawTasks.filter((x) => x.department === "TECH");

  const bdmTotal = bdmTasks.length;
  const bdmCompleted = bdmTasks.filter((x) => x.status === "DONE").length;
  const bdmPercentage = bdmTotal > 0 ? Math.round((bdmCompleted / bdmTotal) * 100) : 0;

  const techTotal = techTasks.length;
  const techCompleted = techTasks.filter((x) => x.status === "DONE").length;
  const techPercentage = techTotal > 0 ? Math.round((techCompleted / techTotal) * 100) : 0;

  // Day-wise stats for week and month view
  const dayStats: Record<string, { total: number; completed: number; pending: number; inProgress: number; blocked: number; percentage: number }> = {};
  for (const item of rawTasks) {
    const dayKey = item.scheduledDate || (item.dueAt ? item.dueAt.toISOString().slice(0, 10) : item.createdAt.toISOString().slice(0, 10));
    if (!dayStats[dayKey]) {
      dayStats[dayKey] = { total: 0, completed: 0, pending: 0, inProgress: 0, blocked: 0, percentage: 0 };
    }
    dayStats[dayKey].total += 1;
    if (item.status === "DONE") dayStats[dayKey].completed += 1;
    else if (item.status === "IN_PROGRESS") dayStats[dayKey].inProgress += 1;
    else if (item.status === "BLOCKED") dayStats[dayKey].blocked += 1;
    else dayStats[dayKey].pending += 1;
    dayStats[dayKey].percentage = Math.round((dayStats[dayKey].completed / dayStats[dayKey].total) * 100);
  }

  // Fetch EOD reports with role department isolation
  const eodConditions = [];
  if (startDate && endDate) {
    eodConditions.push(and(gte(t.dailyEodReports.reportDate, startDate), lte(t.dailyEodReports.reportDate, endDate)));
  } else {
    eodConditions.push(eq(t.dailyEodReports.reportDate, targetDate));
  }
  if (enforcedDept) {
    eodConditions.push(eq(t.dailyEodReports.department, enforcedDept));
  } else if (department && department !== "ALL") {
    eodConditions.push(eq(t.dailyEodReports.department, department));
  }

  const eodReports = await db.query.dailyEodReports.findMany({
    where: and(...eodConditions),
    with: {
      user: { columns: { id: true, name: true, email: true } },
    },
    orderBy: desc(t.dailyEodReports.submittedAt),
  });

  // Recent activity logs across the selected tasks
  const allLogs = rawTasks
    .flatMap((t) => (t.activityLogs || []).map((l) => ({ ...l, taskTitle: t.title, taskDepartment: t.department })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);

  return {
    date: targetDate,
    isCeo,
    enforcedDept,
    stats: {
      total,
      completed,
      pending,
      inProgress,
      blocked,
      percentage,
      bdm: isCeo || enforcedDept === "BDM" ? { total: bdmTotal, completed: bdmCompleted, percentage: bdmPercentage } : null,
      tech: isCeo || enforcedDept === "TECH" ? { total: techTotal, completed: techCompleted, percentage: techPercentage } : null,
    },
    dayStats,
    tasks: rawTasks,
    eodReports,
    logs: allLogs,
  };
});

export const POST = api(null, async (ctx) => {
  assertWritable(ctx);
  const { isCeo, enforcedDept } = getDepartmentScope(ctx);

  const body = await ctx.json(
    z.object({
      title: z.string().trim().min(2).max(300),
      description: z.string().max(4000).nullable().optional(),
      department: z.enum(["BDM", "TECH", "GENERAL"]).default("GENERAL"),
      category: z.string().max(100).nullable().optional(),
      scheduledDate: z.string().regex(dateRegex).default(() => new Date().toISOString().slice(0, 10)),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"]).default("OPEN"),
      estimatedMinutes: z.number().int().min(0).max(1440).nullable().optional(),
      timeSpentMinutes: z.number().int().min(0).max(1440).nullable().optional(),
      assigneeId: z.string().uuid().nullable().optional(),
      institutionId: z.string().uuid().nullable().optional(),
      dealId: z.string().uuid().nullable().optional(),
    })
  );

  // If not CEO, department is strictly enforced to user's department
  const taskDept = enforcedDept ? enforcedDept : body.department;
  const assigneeId = body.assigneeId || ctx.user.id;
  const now = new Date();
  const completedAt = body.status === "DONE" ? now : null;
  const startedAt = body.status === "IN_PROGRESS" ? now : null;

  const [createdTask] = await db
    .insert(t.tasks)
    .values({
      title: body.title,
      description: body.description ?? null,
      department: taskDept,
      category: body.category ?? null,
      scheduledDate: body.scheduledDate,
      priority: body.priority,
      status: body.status,
      estimatedMinutes: body.estimatedMinutes ?? null,
      timeSpentMinutes: body.timeSpentMinutes ?? null,
      assigneeId,
      createdById: ctx.user.id,
      institutionId: body.institutionId ?? null,
      dealId: body.dealId ?? null,
      startedAt,
      completedAt,
    })
    .returning();

  // Record audit activity log with exact date and time
  await db.insert(t.taskActivityLogs).values({
    taskId: createdTask.id,
    userId: ctx.user.id,
    action: "CREATED",
    fromStatus: null,
    toStatus: body.status,
    note: `Task created for ${body.scheduledDate} (${taskDept})`,
  });

  return { id: createdTask.id, task: createdTask };
});
