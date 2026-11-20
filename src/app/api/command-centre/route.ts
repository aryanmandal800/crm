import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { activityKpis, dealLists, hotAtRisk, leadKpis, pipelineKpis, talukaCoverage, todayBySalesperson, tomorrowActions } from "@/lib/metrics";
import { addDays, startOfDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export const GET = api(["dashboard.founder"], async () => {
  const today = startOfDay();
  const weekAgo = addDays(today, -6);

  const [lk, pk, actToday, actWeek, people, lists, risk, talukas, actions, dmToday, demos, quotesList, approvals] = await Promise.all([
    leadKpis(null),
    pipelineKpis(null),
    activityKpis(null, today),
    activityKpis(null, weekAgo),
    todayBySalesperson(null),
    dealLists(null),
    hotAtRisk(null),
    talukaCoverage(null),
    tomorrowActions(null),
    db.select({ a: t.activities, inst: t.institutions.legalName, contact: t.contacts.name, by: t.users.name })
      .from(t.activities)
      .innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
      .leftJoin(t.contacts, eq(t.contacts.id, t.activities.contactId))
      .innerJoin(t.users, eq(t.users.id, t.activities.userId))
      .where(sql`${t.activities.decisionMakerReached} and ${t.activities.occurredAt} >= ${weekAgo.toISOString()}`)
      .orderBy(desc(t.activities.occurredAt))
      .limit(15),
    db.select({ a: t.activities, inst: t.institutions.legalName, by: t.users.name })
      .from(t.activities)
      .innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
      .innerJoin(t.users, eq(t.users.id, t.activities.userId))
      .where(sql`${t.activities.typeKey} = 'DEMO' and ${t.activities.status} = 'PLANNED'`)
      .orderBy(t.activities.occurredAt)
      .limit(15),
    db.select({ q: t.quotes, inst: t.institutions.legalName })
      .from(t.quotes)
      .innerJoin(t.institutions, eq(t.institutions.id, t.quotes.institutionId))
      .where(inArray(t.quotes.status, ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"]))
      .orderBy(desc(t.quotes.createdAt))
      .limit(15),
    db.select({ n: sql<number>`count(*)::int` }).from(t.approvalRequests).where(eq(t.approvalRequests.status, "PENDING")),
  ]);

  return {
    leadKpis: lk,
    pipelineKpis: pk,
    actToday,
    actWeek,
    people,
    lists,
    risk,
    talukas,
    actions,
    dmToday,
    demos,
    quotes: quotesList,
    pendingApprovals: approvals[0]?.n ?? 0,
  };
});
