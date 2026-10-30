import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { QuoteLine } from "@/db/schema";
import { allSettings } from "./settings";

/**
 * Editable pricing engine. Every number comes from Settings / Pricing slabs / Product catalogue,
 * all of which the Super Admin can change. Outputs are recommendations, not verified market rates.
 */

export type PricingInput = {
  members: number | null; branches: number | null; modules?: string[];
  model?: "AUTO" | "MEMBER" | "BRANCH" | "ENTERPRISE";
  migration?: "NONE" | "LOW" | "MEDIUM" | "HIGH"; integrations?: number; trainingDays?: number;
  hosting?: "SHARED" | "DEDICATED"; sla?: "STANDARD" | "PRIORITY" | "PREMIUM"; txnVolume?: "LOW" | "MEDIUM" | "HIGH";
  discountPct?: number;
};

export type PricingResult = {
  model: "MEMBER" | "BRANCH" | "ENTERPRISE"; members: number; branches: number;
  ratePerMember: number; lines: QuoteLine[];
  monthly: number; monthlyAfterDiscount: number; discountPct: number;
  implementation: number; migration: number; oneTime: number;
  arr: number; firstYearValue: number;
  negotiation: { listMonthly: number; minAcceptableMonthly: number };
  effectiveRate: number | null; needsApproval: boolean; approvalReasons: string[];
  pilot: { months: number; branches: number; fee: number; note: string };
  rationale: string[]; commercialModel: string; assumptionNote: string;
};

const r2 = (n: number) => Math.round(n);

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
  const listRate = N("pricing.listRate"), floorRate = N("pricing.floorRate"), minMonthly = N("pricing.minMonthly");
  const members = Math.max(0, input.members ?? 0), branches = Math.max(1, input.branches ?? 1);
  const rationale: string[] = []; const lines: QuoteLine[] = [];

  let model = input.model && input.model !== "AUTO" ? input.model : undefined;
  if (!model) {
    if (members >= N("pricing.enterpriseMembers") || branches >= N("pricing.enterpriseBranches")) { model = "ENTERPRISE"; rationale.push("Enterprise model: size above enterprise threshold"); }
    else if (!members) { model = "BRANCH"; rationale.push("Branch model: member count not verified"); }
    else { model = "MEMBER"; rationale.push("Member-based model"); }
  }

  const rate = s.get("pricing.useSlabs") ? slabRate(members, slabs, listRate) : listRate;
  let monthly = 0;
  if (model === "BRANCH") {
    const base = N("pricing.branchBaseMonthly"), per = N("pricing.branchMonthly");
    lines.push({ key: "platform", name: `Platform subscription (${branches} branch${branches > 1 ? "es" : ""})`, kind: "MONTHLY", amount: base + per * branches });
    monthly += base + per * branches;
  } else {
    const fee = Math.max(minMonthly, rate * members);
    lines.push({ key: "platform", name: `Core platform — ${members.toLocaleString("en-IN")} members × ₹${rate}/member`, kind: "MONTHLY", amount: r2(fee), note: fee === minMonthly ? "Minimum monthly billing applies" : undefined });
    monthly += fee;
    if (rate < listRate) rationale.push(`Volume slab rate ₹${rate} vs list ₹${listRate}`);
    if (model === "ENTERPRISE") {
      const up = (s.get("pricing.txnVolumeUpliftPct") as Record<string, number>)?.[input.txnVolume ?? "LOW"] ?? 0;
      if (up) { lines.push({ key: "txn", name: `Transaction volume uplift (${up}%)`, kind: "MONTHLY", amount: r2(fee * up / 100) }); monthly += fee * up / 100; }
    }
  }

  for (const key of input.modules ?? []) {
    const m = modules.find((x) => x.key === key);
    if (!m || m.pricingType === "INCLUDED" || m.pricingType === "ONE_TIME") continue;
    const amt = m.pricingType === "PER_MEMBER" ? m.price * members : m.pricingType === "PER_BRANCH" ? m.price * branches : m.price;
    if (amt > 0) { lines.push({ key: m.key, name: m.name, kind: "MONTHLY", amount: r2(amt) }); monthly += amt; }
  }
  if (input.hosting === "DEDICATED") { const h = N("pricing.dedicatedHostingMonthly"); lines.push({ key: "hosting", name: "Dedicated hosting", kind: "MONTHLY", amount: h }); monthly += h; }
  const slaPct = (s.get("pricing.slaPremiumPct") as Record<string, number>)?.[input.sla ?? "STANDARD"] ?? 0;
  if (slaPct) { const a = monthly * slaPct / 100; lines.push({ key: "sla", name: `${input.sla} SLA (${slaPct}%)`, kind: "MONTHLY", amount: r2(a) }); monthly += a; }

  // one-time
  const impl = N("pricing.implBase") + N("pricing.implPerBranch") * branches
    + (input.integrations ?? 0) * N("pricing.integrationEach") + (input.trainingDays ?? 0) * N("pricing.trainingPerDay");
  lines.push({ key: "impl", name: "Implementation & configuration", kind: "ONE_TIME", amount: r2(impl) });
  let oneTimeModules = 0;
  for (const key of input.modules ?? []) {
    const m = modules.find((x) => x.key === key);
    if (m?.pricingType === "ONE_TIME" && m.price > 0) { lines.push({ key: m.key, name: m.name, kind: "ONE_TIME", amount: m.price }); oneTimeModules += m.price; }
  }
  const mult = (s.get("pricing.migrationMultiplier") as Record<string, number>)?.[input.migration ?? "NONE"] ?? 0;
  const migration = mult ? (N("pricing.migrationBase") + N("pricing.migrationPerBranch") * branches) * mult : 0;
  if (migration) lines.push({ key: "migration", name: `Legacy data migration (${input.migration} complexity)`, kind: "ONE_TIME", amount: r2(migration) });

  const discountPct = Math.max(0, Math.min(100, input.discountPct ?? 0));
  const monthlyAfter = monthly * (1 - discountPct / 100);
  const listMonthly = model === "BRANCH" ? monthly : Math.max(minMonthly, listRate * members) + (monthly - lines.filter((l) => l.key === "platform")[0].amount);
  const floorMonthly = model === "BRANCH" ? monthly * (floorRate / listRate) : Math.max(minMonthly, floorRate * members) + (monthly - lines.filter((l) => l.key === "platform")[0].amount);
  const minAcceptable = Math.max(minMonthly, floorMonthly);
  const effectiveRate = members ? (monthlyAfter - (monthly - lines.filter((l) => l.key === "platform")[0].amount) * (1 - discountPct / 100)) / members : null;

  const approvalReasons: string[] = [];
  if (discountPct > N("pricing.maxDiscountNoApprovalPct")) approvalReasons.push(`Discount ${discountPct}% exceeds ${N("pricing.maxDiscountNoApprovalPct")}% limit`);
  if (monthlyAfter + 0.5 < minAcceptable) approvalReasons.push(`Monthly ₹${r2(monthlyAfter)} below minimum acceptable ₹${r2(minAcceptable)}`);
  if (effectiveRate != null && model !== "BRANCH" && effectiveRate + 0.001 < floorRate && monthlyAfter > minMonthly) approvalReasons.push(`Effective rate ₹${effectiveRate.toFixed(2)} below floor ₹${floorRate}`);

  const pilotMonths = N("pricing.pilotMonths"), pilotPct = N("pricing.pilotFeePct");
  const pilotFee = r2(Math.max(minMonthly, monthly / branches) * pilotPct / 100 * pilotMonths);
  const oneTime = impl + oneTimeModules + migration;
  const arr = monthlyAfter * 12;

  const commercialModel = model === "ENTERPRISE"
    ? "Enterprise agreement: annual subscription (billed monthly/quarterly), milestone-based implementation, defined SLA."
    : model === "BRANCH" ? "Branch-based subscription until member count is verified; convert to member pricing after data collection."
    : "Per-member monthly SaaS subscription with milestone-based implementation fee.";
  rationale.push(`Negotiate between list ₹${r2(listMonthly).toLocaleString("en-IN")}/month and floor ₹${r2(minAcceptable).toLocaleString("en-IN")}/month`);

  return {
    model, members, branches, ratePerMember: rate, lines,
    monthly: r2(monthly), monthlyAfterDiscount: r2(monthlyAfter), discountPct,
    implementation: r2(impl + oneTimeModules), migration: r2(migration), oneTime: r2(oneTime),
    arr: r2(arr), firstYearValue: r2(arr + oneTime),
    negotiation: { listMonthly: r2(listMonthly), minAcceptableMonthly: r2(minAcceptable) },
    effectiveRate: effectiveRate == null ? null : Math.round(effectiveRate * 100) / 100,
    needsApproval: approvalReasons.length > 0, approvalReasons,
    pilot: { months: pilotMonths, branches: 1, fee: pilotFee, note: `${pilotMonths}-month paid pilot on 1 branch at ${pilotPct}% of pro-rata fee, adjustable against implementation on conversion.` },
    rationale, commercialModel,
    assumptionNote: "Prices are internal recommendations from editable assumptions — not verified market rates. Third-party costs billed at actuals.",
  };
}

export async function priceFor(input: PricingInput) { return computePrice(input, await loadPricingContext()); }
