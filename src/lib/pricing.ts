import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { QuoteLine } from "@/db/schema";
import { allSettings } from "./settings";

/**
 * Editable pricing engine. Every number comes from Settings / Pricing slabs / Product catalogue,
 * all of which the Super Admin can change. Outputs are recommendations, not verified market rates.
 */

export type SetupMigrationLevel = "AUTO" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3";

export type CommercialModel = "MONTHLY_SLAB" | "MODULE_WISE";

export type PricingInput = {
  members: number | null;
  branches: number | null;
  modules?: string[];
  model?: "MONTHLY_SLAB" | "MODULE_WISE" | "AUTO" | "MEMBER" | "BRANCH" | "ENTERPRISE";
  setupLevel?: SetupMigrationLevel;
  migration?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  integrations?: number;
  trainingDays?: number;
  hosting?: "SHARED" | "DEDICATED";
  sla?: "STANDARD" | "PRIORITY" | "PREMIUM";
  txnVolume?: "LOW" | "MEDIUM" | "HIGH";
  discountPct?: number; // Monthly SaaS discount %
  setupDiscountPct?: number; // One-Time Setup & Migration discount %
};

export type PricingResult = {
  model: "MONTHLY_SLAB" | "MODULE_WISE" | "MEMBER" | "BRANCH" | "ENTERPRISE";
  modelLabel: string;
  members: number;
  branches: number;
  ratePerMember: number;
  lines: QuoteLine[];
  monthly: number;
  monthlyAfterDiscount: number;
  discountPct: number;
  monthlyDiscountAmount: number;

  setupLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
  setupTierLabel: string;
  setupMigrationFee: number;
  setupDiscountPct: number;
  setupDiscountAmount: number;
  setupMigrationAfterDiscount: number;

  implementation: number;
  migration: number;
  oneTime: number;
  arr: number;
  firstYearValue: number;

  negotiation: { listMonthly: number; minAcceptableMonthly: number };
  effectiveRate: number | null;
  needsApproval: boolean;
  approvalReasons: string[];
  pilot: { months: number; branches: number; fee: number; note: string };
  rationale: string[];
  commercialModel: string;
  assumptionNote: string;
};

const r2 = (n: number) => Math.round(n);

export function getSetupMigrationTier(members: number, level?: SetupMigrationLevel) {
  if (level === "LEVEL_1") return { key: "LEVEL_1" as const, label: "Level 1 (Up to 5,000 members)", fee: 50000 };
  if (level === "LEVEL_2") return { key: "LEVEL_2" as const, label: "Level 2 (5,001–15,000 members)", fee: 100000 };
  if (level === "LEVEL_3") return { key: "LEVEL_3" as const, label: "Level 3 (15,000+ members)", fee: 150000 };

  // AUTO based on member count
  if (members <= 5000) {
    return { key: "LEVEL_1" as const, label: "Level 1 (Up to 5,000 members)", fee: 50000 };
  } else if (members <= 15000) {
    return { key: "LEVEL_2" as const, label: "Level 2 (5,001–15,000 members)", fee: 100000 };
  } else {
    return { key: "LEVEL_3" as const, label: "Level 3 (15,000+ members)", fee: 150000 };
  }
}

export async function loadPricingContext() {
  const s = await allSettings();
  const slabs = await db.select().from(t.pricingSlabs).orderBy(asc(t.pricingSlabs.minMembers));
  const modules = await db.select().from(t.productModules).where(eq(t.productModules.active, true));
  return { s, slabs, modules };
}

export function slabRate(members: number, slabs: { minMembers: number; maxMembers: number | null; ratePerMember: number }[], fallback: number) {
  const hit = slabs.find((x) => members >= x.minMembers && (x.maxMembers == null || members <= x.maxMembers));
  return hit ? Number(hit.ratePerMember) : fallback;
}

export function computePrice(input: PricingInput, ctx: Awaited<ReturnType<typeof loadPricingContext>>): PricingResult {
  const { s, slabs, modules } = ctx;
  const N = (k: string) => Number(s.get(k));
  const listRate = N("pricing.listRate") || 5;
  const floorRate = N("pricing.floorRate") || 3;
  const minMonthly = N("pricing.minMonthly") || 5000;
  const members = Math.max(0, input.members ?? 0);
  const branches = Math.max(1, input.branches ?? 1);
  const rationale: string[] = [];
  const lines: QuoteLine[] = [];

  // Determine commercial model: either MONTHLY_SLAB (all-inclusive per member) or MODULE_WISE (selected modules only)
  const isModuleWise = input.model === "MODULE_WISE";
  const model: "MONTHLY_SLAB" | "MODULE_WISE" = isModuleWise ? "MODULE_WISE" : "MONTHLY_SLAB";
  const modelLabel = isModuleWise
    ? "Module-Wise Plan (Custom Add-ons Only)"
    : "Monthly Member Slab (All Modules Included)";

  const rate = slabRate(members, slabs, listRate);
  let monthly = 0;

  if (model === "MODULE_WISE") {
    // ── Module-Wise Model: NO member*rate multiplier ──
    // Monthly SaaS fee is strictly the sum of selected modules (each ₹5k to ₹10k/mo).
    let selectedModuleCount = 0;
    for (const key of input.modules ?? []) {
      const m = modules.find((x) => x.key === key);
      if (!m || m.pricingType === "INCLUDED" || m.pricingType === "ONE_TIME") continue;
      const amt = m.price;
      if (amt > 0) {
        lines.push({ key: m.key, name: m.name, kind: "MONTHLY", amount: r2(amt) });
        monthly += amt;
        selectedModuleCount++;
      }
    }

    if (lines.length === 0) {
      rationale.push("Module-Wise Plan: No monthly modules selected yet. Select specific modules to build your quote.");
    } else {
      rationale.push(`Module-Wise Plan: ${selectedModuleCount} module(s) selected at flat monthly pricing (no per-member SaaS multiplier).`);
    }
  } else {
    // ── Monthly Member Slab Model: ALL modules included ──
    // Monthly SaaS fee is strictly members × slab rate.
    // Modules are NOT charged individually because all modules are included in the member subscription!
    const fee = Math.max(minMonthly, rate * members);
    lines.push({
      key: "platform",
      name: `Core Banking & Full Digital Suite (All Modules Included) — ${members.toLocaleString("en-IN")} members × ₹${rate}/member/mo`,
      kind: "MONTHLY",
      amount: r2(fee),
      note: fee === minMonthly && members * rate < minMonthly
        ? `Minimum monthly billing applies (₹${minMonthly.toLocaleString("en-IN")})`
        : "Includes Core Banking, Mobile Apps, Loans, Deposits, Accounting & Integrations",
    });
    monthly += fee;
    rationale.push(`All-Inclusive Member Slab: ₹${rate}/member/mo applied for ${members.toLocaleString("en-IN")} members. All modules included.`);
  }

  if (input.hosting === "DEDICATED") {
    const h = N("pricing.dedicatedHostingMonthly") || 15000;
    lines.push({ key: "hosting", name: "Dedicated hosting infrastructure", kind: "MONTHLY", amount: h });
    monthly += h;
  }
  const slaPct = (s.get("pricing.slaPremiumPct") as Record<string, number>)?.[input.sla ?? "STANDARD"] ?? 0;
  if (slaPct) {
    const a = (monthly * slaPct) / 100;
    lines.push({ key: "sla", name: `${input.sla} SLA (${slaPct}%)`, kind: "MONTHLY", amount: r2(a) });
    monthly += a;
  }

  // ── One-Time Setup & Migration (3 Tiers: 50k, 1 Lakh, 1.5 Lakh) ──
  const setupTier = getSetupMigrationTier(members, input.setupLevel);
  lines.push({
    key: "setup_migration",
    name: `One-Time Setup & Migration (${setupTier.label})`,
    kind: "ONE_TIME",
    amount: setupTier.fee,
  });

  const setupList = setupTier.fee;

  // ── Dual Discounts ──
  // 1. Monthly SaaS discount
  const discountPct = Math.max(0, Math.min(100, input.discountPct ?? 0));
  const monthlyAfterDiscount = r2(monthly * (1 - discountPct / 100));
  const monthlyDiscountAmount = r2(monthly - monthlyAfterDiscount);

  // 2. One-Time Setup & Migration discount
  const setupDiscountPct = Math.max(0, Math.min(100, input.setupDiscountPct ?? 0));
  const setupMigrationAfterDiscount = r2(setupList * (1 - setupDiscountPct / 100));
  const setupDiscountAmount = r2(setupList - setupMigrationAfterDiscount);

  // List & floor calculations for approval logic
  const listMonthly = monthly;
  const floorMonthly = monthly * 0.7; // 30% max tolerance
  const minAcceptable = Math.max(minMonthly, floorMonthly);
  const effectiveRate = members && model === "MONTHLY_SLAB" ? monthlyAfterDiscount / members : null;

  const approvalReasons: string[] = [];
  const maxDisc = N("pricing.maxDiscountNoApprovalPct") || 10;
  if (discountPct > maxDisc) approvalReasons.push(`Monthly SaaS discount ${discountPct}% exceeds ${maxDisc}% limit`);
  if (setupDiscountPct > maxDisc) approvalReasons.push(`Setup & Migration discount ${setupDiscountPct}% exceeds ${maxDisc}% limit`);
  if (monthlyAfterDiscount + 0.5 < minAcceptable && monthly > 0) {
    approvalReasons.push(`Monthly ₹${r2(monthlyAfterDiscount)} below minimum acceptable ₹${r2(minAcceptable)}`);
  }

  const pilotMonths = N("pricing.pilotMonths") || 3;
  const pilotPct = N("pricing.pilotFeePct") || 50;
  const pilotFee = r2((Math.max(minMonthly, monthly) * pilotPct) / 100 * pilotMonths);

  const arr = monthlyAfterDiscount * 12;
  const firstYearValue = arr + setupMigrationAfterDiscount;

  const commercialModel =
    model === "MODULE_WISE"
      ? "Module-Wise Pricing: Pay flat monthly fees for only the specific modules and digital capabilities selected (no per-member SaaS multiplier)."
      : `All-Inclusive Member Slab Model: Full CBS and Digital Banking suite included at ₹${rate}/member/month.`;

  return {
    model,
    modelLabel,
    members,
    branches,
    ratePerMember: model === "MODULE_WISE" ? 0 : rate,
    lines,
    monthly: r2(monthly),
    monthlyAfterDiscount: r2(monthlyAfterDiscount),
    discountPct,
    monthlyDiscountAmount,

    setupLevel: setupTier.key,
    setupTierLabel: setupTier.label,
    setupMigrationFee: setupTier.fee,
    setupDiscountPct,
    setupDiscountAmount,
    setupMigrationAfterDiscount,

    implementation: setupMigrationAfterDiscount,
    migration: 0,
    oneTime: setupMigrationAfterDiscount,

    arr: r2(arr),
    firstYearValue: r2(firstYearValue),
    negotiation: { listMonthly: r2(listMonthly), minAcceptableMonthly: r2(minAcceptable) },
    effectiveRate: effectiveRate == null ? null : Math.round(effectiveRate * 100) / 100,
    needsApproval: approvalReasons.length > 0,
    approvalReasons,
    pilot: {
      months: pilotMonths,
      branches: 1,
      fee: pilotFee,
      note: `${pilotMonths}-month paid pilot on 1 branch at ${pilotPct}% of pro-rata fee, adjustable against Setup & Migration on conversion.`,
    },
    rationale,
    commercialModel,
    assumptionNote: "Prices are internal recommendations from editable assumptions — not verified market rates. Third-party costs billed at actuals.",
  };
}

export async function priceFor(input: PricingInput) {
  return computePrice(input, await loadPricingContext());
}
