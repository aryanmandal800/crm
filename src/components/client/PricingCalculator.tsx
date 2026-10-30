"use client";
import { useEffect, useState } from "react";
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export function PricingCalculator({ members, branches, modules }: { members: number; branches: number; modules: { value: string; label: string }[] }) {
  const [v, setV] = useState({ members, branches, migration: "NONE", discountPct: 0, modules: [] as string[] }); const [r, setR] = useState<any>(null);
  useEffect(() => { const h = setTimeout(async () => { const res = await fetch("/api/pricing/calc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }); if (res.ok) setR(await res.json()); }, 250); return () => clearTimeout(h); }, [v]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="lbl">Members</label><input type="number" className="input" value={v.members} onChange={(e) => setV({ ...v, members: Number(e.target.value) })} /></div>
        <div><label className="lbl">Branches</label><input type="number" min={1} className="input" value={v.branches} onChange={(e) => setV({ ...v, branches: Number(e.target.value) })} /></div>
        <div><label className="lbl">Migration</label><select className="input" value={v.migration} onChange={(e) => setV({ ...v, migration: e.target.value })}>{["NONE", "LOW", "MEDIUM", "HIGH"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="lbl">Discount %</label><input type="number" className="input" value={v.discountPct} onChange={(e) => setV({ ...v, discountPct: Number(e.target.value) })} /></div>
        <div className="col-span-2"><label className="lbl">Add-on modules</label><select multiple className="input h-24" value={v.modules} onChange={(e) => setV({ ...v, modules: [...e.target.selectedOptions].map((o) => o.value) })}>{modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
      </div>
      {r && <div className="space-y-1 text-sm">
        <div className="text-xs text-ink-500">{r.model} model · slab ₹{r.ratePerMember}/member</div>
        {[["Monthly SaaS (list)", inr(r.monthly)], ["After discount", inr(r.monthlyAfterDiscount)], ["Implementation", inr(r.implementation)], ["Migration", inr(r.migration)],
          ["Annual contract value", inr(r.arr)], ["First-year value", inr(r.firstYearValue)], ["Negotiation range / mo", `${inr(r.negotiation.minAcceptableMonthly)} – ${inr(r.negotiation.listMonthly)}`],
          ["Minimum acceptable / mo", inr(r.negotiation.minAcceptableMonthly)], ["Paid pilot", `${inr(r.pilot.fee)} (${r.pilot.months} mo)`]].map(([k, val]) => <div key={k} className="flex justify-between"><span className="text-ink-700">{k}</span><b className="tabular-nums">{val}</b></div>)}
        {r.needsApproval && <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">Needs approval: {r.approvalReasons.join("; ")}</p>}
        <p className="text-xs text-ink-500">{r.commercialModel}</p>
      </div>}
    </div>
  );
}
