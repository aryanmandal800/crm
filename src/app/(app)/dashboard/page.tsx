import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { activityKpis, leadKpis, ownerFilter, pipelineKpis, salesPerformance, stageFunnel, talukaCoverage, topOpportunities, typePipeline } from "@/lib/metrics";
import { addDays, dt, inr, num, startOfDay } from "@/lib/format";
import { BandBadge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { BarChartC, PieC } from "@/components/client/Charts";
import { OPPORTUNITY_CATEGORIES } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requirePage("reports.view.all", "reports.view.team");
  const sp = await searchParams; const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const owners = ownerFilter(ctx); const since = addDays(startOfDay(), -days + 1);
  const [lk, pk, ak, funnel, talukas, types, people, top] = await Promise.all([leadKpis(owners), pipelineKpis(owners), activityKpis(owners, since), stageFunnel(owners), talukaCoverage(owners), typePipeline(owners), salesPerformance(owners, since), topOpportunities(owners)]);
  const conv = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (<>
    <PageHeader title="Analytics dashboard" sub={owners ? "Your team's view" : "Whole company"} actions={<div className="flex gap-1">{[7, 30, 90, 365].map((d) => <Link key={d} href={`?days=${d}`} className={d === days ? "btn-primary" : "btn-ghost"}>{d === 365 ? "1y" : `${d}d`}</Link>)}</div>} />

    <h2 className="h2 mb-2">Market & leads</h2>
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <Stat label="Total prospects" value={num(lk.prospects)} href="/leads?segment=primary" />
      <Stat label="Verified / unverified" value={`${lk.verified} / ${lk.unverified}`} href="/leads?verification=VERIFIED" />
      <Stat label="Hot" value={lk.hot} tone="hot" href="/leads?band=HOT" /><Stat label="Warm" value={lk.warm} tone="warm" href="/leads?band=WARM" />
      <Stat label="Nurture" value={lk.nurture} href="/leads?band=NURTURE" /><Stat label="Low priority" value={lk.low} href="/leads?band=LOW" />
      <Stat label="Potential members" value={num(lk.members)} sub={`${lk.withMembers} societies with member data`} href="/leads?sort=members" />
      <Stat label="Potential branches" value={num(lk.branches)} />
      <Stat label="Est. MRR opportunity" value={inr(lk.mrrOpportunityList, { compact: true })} sub={`floor ${inr(lk.mrrOpportunityFloor, { compact: true })} · estimate at list rate`} />
      <Stat label="ACV opportunity" value={inr(lk.acvOpportunity, { compact: true })} sub="estimate" />
      <Stat label="Unassigned leads" value={lk.unassigned} href="/leads?owner=none" />
      <Stat label="Expansion categories" value={lk.expansion} href="/leads?segment=expansion" />
    </div>

    <h2 className="h2 mb-2">Sales activity · last {days} days</h2>
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Calls completed" value={ak.calls} href={`/activities?type=CALL&from=${since.toISOString().slice(0, 10)}`} />
      <Stat label="Decision-makers reached" value={ak.dms} href="/activities" /><Stat label="Meetings" value={ak.meetings} href="/activities?type=MEETING" />
      <Stat label="Demos" value={ak.demos} href="/activities?type=DEMO" /><Stat label="Meaningful conversations" value={ak.meaningful} /><Stat label="All activities" value={ak.total} href="/activities" />
    </div>

    <h2 className="h2 mb-2">Pipeline & revenue</h2>
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Proposals" value={pk.proposal} href={`/pipeline?view=table&stage=${funnel.find((f) => f.key === "PROPOSAL")?.id ?? ""}`} />
      <Stat label="Negotiations" value={pk.negotiation} href={`/pipeline?view=table&stage=${funnel.find((f) => f.key === "NEGOTIATION")?.id ?? ""}`} />
      <Stat label="Paid pilots" value={pk.pilots} sub={`${pk.pilotsActive} active`} /><Stat label="Won / lost" value={`${pk.won} / ${pk.lost}`} sub={pk.winRate != null ? `${pk.winRate}% win rate` : undefined} href="/lost-deals" />
      <Stat label="Actual MRR (won)" value={inr(pk.wonMrr)} tone="good" href="/onboarding" /><Stat label="Forecast MRR (weighted)" value={inr(pk.weightedMrr)} sub={`open ${inr(pk.openMrr)}`} href="/pipeline" />
      <Stat label="Overdue activities" value={pk.overdue} tone={pk.overdue ? "bad" : undefined} href="/pipeline?view=table" /><Stat label="Stalled deals" value={pk.stalled} tone={pk.stalled ? "warm" : undefined} href="/command-centre#stalled" />
      <Stat label="Lead → qualified" value={conv(pk.qualified, lk.prospects)} /><Stat label="Qualified → won" value={conv(pk.won, pk.qualified)} />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Stage funnel (deals)"><BarChartC data={funnel.map((f) => ({ name: f.name, value: f.n }))} links={funnel.map((f) => `/pipeline?view=table&stage=${f.id}`)} /></Card>
      <Card title="Lead bands"><PieC data={[{ name: "Hot", value: lk.hot }, { name: "Warm", value: lk.warm }, { name: "Nurture", value: lk.nurture }, { name: "Low", value: lk.low }]} links={["HOT", "WARM", "NURTURE", "LOW"].map((b) => `/leads?band=${b}`)} /></Card>
      <Card title="Taluka-wise pipeline (institutions vs contacted)"><BarChartC data={talukas.map((x) => ({ name: x.name, value: x.institutions, value2: x.contacted }))} links={talukas.map((x) => `/leads?taluka=${x.id}`)} /></Card>
      <Card title="Taluka open MRR"><BarChartC money data={talukas.map((x) => ({ name: x.name, value: x.openMrr }))} links={talukas.map((x) => `/pipeline?view=table&taluka=${x.id}`)} /></Card>
      <Card title="Institution-type pipeline" className="lg:col-span-2"><BarChartC horizontal height={420} data={types.filter((x) => x.institutions).map((x) => ({ name: x.name, value: x.institutions, value2: x.openDeals }))} links={types.filter((x) => x.institutions).map((x) => `/leads?type=${x.id}`)} /></Card>
    </div>

    <Card title="Salesperson performance" className="mt-4">
      <Table head={["Person", "Leads", "Calls", "DMs", "Meetings", "Demos", "Proposals", "Won", "Won MRR", "Conversion", "Follow-up discipline"]} empty={!people.length}>
        {people.map((p) => <tr key={p.id}><td className="td"><Link href={`/performance?user=${p.id}`} className="link">{p.name}</Link></td><td className="td">{p.leads}</td><td className="td">{p.calls}</td><td className="td">{p.dms}</td><td className="td">{p.meetings}</td><td className="td">{p.demos}</td><td className="td">{p.proposals}</td><td className="td">{p.won}</td><td className="td">{inr(p.wonMrr)}</td><td className="td">{p.conversion ?? "—"}{p.conversion != null && "%"}</td><td className="td">{p.followUpDiscipline ?? "—"}{p.followUpDiscipline != null && "%"}</td></tr>)}
      </Table>
    </Card>

    <Card title="Top 20 opportunities" className="mt-4">
      <Table head={["Institution", "Score", "Opportunity", "Members", "Stage", "MRR", "Owner", "Follow-up"]} empty={!top.length}>
        {top.map((r: any) => <tr key={r.id}><td className="td"><Link className="link" href={r.deal_id ? `/deals/${r.deal_id}` : `/leads/${r.id}`}>{r.legal_name}</Link></td><td className="td"><BandBadge band={r.score_band} score={r.score} /></td>
          <td className="td text-xs">{OPPORTUNITY_CATEGORIES[r.opportunity_category]}</td><td className="td">{num(r.members)}</td><td className="td text-xs">{r.stage ?? <span className="text-amber-700">No deal yet</span>}</td>
          <td className="td">{r.mrr != null ? inr(r.mrr) : "—"}</td><td className="td">{r.owner ?? "—"}</td><td className="td text-xs">{dt(r.follow_up_date)}</td></tr>)}
      </Table>
    </Card>
  </>);
}
