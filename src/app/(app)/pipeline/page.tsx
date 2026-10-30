import Link from "next/link";
import { and, asc, eq, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePage } from "@/lib/auth";
import { dealScope } from "@/lib/access";
import { options } from "@/lib/options";
import { dt, inr } from "@/lib/format";
import { BandBadge, PageHeader, Table } from "@/components/ui";
import { Kanban } from "@/components/client/Kanban";
import { OPPORTUNITY_CATEGORIES } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function Pipeline({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePage("deal.view");
  const sp = await searchParams; const o = await options();
  const conds: (SQL | undefined)[] = [dealScope(ctx)];
  if (sp.owner) conds.push(eq(t.deals.ownerId, sp.owner));
  if (sp.category) conds.push(eq(t.deals.opportunityCategory, sp.category));
  if (sp.taluka) conds.push(eq(t.institutions.talukaId, sp.taluka));
  if (sp.stage) conds.push(eq(t.deals.stageId, sp.stage));
  const rows = await db.select({
    id: t.deals.id, title: t.deals.title, stageId: t.deals.stageId, mrr: t.deals.mrr, followUpDate: t.deals.followUpDate, nextAction: t.deals.nextAction,
    founderFlag: t.deals.founderFlag, stageChangedAt: t.deals.stageChangedAt, owner: t.users.name, institution: t.institutions.legalName, institutionId: t.institutions.id,
    band: t.institutions.scoreBand, score: t.institutions.score, taluka: t.talukas.name, category: t.deals.opportunityCategory,
  }).from(t.deals).innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId)).innerJoin(t.users, eq(t.users.id, t.deals.ownerId))
    .leftJoin(t.talukas, eq(t.talukas.id, t.institutions.talukaId)).where(and(...conds)).orderBy(asc(t.deals.followUpDate));
  const view = sp.view === "table" ? "table" : "kanban";
  const qs = (v: string) => "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, x]) => x) as [string, string][]), view: v }).toString();
  const stages = o.stages.map((s) => ({ id: s.id, key: s.key, name: s.name, isOpen: s.isOpen, isWon: s.isWon, isLost: s.isLost, stallDays: s.stallDays, probability: s.probability }));
  const data = rows.map((r) => ({ ...r, followUpDate: r.followUpDate?.toISOString() ?? null, stageChangedAt: r.stageChangedAt.toISOString() }));

  return (<>
    <PageHeader title="Deal pipeline" sub={`${rows.length} deals · open MRR ${inr(rows.filter((r) => stages.find((s) => s.id === r.stageId)?.isOpen).reduce((a, r) => a + r.mrr, 0))}`} actions={<>
      <Link href={qs("kanban")} className={view === "kanban" ? "btn-primary" : "btn-ghost"}>Kanban</Link>
      <Link href={qs("table")} className={view === "table" ? "btn-primary" : "btn-ghost"}>Table</Link>
      {ctx.can("reports.export") && <a href="/api/export/pipeline" className="btn-ghost">Export</a>}
    </>} />
    <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-5">
      <input type="hidden" name="view" value={view} />
      <select name="owner" defaultValue={sp.owner ?? ""} className="input"><option value="">All owners</option>{o.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <select name="category" defaultValue={sp.category ?? ""} className="input"><option value="">All opportunities</option>{Object.entries(OPPORTUNITY_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select name="taluka" defaultValue={sp.taluka ?? ""} className="input"><option value="">All talukas</option>{o.talukas.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select name="stage" defaultValue={sp.stage ?? ""} className="input"><option value="">All stages</option>{o.stages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <button className="btn-primary">Filter</button>
    </form>
    {view === "kanban" ? <Kanban stages={stages} deals={data} canMove={ctx.can("deal.edit") && !ctx.grant} /> : (
      <div className="card"><Table head={["Deal", "Stage", "Score", "Owner", "MRR", "Next action", "Follow-up"]} empty={!rows.length}>
        {rows.map((r) => { const overdue = r.followUpDate && r.followUpDate < new Date(); return (
          <tr key={r.id}><td className="td"><Link className="link font-medium" href={`/deals/${r.id}`}>{r.title}</Link><div className="text-xs text-ink-500">{r.institution} · {r.taluka ?? "—"}</div></td>
            <td className="td text-xs">{o.stages.find((s) => s.id === r.stageId)?.name}</td><td className="td"><BandBadge band={r.band} score={r.score} /></td>
            <td className="td">{r.owner}</td><td className="td tabular-nums">{inr(r.mrr)}</td><td className="td text-xs">{r.nextAction ?? "—"}</td>
            <td className={`td text-xs ${overdue ? "font-semibold text-red-600" : ""}`}>{dt(r.followUpDate)}</td></tr>); })}
      </Table></div>
    )}
  </>);
}
