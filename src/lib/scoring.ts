import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import type { ScoreLine } from "@/db/schema";
import { allSettings } from "./settings";

/**
 * Transparent, rule-based lead scoring out of 100.
 * Each parameter yields a fraction (0..1) × its configured max, with a written reason and
 * a list of missing information. Unknown data scores 0 — it is never assumed.
 * MANUAL parameters (added by the Super Admin) take the analyst's 0..max input.
 * Total is normalised to 100 so parameters can be added or re-weighted freely.
 */

const REPLACEMENT = ["REPLACEMENT_REQUIREMENT", "VENDOR_DISSATISFACTION", "CONTRACT_EXPIRY", "CBS_TENDER"];
const BUYING = ["CBS_TENDER", "DIGITAL_TRANSFORMATION", "BRANCH_EXPANSION", "MEMBERSHIP_GROWTH", "NEW_MANAGEMENT",
  "TECH_RECRUITMENT", "NEW_MOBILE_APP", "DIGITAL_SERVICES", "REGULATORY_AUDIT", "MERGER", "TECH_PARTNERSHIP"];
export const SIGNAL_TYPES = [...new Set([...REPLACEMENT, ...BUYING])];
export const EMPLOYEE_TYPES = ["EMPLOYEE_CREDIT", "SALARY_EARNERS", "INDUSTRIAL_EMPLOYEE", "GOVT_EMPLOYEE", "POLICE_DEFENCE", "TEACHERS", "TRANSPORT_EMPLOYEE", "EDU_EMPLOYEE"];

type Inst = typeof t.institutions.$inferSelect;
type Sig = typeof t.signals.$inferSelect;
type Con = typeof t.contacts.$inferSelect;

const W = { HIGH: 1, MEDIUM: 0.6, LOW: 0.3 } as const;
const C = { HIGH: 1, MEDIUM: 0.8, LOW: 0.5 } as const;
const CR = 1e7; // ₹ 1 crore

function step(v: number, table: [number, number][]) { for (const [min, f] of table) if (v >= min) return f; return 0; }

export type ScoreInput = { inst: Inst; typeKey: string; typePrimary: boolean; districtLaunched: boolean; signals: Sig[]; contacts: Con[]; engaged: boolean };

export function scoreInstitution(input: ScoreInput, params: { key: string; name: string; maxScore: number; kind: string }[], s: Map<string, unknown>) {
  const { inst: i, signals, contacts } = input;
  const recencyMonths = Number(s.get("scoring.signalRecencyMonths") ?? 12);
  const cutoff = Date.now() - recencyMonths * 30 * 864e5;
  const sw = (x: Sig) => W[x.strength] * C[x.confidence] * (x.signalDate && x.signalDate.getTime() < cutoff ? 0.5 : 1);

  const rules: Record<string, () => { f: number; reason: string; missing?: string[] }> = {
    size: () => {
      const m = i.activeMembers ?? i.totalMembers;
      if (m == null) return { f: 0, reason: "Member count not publicly verified", missing: ["Member count"] };
      const f = step(m, [[50000, 1], [20000, 0.8], [10000, 0.65], [5000, 0.5], [2000, 0.35], [500, 0.2], [0, 0.1]]);
      return { f, reason: `${m.toLocaleString("en-IN")} members` };
    },
    branches: () => {
      if (i.branchCount == null) return { f: 0, reason: "Branch count not publicly verified", missing: ["Branch count"] };
      const f = step(i.branchCount, [[20, 1], [10, 0.8], [5, 0.6], [3, 0.45], [2, 0.3], [1, 0.15]]);
      return { f, reason: `${i.branchCount} branch(es)` };
    },
    tech_gap: () => {
      const checks: [keyof Inst, string, number][] = [
        ["centralisedCbs", "no centralised multi-branch CBS", 0.2], ["mobileApp", "no member mobile app", 0.2],
        ["ekyc", "no eKYC", 0.15], ["upiIntegration", "no UPI/payment integration", 0.15],
        ["internetBanking", "no internet banking", 0.1], ["digitalLoans", "no digital loan processing", 0.1],
      ];
      let f = 0; const gaps: string[] = []; const missing: string[] = [];
      for (const [k, txt, w] of checks) {
        if (i[k] === "NO") { f += w; gaps.push(txt); } else if (i[k] === "UNKNOWN") missing.push(txt.replace(/^no /, "") + " status");
      }
      if (i.legacyEvidence) { f += 0.1; gaps.push("legacy software evidence"); }
      if (i.hosting === "ON_PREMISE") { f += 0.1; gaps.push("on-premise hosting"); }
      return { f: Math.min(1, f), reason: gaps.length ? `Evidenced gaps: ${gaps.join(", ")}` : "No technology gap evidenced", missing };
    },
    cbs_replacement: () => {
      const rel = signals.filter((x) => REPLACEMENT.includes(x.type));
      let f = rel.reduce((a, x) => a + sw(x), 0);
      const why = rel.map((x) => x.type.replace(/_/g, " ").toLowerCase());
      if (i.techComplaints) { f += 0.3; why.push("public technology complaints"); }
      if (i.contractRenewal) { f += 0.3; why.push("contract renewal noted"); }
      const missing = i.vendorClass === "UNKNOWN" ? ["Current CBS vendor"] : [];
      return { f: Math.min(1, f), reason: why.length ? `Evidence: ${why.join(", ")}` : "No replacement or dissatisfaction signal evidenced", missing };
    },
    buying_signal: () => {
      const rel = signals.filter((x) => BUYING.includes(x.type));
      const f = Math.min(1, rel.reduce((a, x) => a + sw(x), 0) * 0.5);
      return { f, reason: rel.length ? `${rel.length} buying signal(s): ${[...new Set(rel.map((x) => x.type.replace(/_/g, " ").toLowerCase()))].join(", ")}` : "No active buying signal evidenced" };
    },
    dm_access: () => {
      const dms = contacts.filter((c) => c.isDecisionMaker || c.isFinalApprover || ["CHAIRMAN", "CEO_MD", "SECRETARY", "GENERAL_MANAGER"].includes(c.role));
      const reach = (c: Con) => !!(c.businessPhone || c.businessEmail);
      let f = 0; let reason = "No decision-maker or official contact identified";
      if (dms.some((c) => c.verification === "VERIFIED" && reach(c))) { f = 1; reason = "Verified decision-maker contact"; }
      else if (dms.some(reach)) { f = 0.7; reason = "Decision-maker contact known (unverified)"; }
      else if (dms.length) { f = 0.5; reason = "Decision-maker name known, no direct business contact"; }
      else if (i.landline || i.mobile || i.email) { f = i.contactVerification === "VERIFIED" ? 0.4 : 0.25; reason = "Only official institutional contact available"; }
      if (input.engaged) { f = Math.max(f, 0.8); reason += "; already engaged (connected / DM reached)"; }
      return { f, reason, missing: dms.length ? [] : ["Decision-maker identity"] };
    },
    financial: () => {
      const v = i.totalDeposits ?? i.totalAssets;
      if (v == null) return { f: 0, reason: "Deposits / assets not publicly verified", missing: ["Deposits or total assets"] };
      const f = step(v, [[500 * CR, 1], [100 * CR, 0.8], [25 * CR, 0.6], [5 * CR, 0.4], [1, 0.2]]);
      return { f, reason: `${i.totalDeposits != null ? "Deposits" : "Assets"} ₹${(v / CR).toFixed(1)} Cr${i.financialYear ? ` (FY ${i.financialYear})` : ""}` };
    },
    strategic_fit: () => {
      let f = 0; const why: string[] = [];
      if (input.typePrimary) { f += 0.5; why.push("primary credit-society segment"); }
      if (input.districtLaunched) { f += 0.1; why.push("launched district"); }
      if ((i.branchCount ?? 0) >= 2) { f += 0.1; why.push("multi-branch"); }
      if (i.shariahInterest) { f += 0.15; why.push("ethical/Shariah interest"); }
      if (EMPLOYEE_TYPES.includes(input.typeKey)) { f += 0.15; why.push("employee-society vertical"); }
      if (i.tags.includes("reference")) { f += 0.15; why.push("potential reference account"); }
      return { f: Math.min(1, f), reason: why.length ? why.join(", ") : "Outside primary segment" };
    },
  };

  const lines: ScoreLine[] = [];
  const missingAll = new Set<string>();
  for (const p of params) {
    if (p.kind === "MANUAL") {
      const v = i.manualScores?.[p.key];
      if (v == null) { missingAll.add(`${p.name} (manual input)`); lines.push({ key: p.key, name: p.name, max: p.maxScore, points: 0, reason: "Not yet assessed", missing: [p.name] }); }
      else lines.push({ key: p.key, name: p.name, max: p.maxScore, points: Math.max(0, Math.min(p.maxScore, Number(v))), reason: "Analyst assessment" });
      continue;
    }
    const rule = rules[p.key];
    if (!rule) continue;
    const r = rule();
    (r.missing ?? []).forEach((m) => missingAll.add(m));
    lines.push({ key: p.key, name: p.name, max: p.maxScore, points: Math.round(r.f * p.maxScore * 10) / 10, reason: r.reason, missing: r.missing });
  }
  const max = lines.reduce((a, l) => a + l.max, 0) || 100;
  const score = Math.round((lines.reduce((a, l) => a + l.points, 0) / max) * 100);
  const bands = (s.get("scoring.bands") as Record<string, number>) ?? { HOT: 75, WARM: 55, NURTURE: 35 };
  const band = score >= bands.HOT ? "HOT" : score >= bands.WARM ? "WARM" : score >= bands.NURTURE ? "NURTURE" : "LOW";
  return { score, band, lines, missing: [...missingAll], category: opportunityCategory(input, s, band) };
}

export const OPPORTUNITY_CATEGORIES: Record<string, string> = {
  GREENFIELD_CBS: "Greenfield CBS", CBS_REPLACEMENT: "CBS replacement", DIGITAL_MODULE_SALE: "Digital module sale",
  MEMBER_APP: "Member application", EKYC_ONBOARDING: "eKYC / onboarding", PAYMENT_INTEGRATION: "Payment integration",
  ENTERPRISE_ACCOUNT: "Enterprise account", STRATEGIC_PARTNERSHIP: "Strategic partnership", NOT_QUALIFIED: "Not currently qualified",
};

function opportunityCategory({ inst: i, signals }: ScoreInput, s: Map<string, unknown>, band: string) {
  if (i.tags.includes("partner")) return "STRATEGIC_PARTNERSHIP";
  const members = i.activeMembers ?? i.totalMembers ?? 0;
  if (members >= Number(s.get("pricing.enterpriseMembers")) || (i.branchCount ?? 0) >= Number(s.get("pricing.enterpriseBranches"))) return "ENTERPRISE_ACCOUNT";
  if (signals.some((x) => REPLACEMENT.includes(x.type)) || i.techComplaints) return "CBS_REPLACEMENT";
  if (i.vendorClass === "NONE_IDENTIFIED" && i.centralisedCbs === "NO") return "GREENFIELD_CBS";
  const hasCbs = i.vendorClass === "CONFIRMED_INCUMBENT" || i.vendorClass === "PROBABLE_INCUMBENT" || i.centralisedCbs === "YES";
  if (hasCbs && i.mobileApp === "NO") return "MEMBER_APP";
  if (i.ekyc === "NO") return "EKYC_ONBOARDING";
  if (i.upiIntegration === "NO") return "PAYMENT_INTEGRATION";
  if (hasCbs && band !== "LOW") return "DIGITAL_MODULE_SALE";
  return "NOT_QUALIFIED";
}

/** Recompute and persist scores for the given institutions (or all). */
export async function rescore(ids?: string[]) {
  const s = await allSettings();
  const params = await db.select().from(t.scoringParameters).where(eq(t.scoringParameters.active, true)).orderBy(t.scoringParameters.sortOrder);
  const where = ids ? and(inArray(t.institutions.id, ids), isNull(t.institutions.deletedAt)) : isNull(t.institutions.deletedAt);
  const insts = await db.select().from(t.institutions).where(where);
  if (!insts.length) return 0;
  const types = new Map((await db.select().from(t.institutionTypes)).map((x) => [x.id, x]));
  const dists = new Map((await db.select().from(t.districts)).map((x) => [x.id, x]));
  const chunk = 500;
  for (let k = 0; k < insts.length; k += chunk) {
    const part = insts.slice(k, k + chunk); const pid = part.map((x) => x.id);
    const sigs = await db.select().from(t.signals).where(inArray(t.signals.institutionId, pid));
    const cons = await db.select().from(t.contacts).where(inArray(t.contacts.institutionId, pid));
    const eng = await db.selectDistinct({ id: t.activities.institutionId }).from(t.activities)
      .where(and(inArray(t.activities.institutionId, pid), eq(t.activities.decisionMakerReached, true)));
    const engaged = new Set(eng.map((e) => e.id));
    for (const inst of part) {
      const ty = types.get(inst.typeId);
      const r = scoreInstitution({
        inst, typeKey: ty?.key ?? "", typePrimary: !!ty?.isPrimary, districtLaunched: !!dists.get(inst.districtId)?.launched,
        signals: sigs.filter((x) => x.institutionId === inst.id), contacts: cons.filter((x) => x.institutionId === inst.id), engaged: engaged.has(inst.id),
      }, params, s);
      await db.update(t.institutions).set({ score: r.score, scoreBand: r.band, scoreBreakdown: r.lines, missingInfo: r.missing, opportunityCategory: r.category, scoredAt: new Date() })
        .where(eq(t.institutions.id, inst.id));
    }
  }
  return insts.length;
}
