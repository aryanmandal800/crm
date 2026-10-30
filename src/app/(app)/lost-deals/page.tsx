import Link from "next/link";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { activityScope, dealScope } from "@/lib/access";
import { dt, inr } from "@/lib/format";
import { Card, PageHeader, Table } from "@/components/ui";
import { BarChartC } from "@/components/client/Charts";
export const dynamic = "force-dynamic";

const ADVICE: Record<string, string> = {
  PRICE: "Lead with the paid pilot and member-based pricing; review the floor rate and slab structure for this segment.",
  EXISTING_VENDOR: "Use the 30-day challenge / side-by-side demo; target contract-renewal windows; collect migration case studies.",
  NO_BUDGET: "Offer phased modules (eKYC or member app first) and milestone billing aligned to the financial year.",
  MGMT_NOT_CONVINCED: "Get the board in the room: director dashboard demo, references from similar societies, audit-readiness angle.",
  PROCUREMENT_DELAY: "Map the approval path early; prepare board-ready proposal pack and AGM calendar.",
  PRODUCT_GAP: "Log the gap as a product request; check frequency before building.",
  COMPETITOR_SELECTED: "Record the competitor and price; build an evidence-backed battle card.",
  NO_RESPONSE: "Tighten qualification earlier; multi-thread to more than one decision maker.",
  WRONG_TIMING: "Move to nurture with a dated re-engagement task.",
};

export default async function LostDeals() {
  const ctx = await requirePage("deal.view");
  const [byReason, byComp, deals, objections] = await Promise.all([
    db.select({ key: t.lostReasons.key, name: t.lostReasons.name, n: sql<number>`count(${t.deals.id})::int`, mrr: sql<number>`coalesce(sum(${t.deals.mrr}),0)::float` })
      .from(t.lostReasons).leftJoin(t.deals, and(eq(t.deals.lostReasonId, t.lostReasons.id), dealScope(ctx))).groupBy(t.lostReasons.key, t.lostReasons.name).orderBy(desc(sql`count(${t.deals.id})`)),
    db.select({ name: t.competitors.name, n: sql<number>`count(*)::int` }).from(t.deals).innerJoin(t.competitors, eq(t.competitors.id, t.deals.competitorId)).where(and(isNotNull(t.deals.lostAt), dealScope(ctx))).groupBy(t.competitors.name),
    db.select({ d: t.deals, inst: t.institutions.legalName, reason: t.lostReasons.name }).from(t.deals).innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId))
      .leftJoin(t.lostReasons, eq(t.lostReasons.id, t.deals.lostReasonId)).where(and(isNotNull(t.deals.lostAt), dealScope(ctx))).orderBy(desc(t.deals.lostAt)).limit(100),
    db.select({ o: t.activities.objection, n: sql<number>`count(*)::int` }).from(t.activities).where(and(isNotNull(t.activities.objection), activityScope(ctx))).groupBy(t.activities.objection).orderBy(desc(sql`count(*)`)).limit(15),
  ]);
  const total = byReason.reduce((a, r) => a + r.n, 0);
  const top = byReason.filter((r) => r.n > 0).slice(0, 3);
  return (<>
    <PageHeader title="Lost deals & objections" sub={`${total} lost deals analysed`} />
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Why we lose"><BarChartC data={byReason.map((r) => ({ name: r.name, value: r.n }))} /></Card>
      <Card title="What to change">
        {top.length ? top.map((r) => <div key={r.key} className="mb-2 text-sm"><b>{r.name}</b> — {r.n} deal(s), {inr(r.mrr)} MRR lost<p className="text-ink-700">{ADVICE[r.key] ?? "Review these deals together."}</p></div>)
          : <p className="muted">No lost deals yet. Patterns appear here once deals are marked lost with a reason.</p>}
        <p className="mt-2 text-[11px] text-violet-700">Recommendations are rule-based suggestions, not findings.</p>
      </Card>
      <Card title="Most frequent objections (from activity log)">{objections.map((o) => <div key={o.o} className="flex justify-between border-b border-ink-100 py-1 text-sm"><span>{o.o}</span><b>{o.n}</b></div>)}{!objections.length && <p className="muted">No objections logged yet.</p>}</Card>
      <Card title="Lost to competitors">{byComp.map((c) => <div key={c.name} className="flex justify-between text-sm"><span>{c.name}</span><b>{c.n}</b></div>)}{!byComp.length && <p className="muted">None recorded.</p>}</Card>
    </div>
    <div className="card mt-4"><Table head={["Deal", "Reason", "MRR", "Lost on", "Notes"]} empty={!deals.length}>
      {deals.map(({ d, inst, reason }) => <tr key={d.id}><td className="td"><Link className="link" href={`/deals/${d.id}`}>{inst}</Link></td><td className="td">{reason ?? "—"}</td><td className="td">{inr(d.mrr)}</td><td className="td text-xs">{dt(d.lostAt)}</td><td className="td text-xs">{d.lostNotes}</td></tr>)}
    </Table></div>
  </>);
}
