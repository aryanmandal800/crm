import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Insights } from "@/db/schema";
import { allSettings } from "./settings";
import { priceFor } from "./pricing";
import { OPPORTUNITY_CATEGORIES } from "./scoring";
import { inr } from "./format";

/**
 * Opportunity insights. Default engine is deterministic rules over the evidence on file.
 * Optional: an LLM (Anthropic API) rewrites the same evidence into sharper recommendations.
 * Either way the output is stored in `institutions.insights`, labelled as a recommendation,
 * and never written back into factual fields.
 */

const DISCLAIMER = "AI-generated recommendation based on the evidence recorded in this CRM. Not a verified fact.";

const MODULES_BY_CATEGORY: Record<string, string[]> = {
  GREENFIELD_CBS: ["CBS", "MEMBERS", "DEPOSITS", "LOS", "LMS", "ACCOUNTING", "MIS", "MEMBER_APP"],
  CBS_REPLACEMENT: ["CBS", "MIGRATION", "MULTI_BRANCH", "ACCOUNTING", "MIS", "DIRECTOR_DASHBOARD", "AUDIT_CONTROLS"],
  ENTERPRISE_ACCOUNT: ["CBS", "MULTI_BRANCH", "LOS", "LMS", "MEMBER_APP", "AGENT_APP", "API", "DIRECTOR_DASHBOARD", "MIGRATION"],
  MEMBER_APP: ["MEMBER_APP", "WHITE_LABEL", "PAYMENTS", "EKYC"],
  EKYC_ONBOARDING: ["EKYC", "ESIGN", "MEMBERS"],
  PAYMENT_INTEGRATION: ["PAYMENTS", "EMI", "MEMBER_APP"],
  DIGITAL_MODULE_SALE: ["MEMBER_APP", "EKYC", "PAYMENTS", "DIRECTOR_DASHBOARD"],
  STRATEGIC_PARTNERSHIP: ["API", "WHITE_LABEL"],
  NOT_QUALIFIED: [],
};

export async function buildInsightContext(institutionId: string) {
  const inst = await db.query.institutions.findFirst({
    where: eq(t.institutions.id, institutionId),
    with: { type: true, taluka: true, district: true, contacts: true, signals: true, sources: true },
  });
  if (!inst) throw new Error("Institution not found");
  const acts = await db.select().from(t.activities).where(eq(t.activities.institutionId, institutionId));
  return { inst, acts };
}

export async function ruleInsights(institutionId: string): Promise<Insights> {
  const { inst: i, acts } = await buildInsightContext(institutionId);
  const members = i.activeMembers ?? i.totalMembers;
  const cat = i.opportunityCategory;
  const evidence: string[] = [
    ...i.signals.map((s) => `${s.type.replace(/_/g, " ").toLowerCase()}: ${s.description}${s.evidenceUrl ? ` (${s.evidenceUrl})` : ""}`),
    ...(i.legacyEvidence ? [`Legacy software: ${i.legacyEvidence}`] : []),
    ...(i.techComplaints ? [`Complaints: ${i.techComplaints}`] : []),
    ...(["mobileApp", "ekyc", "upiIntegration", "centralisedCbs"] as const).filter((k) => i[k] === "NO").map((k) => `Recorded: no ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`),
  ];
  const pains: string[] = [];
  if (i.centralisedCbs === "NO") pains.push("branches not on a centralised system — reconciliation and MIS delays");
  if (i.mobileApp === "NO") pains.push("members cannot transact or check balances digitally");
  if (i.ekyc === "NO") pains.push("manual KYC slows member onboarding");
  if (i.upiIntegration === "NO") pains.push("collections depend on cash/branch visits");
  if (i.signals.some((s) => s.type === "VENDOR_DISSATISFACTION")) pains.push("dissatisfaction with the current vendor");
  if (i.signals.some((s) => s.type === "BRANCH_EXPANSION")) pains.push("expansion stretching current systems");

  const dms = i.contacts.filter((c) => c.isDecisionMaker || c.isFinalApprover || ["CHAIRMAN", "CEO_MD", "SECRETARY", "GENERAL_MANAGER"].includes(c.role));
  const recent = i.signals.filter((s) => s.signalDate && Date.now() - s.signalDate.getTime() < 180 * 864e5);
  let price = "Member count needed before pricing.";
  try {
    const p = await priceFor({ members: members ?? null, branches: i.branchCount, modules: MODULES_BY_CATEGORY[cat] ?? [] });
    price = `${p.model.toLowerCase()} model: ~${inr(p.monthly)}/month list (floor ${inr(p.negotiation.minAcceptableMonthly)}), implementation ~${inr(p.oneTime)}. Offer a ${p.pilot.months}-month paid pilot (~${inr(p.pilot.fee)}) if the board hesitates.`;
  } catch {}

  const lastAct = acts.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];
  let next = "Verify official contact details, then place a first call to the secretary/CEO office.";
  if (!i.landline && !i.mobile && !i.email && !dms.length) next = "Research: find an official contact point (registrar record, website, Google listing).";
  else if (dms.length && !acts.length) next = `Call ${dms[0].name} (${dms[0].role.replace(/_/g, " ").toLowerCase()}) to request a 20-minute discovery meeting.`;
  else if (lastAct?.followUpDate) next = `Follow up as committed on ${lastAct.followUpDate.toLocaleDateString("en-IN")}: ${lastAct.nextAction ?? "continue the conversation"}.`;
  else if (lastAct) next = `Book a product demo with the decision-maker; last touch was ${lastAct.typeKey.toLowerCase()} on ${lastAct.occurredAt.toLocaleDateString("en-IN")}.`;

  return {
    whyApproach: `${OPPORTUNITY_CATEGORIES[cat] ?? cat} opportunity; score ${i.score}/100 (${i.scoreBand}).${members ? ` ${members.toLocaleString("en-IN")} members` : ""}${i.branchCount ? `, ${i.branchCount} branches` : ""}.`,
    whyNow: recent.length ? `Recent signals: ${recent.map((s) => s.type.replace(/_/g, " ").toLowerCase()).join(", ")}.` : "No time-bound trigger evidenced yet — treat as nurture until a signal appears.",
    painPoint: pains.length ? `Likely: ${pains.join("; ")}.` : "Not evidenced — confirm in discovery (ask about MIS, member service, audit and branch reconciliation).",
    evidence: evidence.length ? evidence : ["No buying evidence recorded yet."],
    missing: i.missingInfo,
    influencers: dms.length ? dms.map((c) => `${c.name} — ${c.designation ?? c.role.replace(/_/g, " ").toLowerCase()}${c.isFinalApprover ? " (final approver)" : ""}`).join("; ") : "Typically: Chairman and board (approval), CEO/Secretary (evaluation), accountant/IT in-charge (influence). Not yet identified for this institution.",
    modules: MODULES_BY_CATEGORY[cat] ?? [],
    price,
    blockers: [
      i.vendorClass === "CONFIRMED_INCUMBENT" ? "Long-standing incumbent vendor relationship" : null,
      "Board approval cycle and AGM timing",
      "Data migration risk perception",
      !members ? "Budget unknown — financials not verified" : null,
    ].filter(Boolean).join("; ") + ".",
    nextAction: next,
    disclaimer: DISCLAIMER,
  };
}

async function llmInsights(institutionId: string, base: Insights, model: string, maxTokens: number): Promise<Insights> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const { inst } = await buildInsightContext(institutionId);
  const facts = {
    name: inst.legalName, type: inst.type?.name, taluka: inst.taluka?.name, members: inst.totalMembers, branches: inst.branchCount,
    deposits: inst.totalDeposits, vendor: inst.cbsVendor, vendorClass: inst.vendorClass, mobileApp: inst.mobileApp, ekyc: inst.ekyc,
    upi: inst.upiIntegration, centralised: inst.centralisedCbs, score: inst.score, band: inst.scoreBand, category: inst.opportunityCategory,
    signals: inst.signals.map((s) => ({ type: s.type, description: s.description, date: s.signalDate, strength: s.strength })),
    contacts: inst.contacts.map((c) => ({ name: c.name, role: c.role, decisionMaker: c.isDecisionMaker })),
    missing: inst.missingInfo,
  };
  const prompt = `You are a B2B sales strategist for Fivopay, a cloud core banking SaaS for Indian cooperative credit societies.
Using ONLY the facts below, improve this draft opportunity analysis. Do not invent facts, people, numbers, or vendors. If something is unknown say so.
Return ONLY JSON with keys: whyApproach, whyNow, painPoint, evidence (array), missing (array), influencers, modules (array of module keys from the draft), price, blockers, nextAction.
FACTS: ${JSON.stringify(facts)}
DRAFT: ${JSON.stringify(base)}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const text: string = j.content?.map((c: any) => c.text ?? "").join("") ?? "";
  const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { ...base, ...parsed, disclaimer: DISCLAIMER };
}

export async function generateInsights(institutionId: string) {
  const s = await allSettings();
  const base = await ruleInsights(institutionId);
  let out = base, source = "RULES";
  if (s.get("ai.provider") === "ANTHROPIC") {
    try { out = await llmInsights(institutionId, base, String(s.get("ai.model")), Number(s.get("ai.maxTokens"))); source = `LLM:${s.get("ai.model")}`; }
    catch (e: any) {
      await db.insert(t.errorLogs).values({ route: "insights/llm", method: "JOB", status: 502, message: String(e?.message ?? e).slice(0, 2000) });
      source = "RULES (LLM failed — see error log)";
    }
  }
  await db.update(t.institutions).set({ insights: out, insightsAt: new Date(), insightsSource: source }).where(eq(t.institutions.id, institutionId));
  return { insights: out, source };
}
