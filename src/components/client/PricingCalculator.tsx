"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Calculator,
  Layers,
  Sparkles,
  Check,
  Plus,
  Trash2,
  FileText,
  Building2,
  Users,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Percent,
  CheckCircle2,
  Wrench,
  HelpCircle,
} from "lucide-react";

export interface ModuleItem {
  value: string;
  label: string;
  category: string;
  price: number;
  pricingType: string;
  description?: string | null;
  isCore?: boolean;
}

export interface InstitutionOption {
  id: string;
  legalName: string;
  leadCode?: string | null;
  members?: number | null;
  branches?: number | null;
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const MEMBER_SLABS = [
  { min: 0, max: 5000, rate: 5, label: "Up to 5,000 members", rateText: "₹5 / member / mo" },
  { min: 5001, max: 20000, rate: 4.5, label: "5,001–20,000 members", rateText: "₹4.5 / member / mo" },
  { min: 20001, max: 50000, rate: 4, label: "20,001–50,000 members", rateText: "₹4 / member / mo" },
  { min: 50001, max: null, rate: 3.5, label: "50,001+ members", rateText: "₹3.5 / member / mo" },
];

const SETUP_LEVELS = [
  {
    key: "AUTO",
    title: "Auto-Tier (Based on Members)",
    desc: "Automatically selects Tier based on total member scale",
    badge: "Smart Recommendation",
  },
  {
    key: "LEVEL_1",
    title: "Level 1: Up to 5,000 Members",
    fee: 50000,
    desc: "Standard deployment, cloud provisioning, master ledger setup & user training",
    badge: "₹50,000 One-Time",
  },
  {
    key: "LEVEL_2",
    title: "Level 2: 5,001–15,000 Members",
    fee: 100000,
    desc: "Multi-branch deployment, legacy CBS data migration, historical balance validation",
    badge: "₹1,00,000 (1 Lakh)",
  },
  {
    key: "LEVEL_3",
    title: "Level 3: 15,000+ Members",
    fee: 150000,
    desc: "High-volume legacy migration, custom API integration, dedicated onboarding manager",
    badge: "₹1,50,000 (1.5 Lakh)",
  },
];

export function PricingCalculator({
  members: initialMembers,
  branches: initialBranches,
  modules,
  institutions = [],
}: {
  members: number;
  branches: number;
  modules: ModuleItem[];
  institutions?: InstitutionOption[];
}) {
  const router = useRouter();

  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [members, setMembers] = useState(initialMembers || 5000);
  const [branches, setBranches] = useState(initialBranches || 3);
  const [model, setModel] = useState<"MONTHLY_SLAB" | "MODULE_WISE">("MONTHLY_SLAB");
  const [setupLevel, setSetupLevel] = useState<"AUTO" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3">("AUTO");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [setupDiscountPct, setSetupDiscountPct] = useState<number>(0);

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [calc, setCalc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  // When an institution is picked, auto-fill members and branches
  function handleSelectInstitution(instId: string) {
    setSelectedInstId(instId);
    if (!instId) return;
    const inst = institutions.find((i) => i.id === instId);
    if (inst) {
      if (inst.members && inst.members > 0) setMembers(inst.members);
      if (inst.branches && inst.branches > 0) setBranches(inst.branches);
    }
  }

  // Live calculation from server pricing engine
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/pricing/calc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            members: Number(members) || 0,
            branches: Number(branches) || 1,
            model,
            setupLevel,
            modules: selectedModules,
            discountPct: Number(discountPct) || 0,
            setupDiscountPct: Number(setupDiscountPct) || 0,
          }),
        });

        if (res.ok && !cancelled) {
          const data = await res.json();
          setCalc(data);
        }
      } catch (err) {
        console.error("Pricing calc error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [members, branches, model, setupLevel, selectedModules, discountPct, setupDiscountPct]);

  // Toggle single module
  function toggleModule(modKey: string) {
    setSelectedModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    );
  }

  // Quick preset actions
  function selectAllDigital() {
    const digitalKeys = modules.filter((m) => m.category === "DIGITAL" || m.category === "INTEGRATION").map((m) => m.value);
    setSelectedModules((prev) => Array.from(new Set([...prev, ...digitalKeys])));
  }

  function clearAllAddons() {
    setSelectedModules([]);
  }

  // Filter modules for display
  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      if (m.value === "CBS" || m.value === "MIGRATION") return false; // Handled as core base and setup
      const matchCat = activeCategory === "ALL" || m.category === activeCategory;
      const matchSearch =
        !searchQuery.trim() ||
        m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [modules, activeCategory, searchQuery]);

  // Direct Quote Creation from Calculator
  async function handleCreateQuote() {
    if (!selectedInstId) {
      setGenErr("Please select an institution / cooperative society to generate this quotation.");
      return;
    }

    setGeneratingQuote(true);
    setGenErr(null);

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId: selectedInstId,
          model,
          setupLevel,
          members: Number(members) || 0,
          branches: Number(branches) || 1,
          modules: selectedModules,
          discountPct: Number(discountPct) || 0,
          setupDiscountPct: Number(setupDiscountPct) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create quote");
      }

      router.push(`/quotes/${data.id}`);
    } catch (e: any) {
      setGenErr(e?.message || "Failed to generate quotation");
      setGeneratingQuote(false);
    }
  }

  // Active setup tier highlight
  const activeTierKey = calc?.setupLevel || (members <= 5000 ? "LEVEL_1" : members <= 15000 ? "LEVEL_2" : "LEVEL_3");

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Lead Quick-Selector & Header ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-24 shrink-0 items-center justify-center rounded-lg bg-white border border-brand-200 p-1 shadow-2xs">
            <img src="/manalix_logo.svg" alt="Manalix Technologies" className="h-8 w-auto object-contain" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">Interactive Commercial Quotation Engine</h3>
            <p className="text-xs text-ink-600">
              Configure members, modules (₹5k–₹10k/mo), 3-tier setup & migration, and dual discounts.
            </p>
          </div>
        </div>

        {institutions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-ink-700 whitespace-nowrap">Target Institution:</label>
            <select
              className="input py-1 text-xs font-medium max-w-xs bg-white"
              value={selectedInstId}
              onChange={(e) => handleSelectInstitution(e.target.value)}
            >
              <option value="">— Select from CRM Leads —</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.legalName} {i.leadCode ? `(${i.leadCode})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── LEFT COLUMN (7 COLS): Inputs, 3-Tier Setup, Modules ── */}
        <div className="space-y-6 lg:col-span-7">
          {/* Section 1: Commercial Pricing Model & Scale */}
          <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                <Users size={14} className="text-brand-600" />
                <span>1. Commercial Pricing Model</span>
              </span>
              <span className="text-[11px] text-brand-700 font-semibold">2 Commercial Options</span>
            </div>

            {/* 2 Commercial Options: Monthly Member Slab vs Module-Wise */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Monthly Member Slab (All Modules Included) */}
              <div
                onClick={() => setModel("MONTHLY_SLAB")}
                className={clsx(
                  "cursor-pointer rounded-xl border p-3.5 transition select-none flex flex-col justify-between",
                  model === "MONTHLY_SLAB"
                    ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200 shadow-2xs"
                    : "border-ink-200 bg-white hover:border-brand-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-900 flex items-center gap-2">
                      <span
                        className={clsx(
                          "h-2.5 w-2.5 rounded-full ring-2",
                          model === "MONTHLY_SLAB" ? "bg-brand-600 ring-brand-200" : "bg-ink-300 ring-transparent"
                        )}
                      />
                      Monthly Member Slab
                    </span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      All Modules Included
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-600 leading-relaxed">
                    Subscription is billed strictly as <b>Members × Slab Rate</b> (₹3.5 to ₹5/member/mo). <b>All 19+ Core & Digital modules included</b> with no separate add-on charges.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-ink-100 text-[10px] font-semibold text-brand-700 flex items-center gap-1">
                  {model === "MONTHLY_SLAB" && <Check size={12} className="stroke-[3]" />}
                  <span>{model === "MONTHLY_SLAB" ? "Active Model · All Modules Covered" : "Select Member Slab Model"}</span>
                </div>
              </div>

              {/* Option 2: Module-Wise (Custom Modules Only) */}
              <div
                onClick={() => setModel("MODULE_WISE")}
                className={clsx(
                  "cursor-pointer rounded-xl border p-3.5 transition select-none flex flex-col justify-between",
                  model === "MODULE_WISE"
                    ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200 shadow-2xs"
                    : "border-ink-200 bg-white hover:border-brand-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-900 flex items-center gap-2">
                      <span
                        className={clsx(
                          "h-2.5 w-2.5 rounded-full ring-2",
                          model === "MODULE_WISE" ? "bg-brand-600 ring-brand-200" : "bg-ink-300 ring-transparent"
                        )}
                      />
                      Module-Wise Plan
                    </span>
                    <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-bold">
                      Custom Add-ons Only
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-600 leading-relaxed">
                    <b>Zero per-member multiplier.</b> Pay flat ₹5,000 – ₹10,000/mo per selected module. Add and remove only the specific modules the client needs.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-ink-100 text-[10px] font-semibold text-purple-700 flex items-center gap-1">
                  {model === "MODULE_WISE" && <Check size={12} className="stroke-[3]" />}
                  <span>{model === "MODULE_WISE" ? "Active Model · Select Modules Below" : "Select Module-Wise Model"}</span>
                </div>
              </div>
            </div>

            {/* Inputs: Members & Branches */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
              <div>
                <label className="lbl">Total Members</label>
                <input
                  type="number"
                  min={0}
                  className="input font-mono font-medium"
                  value={members}
                  onChange={(e) => setMembers(Math.max(0, Number(e.target.value)))}
                />
                <span className="text-[10px] text-ink-400 mt-0.5 block">
                  {model === "MONTHLY_SLAB"
                    ? "Multiplies slab rate to calculate monthly subscription & setup tier"
                    : "Determines One-Time Setup & Migration tier"}
                </span>
              </div>

              <div>
                <label className="lbl">Branch Network</label>
                <input
                  type="number"
                  min={1}
                  className="input font-mono font-medium"
                  value={branches}
                  onChange={(e) => setBranches(Math.max(1, Number(e.target.value)))}
                />
                <span className="text-[10px] text-ink-400 mt-0.5 block">Branches including Head Office</span>
              </div>
            </div>
          </div>

          {/* Section 2: One-Time Setup & Migration (3 Tiers: 50k, 1L, 1.5L) */}
          <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-ink-100 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                  <Wrench size={14} className="text-brand-600" />
                  <span>2. One-Time Setup & Migration (3 Tiers)</span>
                </span>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Standardized 3 levels based on cooperative member size (₹50k, ₹1 Lakh, ₹1.5 Lakh)
                </p>
              </div>

              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                Active: {activeTierKey === "LEVEL_1" ? "Level 1 (₹50,000)" : activeTierKey === "LEVEL_2" ? "Level 2 (₹1,00,000)" : "Level 3 (₹1,50,000)"}
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {/* Level 1: 50k */}
              <button
                type="button"
                onClick={() => setSetupLevel(setupLevel === "LEVEL_1" ? "AUTO" : "LEVEL_1")}
                className={clsx(
                  "flex flex-col justify-between rounded-xl border p-3 text-left transition",
                  activeTierKey === "LEVEL_1"
                    ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                    : "border-ink-200 hover:border-ink-300 bg-white"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-900">Level 1</span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                      ₹50,000
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-brand-700">Up to 5,000 Members</div>
                  <p className="mt-1 text-[10px] text-ink-500 leading-snug">
                    Full cloud provisioning, master ledger configuration & basic data import.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-medium text-ink-400 flex items-center gap-1">
                  {activeTierKey === "LEVEL_1" && <Check size={12} className="text-brand-600" />}
                  <span>{setupLevel === "LEVEL_1" ? "Manually Selected" : members <= 5000 ? "Auto-Matched" : "Select Level 1"}</span>
                </div>
              </button>

              {/* Level 2: 1 Lakh */}
              <button
                type="button"
                onClick={() => setSetupLevel(setupLevel === "LEVEL_2" ? "AUTO" : "LEVEL_2")}
                className={clsx(
                  "flex flex-col justify-between rounded-xl border p-3 text-left transition",
                  activeTierKey === "LEVEL_2"
                    ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                    : "border-ink-200 hover:border-ink-300 bg-white"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-900">Level 2</span>
                    <span className="rounded bg-brand-100 px-1.5 py-0.2 text-[10px] font-bold text-brand-800">
                      ₹1,00,000 (1 Lakh)
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-brand-700">5,001–15,000 Members</div>
                  <p className="mt-1 text-[10px] text-ink-500 leading-snug">
                    Multi-branch migration, historical transaction records & balance sheet audit.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-medium text-ink-400 flex items-center gap-1">
                  {activeTierKey === "LEVEL_2" && <Check size={12} className="text-brand-600" />}
                  <span>{setupLevel === "LEVEL_2" ? "Manually Selected" : members > 5000 && members <= 15000 ? "Auto-Matched" : "Select Level 2"}</span>
                </div>
              </button>

              {/* Level 3: 1.5 Lakh */}
              <button
                type="button"
                onClick={() => setSetupLevel(setupLevel === "LEVEL_3" ? "AUTO" : "LEVEL_3")}
                className={clsx(
                  "flex flex-col justify-between rounded-xl border p-3 text-left transition",
                  activeTierKey === "LEVEL_3"
                    ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                    : "border-ink-200 hover:border-ink-300 bg-white"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-900">Level 3</span>
                    <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-800">
                      ₹1,50,000 (1.5 Lakh)
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-brand-700">15,000+ Members</div>
                  <p className="mt-1 text-[10px] text-ink-500 leading-snug">
                    Enterprise migration, complex legacy CBS extraction & dedicated project manager.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-medium text-ink-400 flex items-center gap-1">
                  {activeTierKey === "LEVEL_3" && <Check size={12} className="text-brand-600" />}
                  <span>{setupLevel === "LEVEL_3" ? "Manually Selected" : members > 15000 ? "Auto-Matched" : "Select Level 3"}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section 3: Monthly Plan (All-Inclusive vs Module-Wise) */}
          {model === "MONTHLY_SLAB" ? (
            /* MONTHLY_SLAB: Slabs grid, live calculation, all modules included, NO module add/remove */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>3. Member Slabs & All Included Modules</span>
                  </span>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    All modules are bundled inside the monthly member subscription. No separate add-on costs apply.
                  </p>
                </div>

                <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-bold">
                  {calc?.ratePerMember ? `₹${calc.ratePerMember} / member / mo` : "Slab Pricing"}
                </span>
              </div>

              {/* Slabs Grid with Live Highlight */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MEMBER_SLABS.map((s, idx) => {
                  const isActive = members >= s.min && (s.max === null || members <= s.max);
                  return (
                    <div
                      key={idx}
                      className={clsx(
                        "rounded-xl border p-2.5 text-center transition flex flex-col justify-between",
                        isActive
                          ? "border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-300"
                          : "border-emerald-100 bg-emerald-50/60 opacity-80"
                      )}
                    >
                      <div className="text-[11px] font-medium text-ink-600">{s.label}</div>
                      <div className="mt-1 text-sm font-extrabold text-emerald-800">{s.rateText}</div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider">
                        {isActive ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700">
                            <Check size={10} className="stroke-[3]" /> Active Tier
                          </span>
                        ) : (
                          <span className="text-ink-400">Slab Rate</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calculation formula banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-white border border-emerald-200 p-2.5 text-xs text-ink-800">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    <b>Subscription Calculation:</b> {members.toLocaleString("en-IN")} members × ₹{calc?.ratePerMember ?? 5}/member ={" "}
                    <span className="font-bold text-emerald-800">{inr(calc?.monthly ?? (members * 5))}/mo</span>
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                  ✓ 100% Modules Included (₹0 Add-on Fee)
                </span>
              </div>

              {/* Included Capabilities Roster */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Included Platform Capabilities in this Subscription:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {modules
                    .filter((m) => m.value !== "MIGRATION")
                    .map((m) => (
                      <div
                        key={m.value}
                        className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs"
                      >
                        <span className="font-medium text-ink-800 truncate pr-1 text-[11px]">{m.label}</span>
                        <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          Included
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            /* MODULE_WISE: Interactive Add & Remove Modules (5k–10k), NO per-member multiplier */
            <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-2.5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                    <Layers size={14} className="text-brand-600" />
                    <span>3. Select Modules (₹5,000 – ₹10,000/mo each)</span>
                  </span>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Click to add/remove individual modules. No per-member slab multiplier is charged in this model.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllDigital}
                    className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-100 transition"
                  >
                    + Add Digital Pack
                  </button>
                  <button
                    type="button"
                    onClick={clearAllAddons}
                    className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] font-medium text-ink-500 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Category Filter Pills & Search */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {["ALL", "CORE", "DIGITAL", "INTEGRATION"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={clsx(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                        activeCategory === cat
                          ? "bg-brand-600 text-white font-semibold shadow-2xs"
                          : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                      )}
                    >
                      {cat === "ALL"
                        ? "All Modules"
                        : cat === "CORE"
                        ? "Core Banking"
                        : cat === "DIGITAL"
                        ? "Digital Apps"
                        : "Integrations"}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Search module..."
                  className="input py-1 text-xs w-44"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Module Cards Grid */}
              <div className="grid gap-2.5 sm:grid-cols-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredModules.map((m) => {
                  const isSelected = selectedModules.includes(m.value);
                  return (
                    <div
                      key={m.value}
                      onClick={() => toggleModule(m.value)}
                      className={clsx(
                        "group relative flex flex-col justify-between rounded-xl border p-3 cursor-pointer transition select-none",
                        isSelected
                          ? "border-brand-500 bg-brand-50/50 shadow-2xs"
                          : "border-ink-200 bg-white hover:border-brand-300 hover:bg-ink-50/50"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-ink-900 group-hover:text-brand-700 transition">
                            {m.label}
                          </span>
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums shrink-0",
                              isSelected
                                ? "bg-brand-600 text-white"
                                : "bg-ink-100 text-ink-700 group-hover:bg-brand-100 group-hover:text-brand-800"
                            )}
                          >
                            +{inr(m.price)}/mo
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-ink-500 line-clamp-2 leading-relaxed">
                          {m.description || `Specialized module for ${m.label}.`}
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-ink-100/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-ink-400">
                          {m.category}
                        </span>
                        <div
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition",
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-ink-100 text-ink-600 group-hover:bg-brand-50 group-hover:text-brand-700"
                          )}
                        >
                          {isSelected ? (
                            <>
                              <Check size={12} className="stroke-[3]" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus size={12} />
                              <span>Add</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-ink-600 bg-ink-50 rounded-lg p-2.5">
                <span>
                  <b>{selectedModules.length}</b> module(s) selected
                </span>
                <span className="font-semibold text-brand-700">
                  Total Monthly Fee: +{inr(calc?.monthly || 0)}/mo
                </span>
              </div>
            </div>
          )}

          {/* Section 4: Dual Discounts (Monthly SaaS & One-Time Setup) */}
          <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                <Percent size={14} className="text-brand-600" />
                <span>4. Dual Discount Controls</span>
              </span>
              <span className="text-[11px] text-ink-500">Above 10% requires Super Admin approval</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Discount 1: Monthly SaaS */}
              <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink-800">1. Monthly SaaS Discount</label>
                  <span className="text-xs font-bold text-brand-700 font-mono">{discountPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  className="w-full accent-brand-600 cursor-pointer"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                />
                <div className="flex justify-between text-[11px] text-ink-500">
                  <span>List: {inr(calc?.monthly || 0)}/mo</span>
                  <span className="font-semibold text-emerald-700">
                    Net: {inr(calc?.monthlyAfterDiscount || 0)}/mo
                  </span>
                </div>
              </div>

              {/* Discount 2: One-Time Setup & Migration */}
              <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink-800">2. Setup & Migration Discount</label>
                  <span className="text-xs font-bold text-purple-700 font-mono">{setupDiscountPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  className="w-full accent-purple-600 cursor-pointer"
                  value={setupDiscountPct}
                  onChange={(e) => setSetupDiscountPct(Number(e.target.value))}
                />
                <div className="flex justify-between text-[11px] text-ink-500">
                  <span>List: {inr(calc?.setupMigrationFee || 50000)}</span>
                  <span className="font-semibold text-purple-700">
                    Net: {inr(calc?.setupMigrationAfterDiscount || 50000)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (5 COLS): Real-Time Calculation & Quote Generation ── */}
        <div className="lg:col-span-5">
          <div className="sticky top-16 rounded-2xl border border-brand-200 bg-white p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-ink-900">Commercial Summary</h3>
                <span className="text-xs text-ink-500">
                  {calc
                    ? calc.model === "MONTHLY_SLAB"
                      ? `Monthly Member Slab · ₹${calc.ratePerMember}/member/mo`
                      : `Module-Wise Plan · ${calc.lines.filter((l: any) => l.kind === "MONTHLY").length} module(s)`
                    : "Calculating…"}
                </span>
              </div>
              {loading && <Loader2 size={16} className="animate-spin text-brand-600" />}
            </div>

            {calc ? (
              <div className="space-y-3.5 text-xs">
                {/* Itemized Line Items */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div className="font-bold text-ink-700 uppercase tracking-wider text-[10px]">
                    Quotation Line Items
                  </div>
                  {calc.lines.map((l: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between gap-2 py-0.5">
                      <span className="text-ink-700 leading-snug">
                        {l.name}
                        {l.kind === "ONE_TIME" && (
                          <span className="text-purple-600 font-semibold"> (One-Time)</span>
                        )}
                      </span>
                      <span className="font-mono font-medium text-ink-900 shrink-0">
                        {inr(l.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <hr className="border-ink-100" />

                {/* Subtotals & Net Figures */}
                <div className="space-y-2">
                  <div className="flex justify-between text-ink-600">
                    <span>Monthly SaaS (List Price)</span>
                    <span className="font-mono">{inr(calc.monthly)}</span>
                  </div>

                  {calc.discountPct > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Monthly Discount ({calc.discountPct}%)</span>
                      <span className="font-mono">- {inr(calc.monthlyDiscountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-bold text-brand-700 rounded-lg bg-brand-50/70 p-2 border border-brand-200">
                    <span>Net Monthly Subscription</span>
                    <span className="font-mono">{inr(calc.monthlyAfterDiscount)} / mo</span>
                  </div>

                  <div className="flex justify-between text-ink-600 pt-1">
                    <span>One-Time Setup & Migration (List)</span>
                    <span className="font-mono">{inr(calc.setupMigrationFee)}</span>
                  </div>

                  {calc.setupDiscountPct > 0 && (
                    <div className="flex justify-between text-purple-700 font-medium">
                      <span>Setup Discount ({calc.setupDiscountPct}%)</span>
                      <span className="font-mono">- {inr(calc.setupDiscountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-bold text-purple-900 rounded-lg bg-purple-50 p-2 border border-purple-200">
                    <span>Net Setup & Migration (One-Time)</span>
                    <span className="font-mono">{inr(calc.setupMigrationAfterDiscount)}</span>
                  </div>
                </div>

                <hr className="border-ink-100" />

                {/* Big Totals */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-ink-600">
                    <span>Annual Recurring Revenue (ARR)</span>
                    <span className="font-bold font-mono text-ink-900">{inr(calc.arr)}</span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-ink-950 rounded-xl bg-ink-100/70 p-3 border border-ink-200">
                    <span>First-Year Contract Value (TCV)</span>
                    <span className="font-mono text-brand-700">{inr(calc.firstYearValue)}</span>
                  </div>
                </div>

                {/* Paid Pilot Option */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                  <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Paid Pilot Option:</span> {inr(calc.pilot.fee)} for {calc.pilot.months} months on 1 branch (adjustable against One-Time Setup fee).
                  </div>
                </div>

                {/* Super Admin Approval Notice */}
                {calc.needsApproval && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 text-xs flex items-start gap-2">
                    <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Requires Super Admin Approval:</div>
                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[11px]">
                        {calc.approvalReasons.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {genErr && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    {genErr}
                  </div>
                )}

                {/* Quotation Generation Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={generatingQuote || loading}
                    onClick={handleCreateQuote}
                    className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition active:scale-98"
                  >
                    {generatingQuote ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating Official Quotation…</span>
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        <span>
                          {selectedInstId ? "Create Official Quotation →" : "Pick Lead & Create Quotation →"}
                        </span>
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center text-[10px] text-ink-400">
                    Generates official PDF-ready quote record in Fivopay CRM database.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-ink-400">Calculating commercial model…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
