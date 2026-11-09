"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  Check,
  Plus,
  Trash2,
  Layers,
  Wrench,
  Percent,
  FileText,
  ShieldAlert,
  Loader2,
  Sparkles,
} from "lucide-react";

type O = {
  value: string;
  label: string;
  core?: boolean;
  price?: number;
  category?: string;
  description?: string | null;
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const MEMBER_SLABS = [
  { min: 0, max: 5000, rate: 5, label: "Up to 5,000 members", rateText: "₹5 / member / mo" },
  { min: 5001, max: 20000, rate: 4.5, label: "5,001–20,000 members", rateText: "₹4.5 / member / mo" },
  { min: 20001, max: 50000, rate: 4, label: "20,001–50,000 members", rateText: "₹4 / member / mo" },
  { min: 50001, max: null, rate: 3.5, label: "50,001+ members", rateText: "₹3.5 / member / mo" },
];

export function QuoteBuilder(p: {
  institutionId: string;
  dealId: string | null;
  members: number;
  branches: number;
  modules: O[];
  defaultModules: string[];
  terms: string;
  milestones: { name: string; pct: number; trigger: string }[];
  maxDiscount: number;
}) {
  const router = useRouter();

  const [v, setV] = useState({
    model: "MONTHLY_SLAB" as "MONTHLY_SLAB" | "MODULE_WISE",
    setupLevel: "AUTO" as "AUTO" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3",
    members: p.members,
    branches: p.branches,
    modules: p.defaultModules,
    migration: "NONE",
    integrations: 0,
    trainingDays: 0,
    hosting: "SHARED",
    sla: "STANDARD",
    txnVolume: "LOW",
    discountPct: 0,
    setupDiscountPct: 0,
  });

  const [scope, setScope] = useState("");
  const [terms, setTerms] = useState(p.terms);
  const [ms, setMs] = useState(JSON.stringify(p.milestones?.length ? p.milestones : [{ name: "Advance on signing", pct: 100, trigger: "Agreement execution / 100% upfront payment" }], null, 1));
  const [just, setJust] = useState("");
  const [calc, setCalc] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("ALL");

  const set = (k: string, x: any) => setV((s) => ({ ...s, [k]: x }));

  useEffect(() => {
    setCalculating(true);
    const h = setTimeout(async () => {
      try {
        const res = await fetch("/api/pricing/calc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(v),
        });
        const j = await res.json();
        if (res.ok) {
          setCalc(j);
          setErr(null);
        } else {
          setErr(j.error);
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to calculate quote");
      } finally {
        setCalculating(false);
      }
    }, 200);

    return () => {
      clearTimeout(h);
      setCalculating(false);
    };
  }, [v]);

  async function save() {
    setBusy(true);
    setErr(null);
    let milestones;
    try {
      milestones = JSON.parse(ms);
    } catch {
      setErr("Milestones must be valid JSON");
      setBusy(false);
      return;
    }

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...v,
        institutionId: p.institutionId,
        dealId: p.dealId,
        scope: scope || null,
        terms,
        milestones,
        justification: just || null,
      }),
    });

    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr([j.error, ...(j.details ?? [])].join(" — "));
    router.push(`/quotes/${j.id}`);
  }

  const num = (k: string, label: string, min = 0) => (
    <div>
      <label className="lbl">{label}</label>
      <input
        type="number"
        min={min}
        className="input font-mono font-medium"
        value={(v as any)[k]}
        onChange={(e) => set(k, Number(e.target.value))}
      />
    </div>
  );

  const sel = (k: string, label: string, opts: string[]) => (
    <div>
      <label className="lbl">{label}</label>
      <select
        className="input font-medium"
        value={(v as any)[k]}
        onChange={(e) => set(k, e.target.value)}
      >
        {opts.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  const activeTierKey =
    calc?.setupLevel || (v.members <= 5000 ? "LEVEL_1" : v.members <= 15000 ? "LEVEL_2" : "LEVEL_3");

  // Displayable module list (excluding CBS base)
  const displayModules = p.modules.filter((m) => m.value !== "CBS" && m.value !== "MIGRATION");

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* ── LEFT COLUMN (7 COLS): Specifications, Setup Tiers, Modules, Terms ── */}
      <div className="space-y-5 lg:col-span-7">
        {/* 1. Commercial Pricing Model & Scale */}
        <div className="card p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-700">
              1. Commercial Pricing Model
            </span>
            <span className="text-[11px] text-brand-700 font-semibold">2 Commercial Options</span>
          </div>

          {/* 2 Commercial Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => set("model", "MONTHLY_SLAB")}
              className={clsx(
                "cursor-pointer rounded-xl border p-3 transition select-none flex flex-col justify-between",
                v.model === "MONTHLY_SLAB"
                  ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                  : "border-ink-200 bg-white hover:border-brand-300"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                    <span
                      className={clsx(
                        "h-2.5 w-2.5 rounded-full ring-2",
                        v.model === "MONTHLY_SLAB" ? "bg-brand-600 ring-brand-200" : "bg-ink-300 ring-transparent"
                      )}
                    />
                    Monthly Member Slab
                  </span>
                  <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-bold">
                    All Modules Included
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-600 leading-relaxed">
                  Billed strictly as <b>Members × Slab Rate</b> (₹3.5 to ₹5/member/mo). All 19+ modules included with no add-on charges.
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-ink-100 text-[10px] font-semibold text-brand-700 flex items-center gap-1">
                {v.model === "MONTHLY_SLAB" && <Check size={12} className="stroke-[3]" />}
                <span>{v.model === "MONTHLY_SLAB" ? "Active Model · All Modules Covered" : "Select Monthly Slab Model"}</span>
              </div>
            </div>

            <div
              onClick={() => set("model", "MODULE_WISE")}
              className={clsx(
                "cursor-pointer rounded-xl border p-3 transition select-none flex flex-col justify-between",
                v.model === "MODULE_WISE"
                  ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                  : "border-ink-200 bg-white hover:border-brand-300"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                    <span
                      className={clsx(
                        "h-2.5 w-2.5 rounded-full ring-2",
                        v.model === "MODULE_WISE" ? "bg-brand-600 ring-brand-200" : "bg-ink-300 ring-transparent"
                      )}
                    />
                    Module-Wise Plan
                  </span>
                  <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[10px] font-bold">
                    Custom Add-ons
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-600 leading-relaxed">
                  <b>No per-member SaaS multiplier.</b> Pay flat ₹5,000 – ₹10,000/mo per selected module.
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-ink-100 text-[10px] font-semibold text-purple-700 flex items-center gap-1">
                {v.model === "MODULE_WISE" && <Check size={12} className="stroke-[3]" />}
                <span>{v.model === "MODULE_WISE" ? "Active Model · Select Modules Below" : "Select Module-Wise Model"}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {num("members", "Total Members")}
            {num("branches", "Branches", 1)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            {sel("hosting", "Cloud Hosting", ["SHARED", "DEDICATED"])}
            {sel("sla", "Support SLA", ["STANDARD", "PRIORITY", "PREMIUM"])}
            {sel("txnVolume", "Transaction Volume", ["LOW", "MEDIUM", "HIGH"])}
          </div>
        </div>

        {/* 2. One-Time Setup & Migration (3 Levels) */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                <Wrench size={14} className="text-brand-600" />
                <span>2. One-Time Setup & Migration (3 Tiers)</span>
              </div>
              <p className="text-[11px] text-ink-500 mt-0.5">
                Pre-configured 3 levels: ₹50k, ₹1 Lakh, or ₹1.5 Lakh depending on member size.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              {activeTierKey === "LEVEL_1" ? "Level 1: ₹50,000" : activeTierKey === "LEVEL_2" ? "Level 2: ₹1,00,000" : "Level 3: ₹1,50,000"}
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => set("setupLevel", v.setupLevel === "LEVEL_1" ? "AUTO" : "LEVEL_1")}
              className={clsx(
                "rounded-xl border p-3 text-left transition flex flex-col justify-between",
                activeTierKey === "LEVEL_1"
                  ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                  : "border-ink-200 bg-white hover:border-ink-300"
              )}
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-ink-900">Level 1</span>
                  <span className="font-bold text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                    ₹50,000
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-brand-700 mt-0.5">Up to 5,000 Members</div>
                <p className="text-[10px] text-ink-500 mt-1">Core deployment & ledger setup.</p>
              </div>
              <div className="mt-2 text-[10px] text-ink-400">
                {v.setupLevel === "LEVEL_1" ? "Selected (Manual)" : v.members <= 5000 ? "Auto (Member Count)" : "Click to select"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => set("setupLevel", v.setupLevel === "LEVEL_2" ? "AUTO" : "LEVEL_2")}
              className={clsx(
                "rounded-xl border p-3 text-left transition flex flex-col justify-between",
                activeTierKey === "LEVEL_2"
                  ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                  : "border-ink-200 bg-white hover:border-ink-300"
              )}
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-ink-900">Level 2</span>
                  <span className="font-bold text-[10px] bg-brand-100 text-brand-800 px-1.5 py-0.2 rounded">
                    ₹1,00,000 (1L)
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-brand-700 mt-0.5">5,001–15,000 Members</div>
                <p className="text-[10px] text-ink-500 mt-1">Multi-branch migration & reconciliation.</p>
              </div>
              <div className="mt-2 text-[10px] text-ink-400">
                {v.setupLevel === "LEVEL_2" ? "Selected (Manual)" : v.members > 5000 && v.members <= 15000 ? "Auto (Member Count)" : "Click to select"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => set("setupLevel", v.setupLevel === "LEVEL_3" ? "AUTO" : "LEVEL_3")}
              className={clsx(
                "rounded-xl border p-3 text-left transition flex flex-col justify-between",
                activeTierKey === "LEVEL_3"
                  ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                  : "border-ink-200 bg-white hover:border-ink-300"
              )}
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-ink-900">Level 3</span>
                  <span className="font-bold text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded">
                    ₹1,50,000 (1.5L)
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-brand-700 mt-0.5">15,000+ Members</div>
                <p className="text-[10px] text-ink-500 mt-1">Enterprise scale & legacy CBS extraction.</p>
              </div>
              <div className="mt-2 text-[10px] text-ink-400">
                {v.setupLevel === "LEVEL_3" ? "Selected (Manual)" : v.members > 15000 ? "Auto (Member Count)" : "Click to select"}
              </div>
            </button>
          </div>
        </div>

        {/* 3. Monthly Subscription Scope (All-Inclusive vs Module-Wise) */}
        {v.model === "MONTHLY_SLAB" ? (
          <div className="card p-4 space-y-3.5 border-emerald-200 bg-emerald-50/30">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-600" />
                  <span>3. Member Slabs & Included Capabilities</span>
                </span>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  All 19+ Core & Digital modules are bundled inside the monthly member slab rate.
                </p>
              </div>
              <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[11px] font-bold">
                {calc?.ratePerMember ? `₹${calc.ratePerMember}/member/mo` : "Slab Pricing"}
              </span>
            </div>

            {/* Slabs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MEMBER_SLABS.map((s, idx) => {
                const isActive = v.members >= s.min && (s.max === null || v.members <= s.max);
                return (
                  <div
                    key={idx}
                    className={clsx(
                      "rounded-lg border p-2 text-center transition flex flex-col justify-between",
                      isActive
                        ? "border-emerald-500 bg-white shadow-xs ring-2 ring-emerald-300"
                        : "border-emerald-100 bg-emerald-50/60 opacity-80"
                    )}
                  >
                    <div className="text-[10px] font-medium text-ink-600">{s.label}</div>
                    <div className="mt-0.5 text-xs font-extrabold text-emerald-800">{s.rateText}</div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase">
                      {isActive ? (
                        <span className="text-emerald-700 flex items-center justify-center gap-0.5">
                          <Check size={9} className="stroke-[3]" /> Active
                        </span>
                      ) : (
                        <span className="text-ink-400">Slab Rate</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formula line */}
            <div className="rounded-lg bg-white border border-emerald-200 p-2 text-xs flex items-center justify-between">
              <span className="text-ink-800">
                <b>Monthly Subscription:</b> {v.members.toLocaleString("en-IN")} members × ₹{calc?.ratePerMember ?? 5} ={" "}
                <span className="font-bold text-emerald-800">{inr(calc?.monthly ?? (v.members * 5))}/mo</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ✓ All Modules Included
              </span>
            </div>

            {/* Roster of included modules */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {displayModules.map((m) => (
                <div
                  key={m.value}
                  className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-2 py-1 text-[11px]"
                >
                  <span className="font-medium text-ink-800 truncate pr-1">{m.label}</span>
                  <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                    Included
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-brand-600" />
                  <span>3. Modules in Scope (₹5,000 – ₹10,000/mo)</span>
                </div>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Add or remove modules. No per-member slab multiplier is charged in this model.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "modules",
                      Array.from(
                        new Set([
                          ...v.modules,
                          ...p.modules
                            .filter((m) => m.category === "DIGITAL" || m.category === "INTEGRATION")
                            .map((m) => m.value),
                        ])
                      )
                    )
                  }
                  className="rounded border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-700 hover:bg-ink-100"
                >
                  + Add Digital Pack
                </button>
                <button
                  type="button"
                  onClick={() => set("modules", [])}
                  className="rounded border border-ink-200 px-2 py-0.5 text-[11px] font-medium text-ink-500 hover:text-red-600"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
              {displayModules.map((m) => {
                const on = v.modules.includes(m.value);
                const priceTag = m.price ? `+${inr(m.price)}/mo` : "Included";
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() =>
                      set(
                        "modules",
                        on ? v.modules.filter((x) => x !== m.value) : [...v.modules, m.value]
                      )
                    }
                    className={clsx(
                      "flex items-center justify-between rounded-xl border p-2.5 text-left transition select-none",
                      on
                        ? "border-brand-500 bg-brand-50/70 shadow-2xs"
                        : "border-ink-200 bg-white hover:border-brand-300"
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="text-xs font-bold text-ink-900 truncate">{m.label}</div>
                      <div className="text-[10px] text-ink-500 uppercase tracking-wider">{m.category}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          on ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700"
                        )}
                      >
                        {priceTag}
                      </span>
                      <span
                        className={clsx(
                          "flex h-5 w-5 items-center justify-center rounded-md text-xs",
                          on ? "bg-emerald-600 text-white" : "bg-ink-100 text-ink-500"
                        )}
                      >
                        {on ? <Check size={12} className="stroke-[3]" /> : <Plus size={12} />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-ink-600 bg-ink-50 rounded-lg p-2">
              <span>
                <b>{v.modules.length}</b> module(s) selected
              </span>
              <span className="font-semibold text-brand-700">
                Monthly Module Fee: +{inr(calc?.monthly || 0)}/mo
              </span>
            </div>
          </div>
        )}

        {/* 4. Dual Discounts (Monthly SaaS & Setup Migration) */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
              <Percent size={14} className="text-brand-600" />
              <span>4. Dual Commercial Discounts</span>
            </span>
            <span className="text-[11px] text-ink-500">Above {p.maxDiscount}% needs approval</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-ink-800">Monthly SaaS Discount</label>
                <span className="font-mono font-bold text-xs text-brand-700">{v.discountPct}%</span>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="input font-mono font-medium"
                value={v.discountPct}
                onChange={(e) => set("discountPct", Number(e.target.value))}
              />
              <span className="text-[10px] text-ink-400 mt-0.5 block">
                Net Monthly: {inr(calc?.monthlyAfterDiscount || 0)} / mo
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-ink-800">Setup & Migration Discount</label>
                <span className="font-mono font-bold text-xs text-purple-700">{v.setupDiscountPct}%</span>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="input font-mono font-medium"
                value={v.setupDiscountPct}
                onChange={(e) => set("setupDiscountPct", Number(e.target.value))}
              />
              <span className="text-[10px] text-ink-400 mt-0.5 block">
                Net Setup: {inr(calc?.setupMigrationAfterDiscount || 50000)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Scope & Terms */}
        <div className="card p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-700 border-b border-ink-100 pb-2">
            5. Scope Statement & Commercial Milestones
          </div>
          <div>
            <label className="lbl">Scope Statement (Shown on Proposal PDF)</label>
            <textarea
              className="input min-h-[60px] text-xs"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Leave blank for an auto-generated comprehensive scope line"
            />
          </div>
          <div>
            <label className="lbl">Commercial Terms</label>
            <textarea
              className="input min-h-[90px] text-xs"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
            <span className="text-xs font-semibold text-brand-900 block mb-0.5">Implementation Payment Terms</span>
            <span className="text-xs text-brand-700">100% Full Payment upon signing (One-Time Setup & Migration upfront)</span>
          </div>
          {calc?.needsApproval && (
            <div>
              <label className="lbl font-bold text-amber-900">Justification for Approval</label>
              <textarea
                className="input text-xs border-amber-300 bg-amber-50/50"
                value={just}
                onChange={(e) => setJust(e.target.value)}
                placeholder="Why this price? Competitive pressure, reference customer, board strategic fit…"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN (5 COLS): Sticky Calculation & Quotation Submission ── */}
      <div className="lg:col-span-5">
        <div className="card sticky top-16 space-y-3 p-5 text-sm shadow-md border-brand-200">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink-900">Commercial Calculation</h2>
              {calculating && <Loader2 size={14} className="animate-spin text-brand-600" />}
            </div>
            <span className="text-xs text-ink-500 font-mono">
              {calculating
                ? "Calculating…"
                : calc
                ? calc.model === "MONTHLY_SLAB"
                  ? "Monthly Member Slab"
                  : "Module-Wise Plan"
                : "Calculating…"}
            </span>
          </div>

          {calc ? (
            <>
              <div className="text-xs text-ink-500">
                {calc.model === "MONTHLY_SLAB"
                  ? `Rate slab: ₹${calc.ratePerMember}/member/month (all modules included)`
                  : `Module-wise flat pricing · ${calc.lines.filter((l: any) => l.kind === "MONTHLY").length} module(s)`}
              </div>

              {/* Line items preview */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                {calc.lines.map((l: any, idx: number) => (
                  <div key={idx} className="flex justify-between gap-2 py-0.5">
                    <span className="text-ink-700 leading-snug">
                      {l.name}
                      {l.kind === "ONE_TIME" && (
                        <span className="text-purple-600 font-semibold"> (One-Time)</span>
                      )}
                    </span>
                    <span className="tabular-nums font-mono font-medium">{inr(l.amount)}</span>
                  </div>
                ))}
              </div>

              <hr className="border-ink-100" />

              {/* Monthly breakdown */}
              <div className="space-y-1.5 text-xs">
                <Row k="Monthly SaaS (List)" v={inr(calc.monthly)} />
                {calc.discountPct > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Monthly Discount ({calc.discountPct}%)</span>
                    <span className="font-mono">- {inr(calc.monthlyDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-brand-700 rounded-lg bg-brand-50 p-2 border border-brand-200">
                  <span>Net Monthly SaaS</span>
                  <span className="font-mono">{inr(calc.monthlyAfterDiscount)} / mo</span>
                </div>
              </div>

              {/* One-Time Setup breakdown */}
              <div className="space-y-1.5 text-xs pt-1">
                <Row k="One-Time Setup & Migration (List)" v={inr(calc.setupMigrationFee)} />
                {calc.setupDiscountPct > 0 && (
                  <div className="flex justify-between text-purple-700 font-medium">
                    <span>Setup Discount ({calc.setupDiscountPct}%)</span>
                    <span className="font-mono">- {inr(calc.setupDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-purple-900 rounded-lg bg-purple-50 p-2 border border-purple-200">
                  <span>Net Setup & Migration (One-Time)</span>
                  <span className="font-mono">{inr(calc.setupMigrationAfterDiscount)}</span>
                </div>
              </div>

              <hr className="border-ink-100" />

              {/* Annual & First-Year Totals */}
              <div className="space-y-1.5 text-xs">
                <Row k="Annual Recurring (ARR)" v={inr(calc.arr)} />
                <div className="flex justify-between font-extrabold text-base text-ink-950 rounded-xl bg-ink-100/70 p-3 border border-ink-200">
                  <span>First-Year Contract Value (TCV)</span>
                  <span className="font-mono text-brand-700">{inr(calc.firstYearValue)}</span>
                </div>
              </div>

              {/* Negotiation range */}
              <div className="text-[11px] text-ink-500">
                Negotiation range: {inr(calc.negotiation.minAcceptableMonthly)} – {inr(calc.negotiation.listMonthly)}/mo
              </div>

              {/* Pilot option */}
              <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900 flex items-start gap-1.5">
                <Sparkles size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <span>Paid pilot: {inr(calc.pilot.fee)} for {calc.pilot.months} months</span>
              </div>

              {/* Approval status banner */}
              {calc.needsApproval ? (
                <div className="rounded-xl bg-amber-50 border border-amber-300 p-2.5 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-600" />
                    <span>Needs Super Admin Approval:</span>
                  </div>
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                    {calc.approvalReasons.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800 font-medium">
                  ✓ Within standard sales pricing authority.
                </div>
              )}

              <p className="text-[10px] italic text-ink-400">{calc.assumptionNote}</p>
            </>
          ) : (
            <p className="muted">Calculating…</p>
          )}

          {err && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{err}</p>}

          <button
            className="btn-primary w-full py-2.5 text-sm font-bold shadow-md hover:shadow-lg transition"
            disabled={busy || !calc}
            onClick={save}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin inline mr-1.5" />
                <span>Saving Quotation…</span>
              </>
            ) : calc?.needsApproval ? (
              "Save & Request Super Admin Approval"
            ) : (
              "Save Official Draft Quote →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, b }: { k: string; v: string; b?: boolean }) {
  return (
    <div className={clsx("flex justify-between gap-2", b && "font-semibold")}>
      <span className="text-ink-700">{k}</span>
      <span className="tabular-nums font-mono">{v}</span>
    </div>
  );
}
