import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { salesPerformance } from "@/lib/metrics";
import { addDays, inr, startOfDay } from "@/lib/format";
import { Card, PageHeader, Table } from "@/components/ui";
import { JsonForm } from "@/components/client/JsonForm";
import { Disclosure } from "@/components/client/Disclosure";
import { BarChartC } from "@/components/client/Charts";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Performance({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requirePage("performance.view.all", "performance.view.team", "performance.view.own");
  const sp = await searchParams; const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const owners = ctx.can("performance.view.all") ? null : ctx.can("performance.view.team") ? ctx.teamUserIds : [ctx.user.id];
  const people = await salesPerformance(owners, addDays(startOfDay(), -days + 1));
  const period = new Date().toISOString().slice(0, 7);
  const targets = await db.select().from(t.targets).where(eq(t.targets.period, period));
  const tg = (u: string, m: string) => targets.find((x) => x.userId === u && x.metric === m)?.value;
  const cell = (v: number, target?: number) => <span>{v}{target != null && <span className={v >= target ? "text-emerald-600" : "text-ink-500"}> / {target}</span>}</span>;
  return (<>
    <PageHeader title="Sales team performance" sub={`Last ${days} days · targets for ${period}`} actions={<div className="flex gap-1">{[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={d === days ? "btn-primary" : "btn-ghost"}>{d}d</Link>)}</div>} />
    <div className="card mb-4"><Table head={["Person", "Leads", "Researched", "Calls", "Meaningful", "DMs", "Meetings", "Demos", "Proposals", "Pilots", "Won", "Won MRR", "Conversion", "Follow-up discipline"]} empty={!people.length}>
      {people.map((p) => <tr key={p.id}><td className="td font-medium">{p.name}<div className="text-xs text-ink-500">{p.role}</div></td><td className="td">{p.leads}</td><td className="td">{p.researched}</td>
        <td className="td">{cell(p.calls, tg(p.id, "CALLS"))}</td><td className="td">{p.meaningful}</td><td className="td">{p.dms}</td><td className="td">{cell(p.meetings, tg(p.id, "MEETINGS"))}</td><td className="td">{cell(p.demos, tg(p.id, "DEMOS"))}</td>
        <td className="td">{cell(p.proposals, tg(p.id, "PROPOSALS"))}</td><td className="td">{p.pilots}</td><td className="td">{cell(p.won, tg(p.id, "WON_DEALS"))}</td><td className="td">{inr(p.wonMrr)}</td>
        <td className="td">{p.conversion ?? "—"}{p.conversion != null && "%"}</td><td className={`td ${p.followUpDiscipline != null && p.followUpDiscipline < 80 ? "text-red-600" : ""}`}>{p.followUpDiscipline ?? "—"}{p.followUpDiscipline != null && "%"} <span className="text-xs text-ink-500">({p.overdue} overdue)</span></td></tr>)}
    </Table></div>
    {people.length > 1 && <Card title="Activity comparison"><BarChartC data={people.map((p) => ({ name: p.name, value: p.calls, value2: p.meetings + p.demos }))} /></Card>}
    {ctx.can("settings.business") && <Card title="Monthly targets" className="mt-4"><Disclosure label="Set targets">
      <JsonForm action="/api/targets" cols={3} fields={[{ name: "userId", label: "Salesperson", type: "select", required: true, options: people.map((p) => ({ value: p.id, label: p.name })) },
        { name: "period", label: "Month (YYYY-MM)", required: true }, { name: "CALLS", label: "Calls", type: "number" }, { name: "MEETINGS", label: "Meetings", type: "number" },
        { name: "DEMOS", label: "Demos", type: "number" }, { name: "PROPOSALS", label: "Proposals", type: "number" }, { name: "WON_DEALS", label: "Won deals", type: "number" }, { name: "MRR", label: "Won MRR (₹)", type: "number" }]} initial={{ period }} />
    </Disclosure></Card>}
  </>);
}
