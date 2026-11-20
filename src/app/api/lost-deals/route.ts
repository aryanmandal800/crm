import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { activityScope, dealScope } from "@/lib/access";

export const dynamic = "force-dynamic";

export const GET = api(["deal.view"], async (ctx) => {
  const [byReason, byComp, deals, objections] = await Promise.all([
    db
      .select({
        key: t.lostReasons.key,
        name: t.lostReasons.name,
        n: sql<number>`count(${t.deals.id})::int`,
        mrr: sql<number>`coalesce(sum(${t.deals.mrr}),0)::float`,
      })
      .from(t.lostReasons)
      .leftJoin(t.deals, and(eq(t.deals.lostReasonId, t.lostReasons.id), dealScope(ctx)))
      .groupBy(t.lostReasons.key, t.lostReasons.name)
      .orderBy(desc(sql`count(${t.deals.id})`)),

    db
      .select({ name: t.competitors.name, n: sql<number>`count(*)::int` })
      .from(t.deals)
      .innerJoin(t.competitors, eq(t.competitors.id, t.deals.competitorId))
      .where(and(isNotNull(t.deals.lostAt), dealScope(ctx)))
      .groupBy(t.competitors.name),

    db
      .select({
        id: t.deals.id,
        title: t.deals.title,
        mrr: t.deals.mrr,
        lostAt: t.deals.lostAt,
        lostNotes: t.deals.lostNotes,
        institution: t.institutions.legalName,
        institutionId: t.institutions.id,
        reason: t.lostReasons.name,
      })
      .from(t.deals)
      .innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId))
      .leftJoin(t.lostReasons, eq(t.lostReasons.id, t.deals.lostReasonId))
      .where(and(isNotNull(t.deals.lostAt), dealScope(ctx)))
      .orderBy(desc(t.deals.lostAt))
      .limit(100),

    db
      .select({ o: t.activities.objection, n: sql<number>`count(*)::int` })
      .from(t.activities)
      .where(and(isNotNull(t.activities.objection), activityScope(ctx)))
      .groupBy(t.activities.objection)
      .orderBy(desc(sql`count(*)`))
      .limit(15),
  ]);

  return {
    byReason,
    byCompetitor: byComp,
    deals,
    objections,
  };
});
