import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const GET = api(null, async (ctx, req) => {
  const url = req.nextUrl;
  const targetDate = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const targetUser = url.searchParams.get("userId") || ctx.user.id;

  // Single user report
  const report = await db.query.dailyEodReports.findFirst({
    where: and(eq(t.dailyEodReports.reportDate, targetDate), eq(t.dailyEodReports.userId, targetUser)),
    with: {
      user: { columns: { id: true, name: true, email: true } },
    },
  });

  // Recent team EOD reports
  const recentReports = await db.query.dailyEodReports.findMany({
    with: {
      user: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(t.dailyEodReports.reportDate), desc(t.dailyEodReports.submittedAt)],
    limit: 25,
  });

  return { report, recentReports };
});

export const POST = api(null, async (ctx) => {
  assertWritable(ctx);
  const body = await ctx.json(
    z.object({
      reportDate: z.string().regex(dateRegex),
      department: z.enum(["BDM", "TECH", "GENERAL"]).default("GENERAL"),
      summary: z.string().trim().min(3).max(4000),
      keyWins: z.string().max(4000).nullable().optional(),
      blockers: z.string().max(4000).nullable().optional(),
      planForTomorrow: z.string().max(4000).nullable().optional(),
      hoursSpent: z.number().min(0).max(24).default(8),
      status: z.enum(["DRAFT", "SUBMITTED"]).default("SUBMITTED"),
    })
  );

  // Auto-calculate stats from tasks for this date & user
  const userTasks = await db.query.tasks.findMany({
    where: and(
      eq(t.tasks.assigneeId, ctx.user.id),
      sql`coalesce(${t.tasks.scheduledDate}, to_char(${t.tasks.dueAt}, 'YYYY-MM-DD'), to_char(${t.tasks.createdAt}, 'YYYY-MM-DD')) = ${body.reportDate}`
    ),
  });

  const total = userTasks.length;
  const completed = userTasks.filter((x) => x.status === "DONE").length;
  const pending = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;

  const now = new Date();

  const [eod] = await db
    .insert(t.dailyEodReports)
    .values({
      userId: ctx.user.id,
      reportDate: body.reportDate,
      department: body.department,
      summary: body.summary,
      keyWins: body.keyWins ?? null,
      blockers: body.blockers ?? null,
      planForTomorrow: body.planForTomorrow ?? null,
      hoursSpent: body.hoursSpent,
      tasksCompletedCount: completed,
      tasksPendingCount: pending,
      completionRate,
      status: body.status,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [t.dailyEodReports.userId, t.dailyEodReports.reportDate],
      set: {
        department: body.department,
        summary: body.summary,
        keyWins: body.keyWins ?? null,
        blockers: body.blockers ?? null,
        planForTomorrow: body.planForTomorrow ?? null,
        hoursSpent: body.hoursSpent,
        tasksCompletedCount: completed,
        tasksPendingCount: pending,
        completionRate,
        status: body.status,
        submittedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return { ok: true, eod };
});

