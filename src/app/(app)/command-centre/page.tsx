import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { activityKpis, dealLists, hotAtRisk, leadKpis, pipelineKpis, talukaCoverage, todayBySalesperson, tomorrowActions } from "@/lib/metrics";
import { addDays, dt, dtt, inr, num, startOfDay } from "@/lib/format";
import { BandBadge, Card, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CommandCentre() {
  await requirePage("dashboard.founder");
  const today = startOfDay(); const weekAgo = addDays(today, -6);
  const [lk, pk, actToday, actWeek, people, lists, risk, talukas, actions, dmToday, demos, proposals, approvals] = await Promise.all([
    leadKpis(null), pipelineKpis(null), activityKpis(null, today), activityKpis(null, weekAgo), todayBySalesperson(null), dealLists(null), hotAtRisk(null), talukaCoverage(null), tomorrowActions(null),
    db.select({ a: t.activities, inst: t.institutions.legalName, contact: t.contacts.name, by: t.users.name }).from(t.activities).innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
      .leftJoin(t.contacts, eq(t.contacts.id, t.activities.contactId)).innerJoin(t.users, eq(t.users.id, t.activities.userId))
      .where(sql`${t.activities.decisionMakerReached} and ${t.activities.occurredAt} >= ${weekAgo.toISOString()}`).orderBy(desc(t.activities.occurredAt)).limit(15),
    db.select({ a: t.activities, inst: t.institutions.legalName, by: t.users.name }).from(t.activities).innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId)).innerJoin(t.users, eq(t.users.id, t.activities.userId))
      .where(sql`${t.activities.typeKey} = 'DEMO' and ${t.activities.status} = 'PLANNED'`).orderBy(t.activities.occurredAt).limit(15),
    db.select({ q: t.quotes, inst: t.institutions.legalName }).from(t.quotes).innerJoin(t.institutions, eq(t.institutions.id, t.quotes.institutionId)).where(inArray(t.quotes.status, ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"])).orderBy(desc(t.quotes.createdAt)).limit(15),
    db.select({ n: sql<number>`count(*)::int` }).from(t.approvalRequests).where(eq(t.approvalRequests.status, "PENDING")),
  ]);
  const under = [...talukas].filter((x) => x.institutions > 0).sort((a, b) => a.coverage - b.coverage).slice(0, 5);
  const emptyTalukas = talukas.filter((x) => x.institutions === 0).map((x) => x.name);

  return (<>
    <PageHeader title="Founder's Sales Command Centre" sub={`${today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      actions={<><Link className="btn-ghost" href="/dashboard">Full analytics</Link>{approvals[0].n > 0 && <Link className="btn-primary" href="/approvals">{approvals[0].n} approval(s) waiting</Link>}</>} />

    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="1 · Leads (credit societies)" value={num(lk.prospects)} sub={`${lk.expansion} in expansion categories`} href="/leads?segment=primary" />
      <Stat label="2 · Qualified" value={pk.qualified} sub={`${lk.hot} hot · ${lk.warm} warm`} href="/pipeline?view=table" />
      <Stat label="10 · Pipeline MRR" value={inr(pk.openMrr)} sub={`weighted ${inr(pk.weightedMrr)}`} href="/pipeline" />
      <Stat label="11 · Won MRR" value={inr(pk.wonMrr)} sub={`${pk.won} deals · ${inr(pk.wonMrrMonth)} this month`} tone="good" href="/onboarding" />
      <Stat label="Overdue follow-ups" value={pk.overdue} tone={pk.overdue ? "bad" : undefined} href="/pipeline?view=table" />
      <Stat label="Stalled deals" value={pk.stalled} tone={pk.stalled ? "warm" : undefined} href="#stalled" />
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="13 · Tomorrow's five most important actions" className="lg:col-span-2">
        <ol className="space-y-2">{actions.map((a, i) => <li key={i} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
          <div><Link href={a.link} className="font-medium hover:text-brand-600">{a.text}</Link><div className="text-xs text-ink-500">{a.who}</div></div></li>)}</ol>
        {!actions.length && <p className="muted">No follow-ups due tomorrow. Review hot leads without deals.</p>}
        <p className="mt-2 text-[11px] text-violet-700">Ranked by rules: pending approvals first, then overdue/due follow-ups weighted by MRR × probability and lead score.</p>
      </Card>
      <Card title="3 · What the team did today">
        {people.map((p: any) => <div key={p.id} className="mb-2 text-sm"><div className="flex justify-between"><b>{p.name}</b><span className="text-xs">{p.done} activities</span></div>
          <div className="text-xs text-ink-500">{p.calls} calls · {p.dms} DMs · {p.meetings} meetings/demos</div>{p.institutions && <div className="truncate text-xs text-ink-700">{p.institutions}</div>}</div>)}
        {!people.length && <p className="muted">No sales users yet. Add them in Users.</p>}
        <div className="mt-2 border-t border-ink-100 pt-2 text-xs text-ink-500">Today: {actToday.total} activities · {actToday.calls} calls · {actToday.dms} DMs<br />Last 7 days: {actWeek.total} activities · {actWeek.calls} calls · {actWeek.meetings} meetings · {actWeek.demos} demos</div>
      </Card>

      <Card title="7 · Needs founder intervention">
        {lists.founder.map((d: any) => <Link key={d.id} href={`/deals/${d.id}`} className="mb-2 block text-sm hover:text-brand-600"><b>{d.inst}</b> <span className="text-xs text-ink-500">{d.stage} · {inr(Number(d.mrr))}</span>{d.founder_flag_reason && <div className="text-xs text-violet-700">{d.founder_flag_reason}</div>}</Link>)}
        {!lists.founder.length && <p className="muted">Nothing flagged.</p>}
      </Card>
      <Card title="9 · Hot opportunities at risk">
        {risk.map((r: any) => <Link key={r.id} href={`/leads/${r.id}`} className="mb-1 flex items-center justify-between gap-2 text-sm hover:text-brand-600"><span className="truncate">{r.legal_name}</span><span className="shrink-0 text-xs text-ink-500">{r.last_touch ? `last ${dt(r.last_touch)}` : "never contacted"}</span></Link>)}
        {!risk.length && <p className="muted">All hot leads are moving.</p>}
      </Card>
      <Card title="8 · Not followed up">
        {lists.overdue.slice(0, 10).map((d: any) => <Link key={d.id} href={`/deals/${d.id}`} className="mb-1 flex justify-between gap-2 text-sm hover:text-brand-600"><span className="truncate">{d.inst} <span className="text-xs text-ink-500">· {d.owner}</span></span><span className="shrink-0 text-xs text-red-600">{d.follow_up_date ? dt(d.follow_up_date) : "no date"}</span></Link>)}
        {!lists.overdue.length && <p className="muted">Follow-up discipline is clean.</p>}
      </Card>

      <Card title="4 · Decision-makers reached (7 days)">
        {dmToday.map(({ a, inst, contact, by }) => <div key={a.id} className="mb-1 text-sm"><b>{contact ?? "Decision maker"}</b> — {inst}<div className="text-xs text-ink-500">{by} · {dtt(a.occurredAt)}</div></div>)}
        {!dmToday.length && <p className="muted">None this week.</p>}
      </Card>
      <Card title="5 · Demos scheduled">
        {demos.map(({ a, inst, by }) => <Link key={a.id} href={`/leads/${a.institutionId}`} className="mb-1 block text-sm hover:text-brand-600">{inst}<div className="text-xs text-ink-500">{dtt(a.occurredAt)} · {by}</div></Link>)}
        {!demos.length && <p className="muted">No demos booked. {pk.demo} deal(s) sit in the demo stage.</p>}
      </Card>
      <Card title="6 · Proposals pending">
        {proposals.map(({ q, inst }) => <Link key={q.id} href={`/quotes/${q.id}`} className="mb-1 flex justify-between gap-2 text-sm hover:text-brand-600"><span className="truncate">{inst}</span><span className="shrink-0 text-xs">{q.status.replace("_", " ").toLowerCase()} · {inr(q.monthlyFee * (1 - q.discountPct / 100))}</span></Link>)}
        {!proposals.length && <p className="muted">No open quotations.</p>}
      </Card>

      <Card title="12 · Under-covered talukas" className="lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2">{under.map((x) => <Link key={x.id} href={`/leads?taluka=${x.id}`} className="rounded-lg border border-ink-100 p-2 text-sm hover:border-brand-400">
          <div className="flex justify-between"><b>{x.name}</b><span className={x.coverage < 20 ? "text-red-600" : "text-amber-600"}>{x.coverage}% contacted</span></div>
          <div className="text-xs text-ink-500">{x.institutions} societies · {x.hotWarm} hot/warm · {x.openDeals} open deals</div></Link>)}</div>
        {emptyTalukas.length > 0 && <p className="mt-2 text-xs text-ink-500"><b>No research yet:</b> {emptyTalukas.join(", ")}</p>}
      </Card>
      <Card title="Lead quality">
        <div className="space-y-1 text-sm">{([["HOT", lk.hot], ["WARM", lk.warm], ["NURTURE", lk.nurture], ["LOW", lk.low]] as [string, number][]).map(([b, v]) =>
          <Link key={b} href={`/leads?band=${b}&segment=primary`} className="flex items-center justify-between hover:text-brand-600"><BandBadge band={b} /><b>{v}</b></Link>)}</div>
        <div className="mt-2 text-xs text-ink-500">{lk.verified} verified · {lk.unverified} unverified · {lk.unassigned} unassigned</div>
      </Card>

      <Card title="Stalled deals" className="lg:col-span-3"><div id="stalled" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{lists.stalled.map((d: any) => <Link key={d.id} href={`/deals/${d.id}`} className="rounded-lg border border-amber-200 p-2 text-sm hover:border-amber-400">
          <b>{d.inst}</b><div className="text-xs text-ink-500">{d.stage} since {dt(d.stage_changed_at)} · {d.owner}</div></Link>)}</div>
        {!lists.stalled.length && <p className="muted">No stalled deals.</p>}
      </Card>
    </div>
  </>);
}
