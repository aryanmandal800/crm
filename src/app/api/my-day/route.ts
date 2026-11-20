import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { addDays, startOfDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export const GET = api(["activity.create"], async (ctx) => {
  const me = ctx.user.id;
  const today = startOfDay();
  const tomorrow = addDays(today, 1);

  const [due, todayActs, planned, hot, tasks] = await Promise.all([
    db.select({
      id: t.deals.id,
      title: t.deals.title,
      nextAction: t.deals.nextAction,
      followUpDate: t.deals.followUpDate,
      institution: t.institutions.legalName,
      institutionId: t.institutions.id,
      mrr: t.deals.mrr,
    })
      .from(t.deals)
      .innerJoin(t.pipelineStages, eq(t.pipelineStages.id, t.deals.stageId))
      .innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId))
      .where(and(eq(t.deals.ownerId, me), eq(t.pipelineStages.isOpen, true), lt(t.deals.followUpDate, tomorrow)))
      .orderBy(asc(t.deals.followUpDate)),

    db.select({
      total: sql<number>`count(*)::int`,
      calls: sql<number>`count(*) filter (where ${t.activities.typeKey} = 'CALL')::int`,
      dmReached: sql<number>`count(*) filter (where ${t.activities.decisionMakerReached})::int`,
      demos: sql<number>`count(*) filter (where ${t.activities.typeKey} = 'DEMO')::int`,
      meetings: sql<number>`count(*) filter (where ${t.activities.typeKey} = 'MEETING')::int`,
    })
      .from(t.activities)
      .where(and(eq(t.activities.userId, me), eq(t.activities.status, "DONE"), gte(t.activities.occurredAt, today))),

    db.select({
      id: t.activities.id,
      typeKey: t.activities.typeKey,
      occurredAt: t.activities.occurredAt,
      status: t.activities.status,
      institutionId: t.activities.institutionId,
      institution: t.institutions.legalName,
      notes: t.activities.notes,
    })
      .from(t.activities)
      .innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
      .where(and(eq(t.activities.userId, me), eq(t.activities.status, "PLANNED")))
      .orderBy(asc(t.activities.occurredAt))
      .limit(20),

    db.select({
      id: t.institutions.id,
      name: t.institutions.legalName,
      leadCode: t.institutions.leadCode,
      band: t.institutions.scoreBand,
      score: t.institutions.score,
      city: t.institutions.city,
    })
      .from(t.institutions)
      .where(
        and(
          eq(t.institutions.ownerId, me),
          sql`${t.institutions.deletedAt} is null`,
          sql`${t.institutions.scoreBand} in ('HOT','WARM')`,
          sql`not exists (select 1 from activities a where a.institution_id = ${t.institutions.id} and a.occurred_at > now() - interval '14 days')`
        )
      )
      .orderBy(desc(t.institutions.score))
      .limit(10),

    db.select()
      .from(t.tasks)
      .where(and(eq(t.tasks.assigneeId, me), eq(t.tasks.status, "OPEN")))
      .orderBy(asc(t.tasks.dueAt))
      .limit(10),
  ]);

  return {
    due,
    todayStats: todayActs[0] || { total: 0, calls: 0, dmReached: 0, demos: 0, meetings: 0 },
    planned,
    hot,
    tasks,
  };
});
