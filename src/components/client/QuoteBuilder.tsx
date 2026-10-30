"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";

type O = { value: string; label: string; core?: boolean };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function QuoteBuilder(p: { institutionId: string; dealId: string | null; members: number; branches: number; modules: O[]; defaultModules: string[]; terms: string; milestones: { name: string; pct: number; trigger: string }[]; maxDiscount: number }) {
  const router = useRouter();
  const [v, setV] = useState({ model: "AUTO", members: p.members, branches: p.branches, modules: p.defaultModules, migration: "NONE", integrations: 0, trainingDays: 0, hosting: "SHARED", sla: "STANDARD", txnVolume: "LOW", discountPct: 0 });
  const [scope, setScope] = useState(""); const [terms, setTerms] = useState(p.terms); const [ms, setMs] = useState(JSON.stringify(p.milestones, null, 1)); const [just, setJust] = useState("");
  const [calc, setCalc] = useState<any>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: string, x: any) => setV((s) => ({ ...s, [k]: x }));

  useEffect(() => {
    const h = setTimeout(async () => {
      const res = await fetch("/api/pricing/calc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) });
      const j = await res.json(); if (res.ok) { setCalc(j); setErr(null); } else setErr(j.error);
    }, 250); return () => clearTimeout(h);
  }, [v]);

  async function save() {
    setBusy(true); setErr(null);
    let milestones; try { milestones = JSON.parse(ms); } catch { setErr("Milestones must be valid JSON"); setBusy(false); return; }
    const res = await fetch("/api/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, institutionId: p.institutionId, dealId: p.dealId, scope: scope || null, terms, milestones, justification: just || null }) });
    const j = await res.json(); setBusy(false);
    if (!res.ok) return setErr([j.error, ...(j.details ?? [])].join(" — "));
    router.push(`/quotes/${j.id}`);
  }
  const num = (k: string, label: string, min = 0) => <div><label className="lbl">{label}</label><input type="number" min={min} className="input" value={(v as any)[k]} onChange={(e) => set(k, Number(e.target.value))} /></div>;
  const sel = (k: string, label: string, opts: string[]) => <div><label className="lbl">{label}</label><select className="input" value={(v as any)[k]} onChange={(e) => set(k, e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card space-y-3 p-4 lg:col-span-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {sel("model", "Pricing model", ["AUTO", "MEMBER", "BRANCH", "ENTERPRISE"])}{num("members", "Members")}{num("branches", "Branches", 1)}
          {sel("migration", "Migration complexity", ["NONE", "LOW", "MEDIUM", "HIGH"])}{num("integrations", "Third-party integrations")}{num("trainingDays", "On-site training days")}
          {sel("hosting", "Hosting", ["SHARED", "DEDICATED"])}{sel("sla", "Support SLA", ["STANDARD", "PRIORITY", "PREMIUM"])}{sel("txnVolume", "Transaction volume (enterprise)", ["LOW", "MEDIUM", "HIGH"])}
          <div><label className="lbl">Discount %</label><input type="number" min={0} max={100} step="0.5" className="input" value={v.discountPct} onChange={(e) => set("discountPct", Number(e.target.value))} />
            <p className="mt-1 text-xs text-ink-500">Above {p.maxDiscount}% needs approval</p></div>
        </div>
        <div><label className="lbl">Modules in scope</label><div className="flex flex-wrap gap-1.5">{p.modules.map((m) => { const on = v.modules.includes(m.value); return (
          <button key={m.value} type="button" onClick={() => set("modules", on ? v.modules.filter((x) => x !== m.value) : [...v.modules, m.value])} className={clsx("rounded-full border px-2 py-0.5 text-xs", on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-300 text-ink-500")}>{m.label}</button>); })}</div></div>
        <div><label className="lbl">Scope statement (shown on quotation)</label><textarea className="input min-h-[70px]" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Leave blank for an auto-generated scope line" /></div>
        <div><label className="lbl">Commercial terms</label><textarea className="input min-h-[110px]" value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
        <div><label className="lbl">Payment milestones (JSON, must total 100%)</label><textarea className="input min-h-[90px] font-mono text-xs" value={ms} onChange={(e) => setMs(e.target.value)} /></div>
        {calc?.needsApproval && <div><label className="lbl">Justification for approval</label><textarea className="input" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Why this price? Competition, reference value, strategic account…" /></div>}
      </div>
      <div className="lg:col-span-2">
        <div className="card sticky top-16 space-y-2 p-4 text-sm">
          <h2 className="h2">Calculation</h2>
          {calc ? (<>
            <div className="text-xs text-ink-500">{calc.model} model · ₹{calc.ratePerMember}/member slab</div>
            {calc.lines.map((l: any) => <div key={l.key} className="flex justify-between gap-2"><span className="text-ink-700">{l.name}{l.kind === "ONE_TIME" && <span className="text-ink-500"> (one-time)</span>}</span><span className="tabular-nums">{inr(l.amount)}</span></div>)}
            <hr />
            <Row k="Monthly (list)" v={inr(calc.monthly)} /><Row k={`After ${calc.discountPct}% discount`} v={inr(calc.monthlyAfterDiscount)} b />
            <Row k="One-time" v={inr(calc.oneTime)} /><Row k="Annual recurring" v={inr(calc.arr)} /><Row k="First-year value" v={inr(calc.firstYearValue)} b />
            <Row k="Negotiation range / month" v={`${inr(calc.negotiation.minAcceptableMonthly)} – ${inr(calc.negotiation.listMonthly)}`} />
            {calc.effectiveRate != null && <Row k="Effective ₹/member" v={`₹${calc.effectiveRate}`} />}
            <Row k="Paid pilot option" v={`${inr(calc.pilot.fee)} / ${calc.pilot.months} mo`} />
            {calc.needsApproval ? <div className="rounded bg-amber-50 p-2 text-xs text-amber-900"><b>Needs Super Admin approval:</b> {calc.approvalReasons.join("; ")}</div>
              : <div className="rounded bg-emerald-50 p-2 text-xs text-emerald-800">Within pricing authority.</div>}
            <p className="text-[11px] italic text-ink-500">{calc.assumptionNote}</p>
          </>) : <p className="muted">Calculating…</p>}
          {err && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{err}</p>}
          <button className="btn-primary w-full" disabled={busy || !calc} onClick={save}>{busy ? "Saving…" : calc?.needsApproval ? "Save & request approval" : "Save draft quote"}</button>
        </div>
      </div>
    </div>
  );
}
function Row({ k, v, b }: { k: string; v: string; b?: boolean }) { return <div className={clsx("flex justify-between gap-2", b && "font-semibold")}><span className="text-ink-700">{k}</span><span className="tabular-nums">{v}</span></div>; }
