import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { db, t } from "@/db";
import type { Insights } from "@/db/schema";
import { allSettings } from "./settings";
import { priceFor } from "./pricing";
import { OPPORTUNITY_CATEGORIES, rescore } from "./scoring";
import { inr } from "./format";
import { crawlSocietyWebsite, type CrawledWebsiteData } from "./crawler";

/**
 * Opportunity insights & real-time website intelligence.
 * Default engine: Gemini 2.5 Flash with Google Search Grounding to extract real website data,
 * contacts, financials, and digital banking capabilities directly from the web into the CRM.
 * Fallbacks: Anthropic Claude (if configured) or deterministic rules.
 */

const DISCLAIMER = "AI-grounded recommendation based on official website data and public records.";

const MODULES_BY_CATEGORY: Record<string, string[]> = {
  GREENFIELD_CBS: ["MEMBERS", "ACCOUNT_MGMT", "DEPOSITS", "LOAN_MGMT", "ACCOUNTING", "MIS", "INTERNET_BANKING"],
  CBS_REPLACEMENT: ["BRANCH_MGMT", "GL_MGMT", "ACCOUNTING", "MIS", "AUDIT_MGMT", "COMPLIANCE_MGMT", "RECONCILIATION"],
  ENTERPRISE_ACCOUNT: ["BRANCH_MGMT", "LOAN_MGMT", "AGENT_MGMT", "INTERNET_BANKING", "RECONCILIATION", "BACKUP_MGMT"],
  MEMBER_APP: ["INTERNET_BANKING", "PAYMENTS", "EKYC", "NOTIFICATIONS"],
  EKYC_ONBOARDING: ["EKYC", "DOCUMENT_MGMT", "MEMBERS"],
  PAYMENT_INTEGRATION: ["PAYMENTS", "FUND_TRANSFER", "EMI"],
  DIGITAL_MODULE_SALE: ["INTERNET_BANKING", "EKYC", "PAYMENTS", "NOTIFICATIONS"],
  STRATEGIC_PARTNERSHIP: ["PAYMENTS", "FUND_TRANSFER"],
  NOT_QUALIFIED: [],
};

const VALID_ROLES = [
  "CHAIRMAN",
  "VICE_CHAIRMAN",
  "SECRETARY",
  "CEO_MD",
  "GENERAL_MANAGER",
  "IT_MANAGER",
  "FINANCE_HEAD",
  "DIRECTOR",
  "BRANCH_MANAGER",
  "INFLUENCER",
  "OTHER",
] as const;

type ValidRole = typeof VALID_ROLES[number];

function normalizeRole(raw?: string | null): ValidRole {
  if (!raw) return "OTHER";
  const r = raw.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  if (r.includes("VICE_CHAIRMAN") || r.includes("VP") || r.includes("UPADHYAKSHA")) return "VICE_CHAIRMAN";
  if (r.includes("CHAIRMAN") || r.includes("PRESIDENT") || r.includes("ADHYAKSHA")) return "CHAIRMAN";
  if (r.includes("SECRETARY") || r.includes("SACHIV")) return "SECRETARY";
  if (r.includes("CEO") || r.includes("MD") || r.includes("MANAGING_DIRECTOR") || r.includes("KARYAKARI")) return "CEO_MD";
  if (r.includes("GENERAL_MANAGER") || r.includes("GM") || r.includes("VYAVASTHAPAK")) return "GENERAL_MANAGER";
  if (r.includes("DIRECTOR") || r.includes("SANCHALAK") || r.includes("SANCHALIKA") || r.includes("BOARD")) return "DIRECTOR";
  if (r.includes("BRANCH_MANAGER") || r.includes("SHAKHA")) return "BRANCH_MANAGER";
  if (r.includes("FINANCE") || r.includes("CFO") || r.includes("ACCOUNT") || r.includes("LEKHA")) return "FINANCE_HEAD";
  if (/\b(IT|TECH|CTO|COMPUTER)\b/.test(r) || r === "IT" || r === "IT_MANAGER") return "IT_MANAGER";
  if ((VALID_ROLES as readonly string[]).includes(r)) return r as ValidRole;
  return "OTHER";
}

function parseNumeric(val: any): number | null {
  if (val == null) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val === "string") {
    const clean = val.replace(/[₹,]/g, "").trim();
    if (!clean) return null;
    const lower = clean.toLowerCase();
    if (lower.includes("cr") || lower.includes("कोटी")) {
      const n = parseFloat(lower.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : Math.round(n * 10000000);
    }
    if (lower.includes("lakh") || lower.includes("lac") || lower.includes("लाख")) {
      const n = parseFloat(lower.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : Math.round(n * 100000);
    }
    const n = parseFloat(clean.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : Math.round(n);
  }
  return null;
}

function toTriState(val?: string | null): "YES" | "NO" | "UNKNOWN" {
  if (!val) return "UNKNOWN";
  const upper = String(val).toUpperCase().trim();
  if (upper === "YES" || upper === "TRUE") return "YES";
  if (upper === "NO" || upper === "FALSE") return "NO";
  return "UNKNOWN";
}

function sanitizeJson(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  let out = "";
  for (let i = 0; i < jsonStr.length; i++) {
    const c = jsonStr[i];
    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      escaped = true;
      continue;
    }
    if (c === "\"") {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      if (c.charCodeAt(0) < 32) continue;
    }
    out += c;
  }
  return out;
}

function parseJsonSafe(text: string): any {
  if (!text) throw new Error("Empty response from AI");
  let clean = text.trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();

  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON object found in response");

  const candidate = clean.slice(start, end > start ? end + 1 : undefined);
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(sanitizeJson(candidate));
    } catch {
      try {
        const fixed = sanitizeJson(candidate).replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(fixed);
      } catch (err: any) {
        throw new Error(`JSON parse failed: ${err.message}`);
      }
    }
  }
}

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

/**
 * Researches the institution's official website and public presence using Gemini 2.5 Flash
 * combined with direct website crawling. Extracts real verified data (website, email,
 * phone, branches, members, balance sheet, profit, growth trajectory, directors),
 * inserts contacts, creates sources, rescores the lead, and generates sales insights.
 */
async function geminiResearchAndInsights(institutionId: string, userId?: string, modelName?: string): Promise<{ insights: Insights; source: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { inst, acts } = await buildInsightContext(institutionId);
  const base = await ruleInsights(institutionId);

  const model = modelName && modelName.startsWith("gemini") ? modelName : "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  const locationParts = [inst.address, inst.taluka?.name, inst.district?.name, "Maharashtra"].filter(Boolean).join(", ");
  
  let websiteUrl = inst.website?.trim() || null;
  // If websiteUrl is an old Google Sites or known bad/login domain, clear it so we search fresh
  if (websiteUrl && (websiteUrl.includes("sites.google.com/site/") || websiteUrl.includes("accounts.google.com"))) {
    websiteUrl = null;
  }
  let crawlData: CrawledWebsiteData | null = null;

  // Step 1: If website is unknown, do a quick search with Gemini Search Grounding to find official URL
  if (!websiteUrl) {
    try {
      const searchRes = await ai.models.generateContent({
        model,
        contents: `Find the official website URL of the cooperative credit society (patsanstha) or bank:
Institution Name: "${inst.legalName}"
Location: ${locationParts}
Return ONLY the official website URL if found, or "NONE" if not found.`,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      });
      const match = searchRes.text?.match(/https?:\/\/[^\s"'<>]+/);
      if (match && !match[0].includes("google.com/site") && !match[0].includes("accounts.google.com") && !match[0].includes("wikipedia.org")) {
        websiteUrl = match[0];
      }
    } catch {}
  }

  // Step 2: If websiteUrl exists, crawl key pages (Home, Branches, About Us, Financials, Board, Contact)
  if (websiteUrl) {
    try {
      crawlData = await crawlSocietyWebsite(websiteUrl);
    } catch {}
  }

  const hasDirectCrawl = crawlData != null && crawlData.sanitizedNarrative.trim().length > 150;
  let parsed: any = null;

  if (hasDirectCrawl) {
    // ── TIER 1: Fast direct extraction using crawled website pages ──
    const prompt = `You are an elite B2B fintech intelligence researcher and sales strategist for Fivopay, analyzing Indian cooperative credit societies (patsansthas) and banks for Core Banking Software (CBS) modernization.

Target Institution:
- Legal Name: "${inst.legalName}"
- Location: ${locationParts}
- Official Website: ${websiteUrl || "Unknown"}

=== DIRECT VERIFIED DATA EXTRACTED FROM OFFICIAL WEBSITE ===
Website URL: ${crawlData!.website}
Pages Crawled: ${crawlData!.pagesCrawled.join(", ")}
Extracted Official Emails: ${crawlData!.discoveredEmails.join(", ") || "None"}
Extracted Official Phones: ${crawlData!.discoveredPhones.join(", ") || "None"}

Extracted Key Financial Metrics & Counters:
${JSON.stringify(crawlData!.discoveredCounters, null, 2)}

Extracted Board Members & Leadership:
${JSON.stringify(crawlData!.discoveredLeadership, null, 2)}

Extracted Branches Count: ${crawlData!.discoveredBranchCount || crawlData!.discoveredBranches.length || "Scan narrative for branch network size"}
Sample Extracted Branches:
${JSON.stringify(crawlData!.discoveredBranches.slice(0, 10), null, 2)}

Extracted Website Narrative & Official Reports:
${crawlData!.sanitizedNarrative.slice(0, 14000)}

--- TASK & INSTRUCTIONS ---
Extract and synthesize all factual data into a complete intelligence profile:
1. Facts:
   - website: full URL of official website
   - email: official contact email
   - phone: official landline or head office phone
   - mobile: mobile or WhatsApp number
   - headOfficeAddress: full address if found
   - branchCount: exact total number of branches (number, e.g. 213 or 17 or 1)
   - branchLocations: comma-separated list of towns / branch regions / states
   - totalMembers: total member count (number)
   - activeMembers: active member count (number)
   - totalDeposits: in INR (e.g. 408 Cr -> 4080000000; only if verified numbers in text, else null)
   - loanBook: total advances/loans in INR (e.g. 302 Cr -> 3020000000; only if in text, else null)
   - totalAssets: working capital or balance sheet total in INR (only if in text, else null)
   - netWorth: own funds / net worth in INR (only if in text, else null)
   - investments: total investments in INR (number or null)
   - annualProfit: net profit in INR (number or null)
   - financialYear: e.g. "FY 2023-24" or "As of June 2025"
   - cdRatio: credit-deposit ratio (number or null)
   - crar: capital adequacy ratio (number or null)
   - cbsVendor: current core banking vendor if mentioned
   - centralisedCbs: "YES" | "NO" | "UNKNOWN"
   - mobileApp: "YES" | "NO" | "UNKNOWN"
   - upiIntegration: "YES" | "NO" | "UNKNOWN"
   - internetBanking: "YES" | "NO" | "UNKNOWN"
   - ekyc: "YES" | "NO" | "UNKNOWN"

2. Contacts:
   - Include Chairman, Vice Chairman, CEO/MD, General Manager, and all discovered Board Directors.
   - For each: { name, role ("CHAIRMAN" | "VICE_CHAIRMAN" | "SECRETARY" | "CEO_MD" | "GENERAL_MANAGER" | "IT_MANAGER" | "FINANCE_HEAD" | "DIRECTOR" | "BRANCH_MANAGER" | "OTHER"), designation, businessPhone, businessEmail }

3. Growth Trajectory (Crucial):
   - A detailed 3-5 sentence narrative describing their historical journey and year-wise business growth: inception year, founding capital, founder/inspiration, expansion of branches, growth in deposits and loans, current financial scale, audit grades, and state/national awards.

4. Year Wise Metrics:
   - Array of historical milestones and recent financial scale:
     [
       { year: string, milestone: string, deposits: number | null, loans: number | null, netWorth: number | null, branches: number | null }
     ]

5. Insights:
   - whyApproach: 1-2 sharp sentences on why Fivopay should target them based on real findings
   - whyNow: specific trigger or modernization opportunity
   - painPoint: tech gaps
   - influencers: key decision makers
   - modules: array of CBS modules to pitch
   - blockers: obstacles
   - nextAction: concrete next step

Return ONLY a valid JSON object matching this schema.`;

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    parsed = parseJsonSafe(res.text || "");
  } else {
    // ── TIER 2: Grounded Fallback when website is missing, down, or behind login ──
    const searchPrompt = `Research the Indian cooperative credit society (patsanstha) or bank:
Institution Name: "${inst.legalName}"
Location: ${locationParts}

Search official cooperative directories, government registries, and public web records for verified facts.
Find:
1. Official website URL (if active)
2. Number of branches and all known branch locations
3. Total member count
4. Actual financial figures (Total Deposits, Loan Book / Advances, Total Assets, Net Worth, Annual Profit, Financial Year) - only return numbers if publicly reported; if not available return null
5. Key leadership & board of directors (Chairman, General Manager, Board Directors)
6. Official contact details (Head Office Address, Landline, Mobile, Email)
7. Brief 3-4 sentence growth trajectory and history

Return ONLY a single valid JSON markdown code block:
\`\`\`json
{
  "facts": {
    "website": string | null,
    "email": string | null,
    "phone": string | null,
    "mobile": string | null,
    "headOfficeAddress": string | null,
    "branchCount": number | null,
    "branchLocations": string | null,
    "totalMembers": number | null,
    "activeMembers": number | null,
    "totalDeposits": number | null,
    "loanBook": number | null,
    "totalAssets": number | null,
    "netWorth": number | null,
    "annualProfit": number | null,
    "financialYear": string | null,
    "cbsVendor": string | null,
    "centralisedCbs": "YES" | "NO" | "UNKNOWN",
    "mobileApp": "YES" | "NO" | "UNKNOWN",
    "upiIntegration": "YES" | "NO" | "UNKNOWN",
    "internetBanking": "YES" | "NO" | "UNKNOWN",
    "ekyc": "YES" | "NO" | "UNKNOWN"
  },
  "contacts": [
    { "name": string, "role": string, "designation": string, "businessPhone": string, "businessEmail": string }
  ],
  "growthTrajectory": string,
  "yearWiseMetrics": [
    { "year": string, "milestone": string, "deposits": number | null, "loans": number | null, "netWorth": number | null, "branches": number | null }
  ],
  "insights": {
    "whyApproach": string,
    "whyNow": string,
    "painPoint": string,
    "influencers": string,
    "modules": string[],
    "blockers": string,
    "nextAction": string
  }
}
\`\`\``;

    const groundedRes = await ai.models.generateContent({
      model,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    parsed = parseJsonSafe(groundedRes.text || "");
  }

  const facts = parsed.facts || {};
  const contactsList = Array.isArray(parsed.contacts) ? [...parsed.contacts] : [];
  if (parsed.keyLeadership && typeof parsed.keyLeadership === "object") {
    for (const [key, val] of Object.entries(parsed.keyLeadership)) {
      if (typeof val === "string" && val.trim().length > 2) {
        const k = key.toLowerCase();
        const role = k.includes("general") ? "GENERAL_MANAGER" : k.includes("chair") ? "CHAIRMAN" : k.includes("ceo") || k.includes("md") ? "CEO_MD" : "OTHER";
        const name = val.replace(/\([^)]*\)/g, "").trim();
        if (name && !contactsList.some((c: any) => c.name?.toLowerCase() === name.toLowerCase())) {
          contactsList.push({ name, role, designation: val });
        }
      }
    }
  }
  const aiInsights = parsed.insights || {};
  const evidenceFromWeb: string[] = Array.isArray(parsed.evidence) ? parsed.evidence : [];

  // Update institution factual fields
  const updates: Partial<typeof t.institutions.$inferInsert> = {};
  const updatedFieldKeys: string[] = [];

  const finalWebsite = facts.website || websiteUrl || null;
  if (finalWebsite && (!inst.website || inst.website.trim() === "")) {
    updates.website = finalWebsite;
    updatedFieldKeys.push("website");
  }
  const finalEmail = facts.email || crawlData?.discoveredEmails[0] || null;
  if (finalEmail && (!inst.email || inst.email.trim() === "")) {
    updates.email = finalEmail;
    updatedFieldKeys.push("email");
  }
  const finalMobile = facts.mobile || crawlData?.discoveredPhones[0] || null;
  if (finalMobile && (!inst.mobile || inst.mobile.trim() === "")) {
    updates.mobile = finalMobile;
    updatedFieldKeys.push("mobile");
  }
  const finalPhone = facts.phone || crawlData?.discoveredPhones[1] || null;
  if (finalPhone && (!inst.landline || inst.landline.trim() === "")) {
    updates.landline = finalPhone;
    updatedFieldKeys.push("landline");
  }
  if (facts.headOfficeAddress && (!inst.address || inst.address.trim() === "")) {
    updates.address = facts.headOfficeAddress;
    updatedFieldKeys.push("address");
  }

  const branchCountNum = parseNumeric(facts.branchCount || facts.numberOfBranches) || crawlData?.discoveredBranchCount || (crawlData?.discoveredBranches.length ? crawlData.discoveredBranches.length : null);
  if (branchCountNum != null && branchCountNum > 0) {
    updates.branchCount = branchCountNum;
    updatedFieldKeys.push("branchCount");
  }

  const rawBranchLocs = facts.branchLocations || (crawlData?.discoveredBranches.map((b) => b.name).join(", ") || null);
  const finalBranchLocations = Array.isArray(rawBranchLocs)
    ? rawBranchLocs.map((b: any) => typeof b === "string" ? b : `${b.name || ""}${b.address ? ` (${b.address})` : ""}`).filter(Boolean).join("; ")
    : (typeof rawBranchLocs === "string" ? rawBranchLocs : null);
  if (finalBranchLocations && finalBranchLocations.trim() !== "") {
    updates.branchLocations = finalBranchLocations;
    updatedFieldKeys.push("branchLocations");
  }

  const membersNum = parseNumeric(facts.totalMembers || facts.totalMemberCount);
  if (membersNum != null && membersNum > 0) {
    updates.totalMembers = membersNum;
    updatedFieldKeys.push("totalMembers");
  }
  const activeMembersNum = parseNumeric(facts.activeMembers);
  if (activeMembersNum != null && activeMembersNum > 0) {
    updates.activeMembers = activeMembersNum;
    updatedFieldKeys.push("activeMembers");
  }
  const depositsNum = parseNumeric(facts.totalDeposits);
  if (depositsNum != null && depositsNum > 0) {
    updates.totalDeposits = depositsNum;
    updatedFieldKeys.push("totalDeposits");
  }
  const loansNum = parseNumeric(facts.loanBook);
  if (loansNum != null && loansNum > 0) {
    updates.loanBook = loansNum;
    updatedFieldKeys.push("loanBook");
  }
  const assetsNum = parseNumeric(facts.totalAssets);
  if (assetsNum != null && assetsNum > 0) {
    updates.totalAssets = assetsNum;
    updatedFieldKeys.push("totalAssets");
  }
  const profitNum = parseNumeric(facts.annualProfit);
  if (profitNum != null && profitNum > 0) {
    updates.annualProfit = profitNum;
    updatedFieldKeys.push("annualProfit");
  }
  const netWorthNum = parseNumeric(facts.netWorth);
  if (netWorthNum != null && netWorthNum > 0) {
    updates.netWorth = netWorthNum;
    updatedFieldKeys.push("netWorth");
  }
  if (facts.financialYear) {
    updates.financialYear = facts.financialYear;
    updatedFieldKeys.push("financialYear");
  }
  if (facts.cbsVendor && (!inst.cbsVendor || inst.cbsVendor.trim() === "")) {
    updates.cbsVendor = facts.cbsVendor;
    updatedFieldKeys.push("cbsVendor");
  }
  if (facts.centralisedCbs && inst.centralisedCbs === "UNKNOWN") {
    const v = toTriState(facts.centralisedCbs);
    if (v !== "UNKNOWN") { updates.centralisedCbs = v; updatedFieldKeys.push("centralisedCbs"); }
  }
  if (facts.mobileApp && inst.mobileApp === "UNKNOWN") {
    const v = toTriState(facts.mobileApp);
    if (v !== "UNKNOWN") { updates.mobileApp = v; updatedFieldKeys.push("mobileApp"); }
  }
  if (facts.upiIntegration && inst.upiIntegration === "UNKNOWN") {
    const v = toTriState(facts.upiIntegration);
    if (v !== "UNKNOWN") { updates.upiIntegration = v; updatedFieldKeys.push("upiIntegration"); }
  }
  if (facts.internetBanking && inst.internetBanking === "UNKNOWN") {
    const v = toTriState(facts.internetBanking);
    if (v !== "UNKNOWN") { updates.internetBanking = v; updatedFieldKeys.push("internetBanking"); }
  }
  if (facts.ekyc && inst.ekyc === "UNKNOWN") {
    const v = toTriState(facts.ekyc);
    if (v !== "UNKNOWN") { updates.ekyc = v; updatedFieldKeys.push("ekyc"); }
  }

  const sourceUrl = finalWebsite;

  if (updatedFieldKeys.length > 0) {
    const nextFactStatus = { ...(inst.factStatus ?? {}) };
    for (const k of updatedFieldKeys) {
      nextFactStatus[k] = "PUBLICLY_REPORTED";
    }
    updates.factStatus = nextFactStatus;
    updates.dataConfidence = "HIGH";
    updates.verification = "PARTIAL";
    await db.update(t.institutions).set(updates).where(eq(t.institutions.id, institutionId));
  }

  // Insert contacts
  let contactsAdded = 0;
  const existing = await db.select().from(t.contacts).where(eq(t.contacts.institutionId, institutionId));
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase().trim()));

  // Add contacts from Gemini output
  for (const c of contactsList) {
    const name = (c.name || "").trim();
    if (!name || name.length < 2 || existingNames.has(name.toLowerCase())) continue;
    const role = normalizeRole(c.role);
    await db.insert(t.contacts).values({
      institutionId,
      name,
      role,
      designation: c.designation || null,
      isDecisionMaker: ["CHAIRMAN", "CEO_MD", "SECRETARY", "GENERAL_MANAGER"].includes(role),
      isFinalApprover: ["CHAIRMAN", "CEO_MD"].includes(role),
      isInfluencer: ["IT_MANAGER", "FINANCE_HEAD", "DIRECTOR"].includes(role),
      businessPhone: c.businessPhone || null,
      businessEmail: c.businessEmail || null,
      verification: "PARTIAL",
      relationshipStrength: 0,
      sourceUrl,
    });
    existingNames.add(name.toLowerCase());
    contactsAdded++;
  }

  // Also add any discovered leadership from image tags if not already present
  if (crawlData?.discoveredLeadership) {
    for (const lead of crawlData.discoveredLeadership) {
      const name = lead.name.trim();
      if (!name || name.length < 2 || existingNames.has(name.toLowerCase())) continue;
      const role = normalizeRole(lead.role);
      await db.insert(t.contacts).values({
        institutionId,
        name,
        role,
        designation: lead.role,
        isDecisionMaker: ["CHAIRMAN", "CEO_MD", "SECRETARY", "GENERAL_MANAGER"].includes(role),
        isFinalApprover: ["CHAIRMAN", "CEO_MD"].includes(role),
        isInfluencer: ["IT_MANAGER", "FINANCE_HEAD", "DIRECTOR"].includes(role),
        businessPhone: null,
        businessEmail: null,
        verification: "PARTIAL",
        relationshipStrength: 0,
        sourceUrl,
      });
      existingNames.add(name.toLowerCase());
      contactsAdded++;
    }
  }

  // Record research source provenance
  if (updatedFieldKeys.length > 0 || contactsAdded > 0 || evidenceFromWeb.length > 0) {
    await db.insert(t.sources).values({
      institutionId,
      name: `Official Website & Reports (Gemini AI Extraction)`,
      url: sourceUrl,
      accessedAt: new Date(),
      evidence: parsed.sourceSummary || `Verified facts extracted from official web presence: ${updatedFieldKeys.join(", ")}`,
      fieldKeys: updatedFieldKeys,
      classification: "PUBLICLY_REPORTED",
      verification: "VERIFIED",
      confidence: "HIGH",
      addedById: userId ?? null,
    });
  }

  // Rescore lead with newly enriched data
  if (updatedFieldKeys.length > 0 || contactsAdded > 0) {
    await rescore([institutionId]);
  }

  // Refetch fresh institution data for pricing & insights
  const updatedInst = await db.query.institutions.findFirst({
    where: eq(t.institutions.id, institutionId),
    with: { type: true, taluka: true, district: true, contacts: true, signals: true, sources: true },
  });

  const finalMembers = updatedInst?.activeMembers ?? updatedInst?.totalMembers;
  const cat = updatedInst?.opportunityCategory ?? inst.opportunityCategory;
  const insightModules = Array.isArray(aiInsights.modules) && aiInsights.modules.length > 0 ? aiInsights.modules : (MODULES_BY_CATEGORY[cat] ?? []);

  let calculatedPrice = base.price;
  try {
    const p = await priceFor({
      members: finalMembers ?? null,
      branches: updatedInst?.branchCount ?? null,
      modules: insightModules,
    });
    calculatedPrice = `${p.model.toLowerCase()} model: ~${inr(p.monthly)}/month list (floor ${inr(p.negotiation.minAcceptableMonthly)}), implementation ~${inr(p.oneTime)}. Offer a ${p.pilot.months}-month paid pilot (~${inr(p.pilot.fee)}) if the board hesitates.`;
  } catch {}

  const finalEvidence = [
    ...(evidenceFromWeb.length ? evidenceFromWeb : []),
    ...(crawlData ? [`Official website pages analyzed: ${crawlData.pagesCrawled.join(", ")}`] : []),
    ...base.evidence.filter((e) => e !== "No buying evidence recorded yet."),
  ];

  function toStringSafe(val: any, fallback = ""): string {
    if (val == null) return fallback;
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
      return val
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null) {
            return `${item.name || ""} (${item.designation || item.role || ""})`.trim();
          }
          return String(item);
        })
        .filter(Boolean)
        .join("; ");
    }
    return String(val);
  }

  const finalInsights: Insights = {
    whyApproach: toStringSafe(aiInsights.whyApproach, base.whyApproach),
    whyNow: toStringSafe(aiInsights.whyNow, base.whyNow),
    painPoint: toStringSafe(aiInsights.painPoint, base.painPoint),
    evidence: finalEvidence.length ? finalEvidence : ["Official public record referenced."],
    missing: updatedInst?.missingInfo ?? base.missing,
    influencers: toStringSafe(aiInsights.influencers, base.influencers),
    modules: insightModules,
    price: calculatedPrice,
    blockers: toStringSafe(aiInsights.blockers, base.blockers),
    nextAction: toStringSafe(aiInsights.nextAction, base.nextAction),
    disclaimer: DISCLAIMER,
    growthTrajectory: toStringSafe(parsed.growthTrajectory, null as any) || null,
    yearWiseMetrics: Array.isArray(parsed.yearWiseMetrics) ? parsed.yearWiseMetrics : null,
    cdRatio: parseNumeric(facts.cdRatio),
    crar: parseNumeric(facts.crar),
    workingCapital: parseNumeric(facts.totalAssets) || parseNumeric(facts.workingCapital),
    investments: parseNumeric(facts.investments),
  };

  const sourceLabel = `GEMINI:${model}`;
  await db.update(t.institutions).set({
    insights: finalInsights,
    insightsAt: new Date(),
    insightsSource: sourceLabel,
  }).where(eq(t.institutions.id, institutionId));

  return { insights: finalInsights, source: sourceLabel };
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

export async function generateInsights(institutionId: string, userId?: string) {
  const s = await allSettings();
  const provider = String(s.get("ai.provider") || "");
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  // Prefer Gemini if key is present or if explicitly selected
  if (hasGeminiKey && (provider === "GEMINI" || provider === "RULES" || !provider || !hasAnthropicKey)) {
    try {
      const res = await geminiResearchAndInsights(institutionId, userId, String(s.get("ai.model") || ""));
      return res;
    } catch (e: any) {
      await db.insert(t.errorLogs).values({
        route: "insights/gemini",
        method: "JOB",
        status: 502,
        message: String(e?.message ?? e).slice(0, 2000),
      });
      // Fallback continues below
    }
  }

  // Anthropic option
  if (provider === "ANTHROPIC" && hasAnthropicKey) {
    try {
      const base = await ruleInsights(institutionId);
      const out = await llmInsights(institutionId, base, String(s.get("ai.model")), Number(s.get("ai.maxTokens")));
      const source = `LLM:${s.get("ai.model")}`;
      await db.update(t.institutions).set({ insights: out, insightsAt: new Date(), insightsSource: source }).where(eq(t.institutions.id, institutionId));
      return { insights: out, source };
    } catch (e: any) {
      await db.insert(t.errorLogs).values({
        route: "insights/anthropic",
        method: "JOB",
        status: 502,
        message: String(e?.message ?? e).slice(0, 2000),
      });
    }
  }

  // Fallback to rule-based engine
  const base = await ruleInsights(institutionId);
  const source = "RULES";
  await db.update(t.institutions).set({ insights: base, insightsAt: new Date(), insightsSource: source }).where(eq(t.institutions.id, institutionId));
  return { insights: base, source };
}
