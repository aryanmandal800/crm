import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dt, dtt, inr, startOfDay, addDays } from "@/lib/format";
import { BandBadge, Card, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function MyDay() {
  const ctx = await requirePage("activity.create");
  const me = ctx.user.id; const today = startOfDay(); const tomorrow = addDays(today, 1);
  const [due, todayActs, planned, hot, tasks] = await Promise.all([
    db.select({ id: t.deals.id, title: t.deals.title, next: t.deals.nextAction, f: t.deals.followUpDate, inst: t.institutions.legalName, mrr: t.deals.mrr })
      .from(t.deals).innerJoin(t.pipelineStages, eq(t.pipelineStages.id, t.deals.stageId)).innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId))
      .where(and(eq(t.deals.ownerId, me), eq(t.pipelineStages.isOpen, true), lt(t.deals.followUpDate, tomorrow))).orderBy(asc(t.deals.followUpDate)),
    db.select({ n: sql<number>`count(*)::int`, calls: sql<number>`count(*) filter (where ${t.activities.typeKey} = 'CALL')::int`, dm: sql<number>`count(*) filter (where ${t.activities.decisionMakerReached})::int` })
      .from(t.activities).where(and(eq(t.activities.userId, me), eq(t.activities.status, "DONE"), gte(t.activities.occurredAt, today))),
    db.select({ a: t.activities, inst: t.institutions.legalName }).from(t.activities).innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
      .where(and(eq(t.activities.userId, me), eq(t.activities.status, "PLANNED"))).orderBy(asc(t.activities.occurredAt)).limit(20),
    db.select({ id: t.institutions.id, name: t.institutions.legalName, band: t.institutions.scoreBand, score: t.institutions.score })
      .from(t.institutions).where(and(eq(t.institutions.ownerId, me), sql`${t.institutions.deletedAt} is null`, sql`${t.institutions.scoreBand} in ('HOT','WARM')`,
        sql`not exists (select 1 from activities a where a.institution_id = ${t.institutions.id} and a.occurred_at > now() - interval '14 days')`)).orderBy(desc(t.institutions.score)).limit(10),
    db.select().from(t.tasks).where(and(eq(t.tasks.assigneeId, me), eq(t.tasks.status, "OPEN"))).orderBy(asc(t.tasks.dueAt)).limit(10),
  ]);
  return (<>
    <PageHeader title={`Good day, ${ctx.user.name.split(" ")[0]}`} sub={today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} />
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Follow-ups due / overdue" value={due.length} tone={due.length ? "warm" : undefined} href="/pipeline?view=table" />
      <Stat label="Activities today" value={todayActs[0].n} href="/activities?range=today" /><Stat label="Calls today" value={todayActs[0].calls} />
      <Stat label="Decision-makers reached" value={todayActs[0].dm} tone="good" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Follow-ups due">{due.map((d) => (
        <Link key={d.id} href={`/deals/${d.id}`} className="mb-2 block rounded-lg border border-ink-100 p-2 text-sm hover:border-brand-400">
          <div className="flex justify-between"><b>{d.inst}</b><span className={d.f && d.f < today ? "text-xs font-semibold text-red-600" : "text-xs"}>{dt(d.f)}</span></div>
          <div className="text-xs text-ink-700">→ {d.next}</div></Link>))}{!due.length && <p className="muted">Nothing due. Prospect your hot leads.</p>}</Card>
      <Card title="Scheduled (meetings, demos, calls)">{planned.map(({ a, inst }) => (
        <Link key={a.id} href={`/leads/${a.institutionId}`} className="mb-1 flex justify-between text-sm hover:text-brand-600"><span>{a.typeKey} · {inst}</span><span className="text-xs text-ink-500">{dtt(a.occurredAt)}</span></Link>))}
        {!planned.length && <p className="muted">Nothing scheduled.</p>}</Card>
      <Card title="Hot / warm leads with no touch in 14 days">{hot.map((h) => (
        <Link key={h.id} href={`/leads/${h.id}`} className="mb-1 flex items-center justify-between text-sm hover:text-brand-600"><span>{h.name}</span><BandBadge band={h.band} score={h.score} /></Link>))}
        {!hot.length && <p className="muted">All hot leads are being worked.</p>}</Card>
      <Card title="My tasks" actions={<Link href="/tasks" className="link text-xs">All tasks</Link>}>{tasks.map((x) => <div key={x.id} className="mb-1 flex justify-between text-sm"><span>{x.title}</span><span className="text-xs text-ink-500">{dt(x.dueAt)}</span></div>)}{!tasks.length && <p className="muted">No open tasks.</p>}</Card>
    </div>
  </>);
}
