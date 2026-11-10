/**
 * Seeds reference data (idempotent) + initial users.
 *   SEED_FOUNDER_EMAIL / SEED_FOUNDER_PASSWORD, SEED_TECH_EMAIL, SEED_SALES_EMAIL (optional)
 *   SEED_DEMO=true  → adds clearly-labelled FICTITIOUS demo records for UI review (tag "demo").
 *                     Remove them with:  npm run db:purge-demo
 * No real institution data is seeded: research records must come from verified sources.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as t from "../src/db/schema";
import { DEFAULT_ROLES } from "../src/lib/permissions";
import { SETTING_DEFAULTS } from "../src/lib/settings-defaults";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: t });

const TALUKAS: { name: string; aliases?: string[]; notes?: string }[] = [
  { name: "Pune City" }, { name: "Haveli" },
  { name: "Pimpri-Chinchwad", notes: "Urban area / additional tahsil carved from Haveli — confirm the revenue unit on each registrar record." },
  { name: "Mulshi" }, { name: "Maval" }, { name: "Khed", aliases: ["Rajgurunagar"] }, { name: "Junnar" }, { name: "Ambegaon" },
  { name: "Shirur" }, { name: "Daund" }, { name: "Baramati" }, { name: "Indapur" }, { name: "Bhor" },
  { name: "Rajgad", aliases: ["Velhe"], notes: "Velhe taluka renamed Rajgad (revenue department approval reported Aug 2025). Older records will say Velhe." },
  { name: "Purandar" },
];

const TYPES: [string, string, boolean][] = [
  ["URBAN_CREDIT", "Urban Co-operative Credit Society", true], ["URBAN_PATSANSTHA", "Urban / Nagari Patsanstha", true],
  ["MULTI_STATE_CREDIT", "Multi-State Co-operative Credit Society", true], ["EMPLOYEE_CREDIT", "Employee Credit Co-operative Society", true],
  ["SALARY_EARNERS", "Salary Earners' Credit Society", true], ["INDUSTRIAL_EMPLOYEE", "Industrial Employee Credit Society", true],
  ["GOVT_EMPLOYEE", "Government Employee Credit Society", true], ["POLICE_DEFENCE", "Police / Defence Employee Credit Society", true],
  ["TEACHERS", "Teachers' Credit Society", true], ["TRANSPORT_EMPLOYEE", "Transport Employee Credit Society", true],
  ["EDU_EMPLOYEE", "Educational Institution Employee Credit Society", true], ["RURAL_CREDIT", "Rural Credit Society / other eligible", true],
  ["OTHER_CREDIT", "Other Registered Co-operative Credit Society", true],
  ["UCB", "Urban Co-operative Bank", false], ["DCCB", "District Central Co-operative Bank", false], ["PACS", "PACS", false],
  ["HOUSING", "Housing Society", false], ["FPO", "Farmer Producer Organisation", false], ["NGO", "NGO / Trust", false], ["OTHER_COOP", "Other Co-operative Institution", false],
];

const STAGES: [string, string, number, Partial<{ isOpen: boolean; isWon: boolean; isLost: boolean; isQualified: boolean; stallDays: number }>][] = [
  ["NEW", "New lead", 0, {}], ["RESEARCH_PENDING", "Research pending", 0, {}], ["CONTACT_IDENTIFIED", "Contact identified", 2, {}],
  ["FIRST_CONTACT", "First contact attempted", 3, { stallDays: 7 }], ["CONNECTED", "Connected", 5, { stallDays: 7 }],
  ["QUALIFIED", "Qualified", 10, { isQualified: true }], ["DISCOVERY", "Discovery meeting", 15, { isQualified: true }],
  ["DEMO", "Product demo", 25, { isQualified: true }], ["PROPOSAL", "Commercial proposal", 40, { isQualified: true }],
  ["NEGOTIATION", "Negotiation", 55, { isQualified: true }], ["PILOT_PROPOSED", "Pilot proposed", 60, { isQualified: true }],
  ["PILOT_ACTIVE", "Pilot active", 70, { isQualified: true, stallDays: 30 }], ["MGMT_APPROVAL", "Management approval", 80, { isQualified: true, stallDays: 21 }],
  ["CONTRACT_PENDING", "Contract pending", 90, { isQualified: true }], ["WON", "Won", 100, { isOpen: false, isWon: true, isQualified: true }],
  ["LOST", "Lost", 0, { isOpen: false, isLost: true }], ["ON_HOLD", "On hold", 0, { isOpen: false, stallDays: 60 }],
];

const LOST = [["PRICE", "Price"], ["EXISTING_VENDOR", "Existing vendor"], ["NO_BUDGET", "No budget"], ["MGMT_NOT_CONVINCED", "Management not convinced"],
  ["PROCUREMENT_DELAY", "Procurement delay"], ["PRODUCT_GAP", "Product gap"], ["COMPETITOR_SELECTED", "Competitor selected"], ["NO_RESPONSE", "No response"], ["WRONG_TIMING", "Wrong timing"]];

const ACT_TYPES: [string, string, boolean][] = [["CALL", "Call", true], ["WHATSAPP", "WhatsApp follow-up", false], ["EMAIL", "Email", false],
  ["MEETING", "Meeting", false], ["DEMO", "Product demo", false], ["VISIT", "Branch / office visit", false], ["NOTE", "Note", false]];

const PARAMS: [string, string, number, string][] = [
  ["size", "Organisation size & member potential", 15, "Active (else total) members"], ["branches", "Number of branches", 10, "Verified branch count"],
  ["tech_gap", "Evidence of technology gap", 15, "Only fields recorded as NO count; UNKNOWN scores 0"],
  ["cbs_replacement", "CBS replacement / dissatisfaction signal", 15, "Replacement, dissatisfaction, contract-expiry or tender signals"],
  ["buying_signal", "Active buying / procurement signal", 15, "Recent expansion, tenders, digital initiatives, new management"],
  ["dm_access", "Decision-maker accessibility", 10, "Verified decision-maker contact, or engagement"],
  ["financial", "Financial / commercial capacity", 10, "Deposits (else total assets)"], ["strategic_fit", "Strategic fit for Fivopay", 10, "Segment, district, vertical"],
];

// Fivopay – CBS Modules (29 standardized core, digital & integration banking modules priced ₹5k to ₹10k/mo)
const MODULES: [string, string, string, string, number, boolean, string?][] = [
  ["MEMBERS", "Member Management", "CORE", "FLAT_MONTHLY", 5000, true, "Member share registry, digital membership lifecycle, KYC profile & voting rights"],
  ["SHARE_MGMT", "Share Management", "CORE", "FLAT_MONTHLY", 5500, true, "Share capital allotment, share certificates, transfer, surrender, nominal & regular share registry"],
  ["ACCOUNT_MGMT", "Account Management", "CORE", "FLAT_MONTHLY", 6500, true, "Savings, current, recurring & term account operations, nominee setup & joint-holder controls"],
  ["DEPOSITS", "Deposit Management", "CORE", "FLAT_MONTHLY", 7500, true, "Fixed deposits (FD), Recurring deposits (RD), Pigmy/Daily deposits, auto-renewal & deposit lien"],
  ["LOAN_MGMT", "Loan Management", "CORE", "FLAT_MONTHLY", 9000, true, "End-to-end loan life cycle: application, sanctioning, disbursement, security lien & closure"],
  ["INTEREST_MGMT", "Interest Management", "CORE", "FLAT_MONTHLY", 6000, true, "Configurable interest tables, auto-accrual, compound interest, penal interest & subsidy accounting"],
  ["EMI", "EMI Management", "CORE", "FLAT_MONTHLY", 5500, true, "Flexible amortisation schedules, reducing vs flat rate EMI, moratorium & prepayment handling"],
  ["RECOVERY_MGMT", "Recovery Management", "CORE", "FLAT_MONTHLY", 7000, true, "Overdue tracking, automated demand notices, legal notice dispatch, guarantor notices & field recovery"],
  ["AGENT_MGMT", "Agent Management", "DIGITAL", "FLAT_MONTHLY", 7500, false, "Pigmy / daily collection agent tracking, Bluetooth thermal printer support & commission automation"],
  ["BRANCH_MGMT", "Branch Management", "CORE", "FLAT_MONTHLY", 6000, true, "Multi-branch synchronization, inter-branch transactions, cash counter vaults & cash in transit"],
  ["GL_MGMT", "General Ledger Management", "CORE", "FLAT_MONTHLY", 8000, true, "Chart of accounts, hierarchical sub-ledgers, multi-tier GL structure & automatic journal postings"],
  ["ACCOUNTING", "Accounting Management", "CORE", "FLAT_MONTHLY", 8500, true, "Day book, cash book, bank book, journal vouchers, trial balance, P&L account & balance sheet"],
  ["PAYMENTS", "Payment Management", "INTEGRATION", "FLAT_MONTHLY", 8000, false, "UPI QR collections, payment gateway integrations, vendor payouts, utility bills & BBPS"],
  ["FUND_TRANSFER", "Fund Transfer Management", "INTEGRATION", "FLAT_MONTHLY", 7000, false, "NEFT, RTGS, IMPS settlement, NACH / e-NACH mandates & sponsor bank switch integrations"],
  ["DIVIDEND_MGMT", "Dividend Management", "CORE", "FLAT_MONTHLY", 5000, true, "Annual dividend calculation, AGM approval tracking, auto-credit to savings accounts & warrant printing"],
  ["EKYC", "Onboarding & KYC Management", "INTEGRATION", "FLAT_MONTHLY", 7500, false, "Paperless digital onboarding, Aadhaar OTP eKYC, PAN verification, CKYC search & document OCR"],
  ["DOCUMENT_MGMT", "Document Management", "CORE", "FLAT_MONTHLY", 5500, true, "Digital locker for member identity proofs, loan security documents, title deeds & branch archives"],
  ["AUDIT_MGMT", "Audit Management", "CORE", "FLAT_MONTHLY", 6500, true, "Statutory audit logs, concurrent audit verification, transaction vouchers inspection & sampling tools"],
  ["COMPLIANCE_MGMT", "Compliance Management", "CORE", "FLAT_MONTHLY", 7000, true, "RCS / State Cooperative Act filings, AML/CFT screening, CTR & STR reporting, regulatory limits tracking"],
  ["USER_ROLE_MGMT", "User & Role Management", "CORE", "FLAT_MONTHLY", 5000, true, "Granular role-based access control (RBAC), multi-factor authentication, IP whitelisting & user activity log"],
  ["MAKER_CHECKER", "Maker-Checker Management", "CORE", "FLAT_MONTHLY", 5500, true, "Dual authorization workflow for high-value cash transactions, loan disbursements, GL edits & vouchers"],
  ["MIS", "Reports & MIS", "CORE", "FLAT_MONTHLY", 6500, true, "Over 150+ operational, management, regulatory and financial reports in PDF and Excel formats"],
  ["RECONCILIATION", "Reconciliation Management", "CORE", "FLAT_MONTHLY", 7000, true, "Automated bank statement reconciliation, switch reconciliation, payment gateway settlement & dispute logs"],
  ["INTERNET_BANKING", "Internet Banking", "DIGITAL", "FLAT_MONTHLY", 10000, false, "Secure web banking portal for members: view balance, mini-statement, fund transfer & service requests"],
  ["NOTIFICATIONS", "Notification Management", "DIGITAL", "FLAT_MONTHLY", 5500, false, "Omnichannel transaction alerts via SMS gateway, WhatsApp Business API, email alerts & push notifications"],
  ["NPA_MGMT", "NPA Management", "CORE", "FLAT_MONTHLY", 8500, true, "Asset classification (SMA-0/1/2, Sub-Standard, Doubtful, Loss), provisioning norms & recovery tracking"],
  ["TAX_TDS_MGMT", "Tax & TDS Management", "CORE", "FLAT_MONTHLY", 6000, true, "Section 194A deposit interest TDS deduction, 15G/15H form management, Form 16A generation & GST invoicing"],
  ["FIXED_ASSETS", "Fixed Asset Management", "CORE", "FLAT_MONTHLY", 5500, true, "Asset registry, barcode/tagging, straight-line & WDV depreciation calculation, disposal & insurance tracking"],
  ["BACKUP_MGMT", "Database & Backup Management", "CORE", "FLAT_MONTHLY", 7500, true, "Automated hourly database snapshots, point-in-time recovery (PITR), disaster recovery & encrypted replication"],
];

const SLABS: [number, number | null, number, string][] = [[0, 5000, 5, "Up to 5,000"], [5001, 20000, 4.5, "5,001–20,000"], [20001, 50000, 4, "20,001–50,000"], [50001, null, 3.5, "50,001+"]];

const QUESTIONS = ["Which CBS / software do you use today, and since when?", "Is it cloud or installed at each branch?",
  "What frustrates staff or the board most about the current system?", "Do members want a mobile app / UPI / online services?",
  "When does the current vendor contract or AMC renew?", "Who decides on software — board, chairman, CEO?",
  "Is there budget approved for technology this financial year?", "Any branch expansion planned in the next 12 months?"];

async function upsertByKey<T extends { key: string }>(table: any, rows: T[]) {
  for (const r of rows) await db.insert(table).values(r).onConflictDoNothing({ target: table.key });
}

async function main() {
  // roles
  for (const [key, r] of Object.entries(DEFAULT_ROLES)) {
    await db.insert(t.roles).values({ key, name: r.name, description: r.description, permissions: r.permissions, isSystem: true })
      .onConflictDoUpdate({ target: t.roles.key, set: key === "SUPER_ADMIN" ? { permissions: r.permissions } : { name: r.name } });
  }
  // settings (never overwrite edited values)
  for (const [key, d] of Object.entries(SETTING_DEFAULTS))
    await db.insert(t.settings).values({ key, value: d.value as any, category: d.category, label: d.label, description: d.description, ownerRole: d.ownerRole ?? "SUPER_ADMIN" }).onConflictDoNothing();

  // geography
  await db.insert(t.districts).values({ name: "Pune", state: "Maharashtra", code: "PUN", launched: true }).onConflictDoNothing();
  const [pune] = await db.select().from(t.districts).where(eq(t.districts.code, "PUN"));
  for (const tk of TALUKAS) await db.insert(t.talukas).values({ ...tk, aliases: tk.aliases ?? [], districtId: pune.id }).onConflictDoNothing();

  await upsertByKey(t.institutionTypes, TYPES.map(([key, name, isPrimary], i) => ({ key, name, isPrimary, sortOrder: i })));
  await upsertByKey(t.pipelineStages, STAGES.map(([key, name, probability, o], i) => ({ key, name, probability, sortOrder: i, ...o })));
  await upsertByKey(t.lostReasons, LOST.map(([key, name]) => ({ key, name })));
  await upsertByKey(t.activityTypes, ACT_TYPES.map(([key, name, countsAsCall], i) => ({ key, name, countsAsCall, sortOrder: i })));
  await upsertByKey(t.scoringParameters, PARAMS.map(([key, name, maxScore, guidance], i) => ({ key, name, maxScore, guidance, sortOrder: i })));
  for (const [i, [key, name, category, pricingType, price, isCore, notes]] of MODULES.entries()) {
    await db.insert(t.productModules).values({ key, name, category, pricingType, price, isCore, notes, description: notes, sortOrder: i, active: true })
      .onConflictDoUpdate({
        target: t.productModules.key,
        set: { name, category, pricingType, price, isCore, notes, description: notes, sortOrder: i, active: true },
      });
  }
  if ((await db.select().from(t.pricingSlabs)).length === 0)
    await db.insert(t.pricingSlabs).values(SLABS.map(([minMembers, maxMembers, ratePerMember, label]) => ({ minMembers, maxMembers, ratePerMember, label })));
  if ((await db.select().from(t.qualificationQuestions)).length === 0)
    await db.insert(t.qualificationQuestions).values(QUESTIONS.map((text, sortOrder) => ({ text, sortOrder })));

  // users
  const roles = Object.fromEntries((await db.select().from(t.roles)).map((r) => [r.key, r.id]));
  await db.insert(t.teams).values({ name: "Pune Sales", region: "Pune" }).onConflictDoNothing();
  const [team] = await db.select().from(t.teams).where(eq(t.teams.name, "Pune Sales"));
  const created: string[] = [];
  async function user(name: string, email: string, role: string, extra: Partial<typeof t.users.$inferInsert> = {}, pw?: string) {
    const exists = await db.select().from(t.users).where(eq(t.users.email, email));
    if (exists.length) return exists[0];
    const password = pw ?? randomBytes(9).toString("base64url") + "7";
    const [u] = await db.insert(t.users).values({ name, email, roleId: roles[role], passwordHash: await bcrypt.hash(password, 12), mustChangePassword: pw ? false : true, ...extra }).returning();
    created.push(`${role.padEnd(16)} ${email}  temporary password: ${password}`);
    return u;
  }
  await user("Amin (Founder & CEO)", process.env.SEED_FOUNDER_EMAIL ?? "amin@fivopay.com", "SUPER_ADMIN", { isFounder: true }, process.env.SEED_FOUNDER_PASSWORD ?? "Amin@123");
  await user("Aryan (Tech Admin)", process.env.SEED_TECH_EMAIL ?? "aryan@fivopay.com", "TECH_ADMIN", {}, process.env.SEED_TECH_PASSWORD ?? "Aryan@123");
  const priya = await user("Priya (BDM)", process.env.SEED_SALES_EMAIL ?? "priya@fivopay.com", "BDM", { teamId: team.id }, process.env.SEED_SALES_PASSWORD ?? "Priya@123");

  // Direct role logins requested: CEO, Tech, Sales
  await user("CEO / Super Admin", "ceo@fivopay.com", "SUPER_ADMIN", { isFounder: true }, "Ceo@1234");
  await user("Tech Administrator", "tech@fivopay.com", "TECH_ADMIN", {}, "Tech@1234");
  await user("Sales Executive", "sales@fivopay.com", "SALES_EXEC", { teamId: team.id }, "Sales@1234");

  if (process.env.SEED_DEMO === "true") await seedDemo(pune.id, priya.id);

  console.log("Seed complete.");
  if (created.length) console.log("\nNew accounts (passwords shown ONCE — must be changed at first login):\n" + created.join("\n"));
  await pool.end();
}

/** Fictitious records for UI review only. Every name is prefixed [DEMO] and tagged "demo". */
async function seedDemo(districtId: string, ownerId: string) {
  const exists = await db.execute(sql`select 1 from institutions where 'demo' = any(tags) limit 1`);
  if (exists.rows.length) return;
  const tks = await db.select().from(t.talukas).where(eq(t.talukas.districtId, districtId));
  const types = await db.select().from(t.institutionTypes);
  const stages = Object.fromEntries((await db.select().from(t.pipelineStages)).map((s) => [s.key, s.id]));
  const ty = (k: string) => types.find((x) => x.key === k)!.id;
  const rows = [
    ["Sample Nagari Patsanstha Alpha", "URBAN_PATSANSTHA", 12000, 6, "NO", "NO", "NONE_IDENTIFIED", "PROPOSAL"],
    ["Sample Employees Credit Society Beta", "EMPLOYEE_CREDIT", 3500, 1, "NO", "UNKNOWN", "PROBABLE_INCUMBENT", "DEMO"],
    ["Sample Urban Credit Society Gamma", "URBAN_CREDIT", 48000, 18, "YES", "NO", "CONFIRMED_INCUMBENT", "NEGOTIATION"],
    ["Sample Teachers Credit Society Delta", "TEACHERS", 2200, 1, "UNKNOWN", "UNKNOWN", "UNKNOWN", "FIRST_CONTACT"],
    ["Sample Multi-State Credit Society Epsilon", "MULTI_STATE_CREDIT", 85000, 32, "YES", "YES", "CONFIRMED_INCUMBENT", "DISCOVERY"],
    ["Sample Police Employees Credit Society Zeta", "POLICE_DEFENCE", 9000, 2, "NO", "NO", "PROBABLE_INCUMBENT", "QUALIFIED"],
    ["Sample Rural Credit Society Eta", "RURAL_CREDIT", null, null, "UNKNOWN", "UNKNOWN", "UNKNOWN", "NEW"],
    ["Sample Salary Earners Society Theta", "SALARY_EARNERS", 6000, 3, "NO", "NO", "NONE_IDENTIFIED", "WON"],
  ] as const;
  let n = 0;
  for (const [name, type, members, branches, app, ekyc, vc, stage] of rows) {
    n++;
    const { rows: seq } = await db.execute<{ n: string }>(sql`select nextval('lead_code_seq') as n`);
    const [inst] = await db.insert(t.institutions).values({
      leadCode: `FP-PUN-${String(seq[0].n).padStart(5, "0")}`, legalName: `[DEMO] ${name}`, typeId: ty(type), districtId, talukaId: tks[n % tks.length].id,
      totalMembers: members, branchCount: branches, mobileApp: app as any, ekyc: ekyc as any, vendorClass: vc as any,
      centralisedCbs: vc === "NONE_IDENTIFIED" ? "NO" : "UNKNOWN", totalDeposits: members ? members * 25000 : null,
      ownerId, tags: ["demo"], dedupeKey: `demo ${name.toLowerCase()}`, notes: "FICTITIOUS demo record for UI review. Delete before go-live.",
    }).returning();
    await db.insert(t.contacts).values({ institutionId: inst.id, name: `Demo Contact ${n}`, role: "CEO_MD", isDecisionMaker: true, verification: "UNVERIFIED" });
    if (n % 2) await db.insert(t.signals).values({ institutionId: inst.id, type: n % 3 ? "BRANCH_EXPANSION" : "VENDOR_DISSATISFACTION", description: "Demo signal", signalDate: new Date(), strength: "HIGH", confidence: "MEDIUM" });
    if (stage !== "NEW") {
      const won = stage === "WON";
      const [d] = await db.insert(t.deals).values({
        institutionId: inst.id, title: `${name} — Fivopay CBS`, stageId: stages[stage], ownerId, members, branches,
        mrr: (members ?? 1000) * 4, implementationFee: 50000, nextAction: won ? null : "Follow up on proposal", followUpDate: new Date(Date.now() + (n - 4) * 864e5),
        wonAt: won ? new Date() : null, financialsLocked: won,
      }).returning();
      await db.insert(t.activities).values({ institutionId: inst.id, dealId: d.id, userId: ownerId, typeKey: "CALL", outcome: "CONNECTED", notes: "Demo call", decisionMakerReached: n % 2 === 0, meaningful: true });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
