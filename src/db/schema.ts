/**
 * Fivopay Intelligence & Sales CRM — relational schema (PostgreSQL, Drizzle ORM)
 *
 * Facts, estimates and AI output are kept apart:
 *  - institution columns hold researched values (null = "Not publicly verified")
 *  - `factStatus` classifies each populated field (VERIFIED_FACT | PUBLICLY_REPORTED | ESTIMATE)
 *  - `sources` holds evidence (URL, date accessed, extract, confidence)
 *  - `insights` holds rule/LLM recommendations — never written into fact columns
 */
import { relations, sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, numeric, jsonb, bigserial, bigint,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (n: string) => timestamp(n, { withTimezone: true, mode: "date" });
const money = (n: string) => numeric(n, { precision: 18, scale: 2, mode: "number" });
const created = () => ts("created_at").notNull().defaultNow();
const updated = () => ts("updated_at").notNull().defaultNow().$onUpdate(() => new Date());

export const triState = pgEnum("tri_state", ["YES", "NO", "UNKNOWN"]);
export const hosting = pgEnum("hosting", ["CLOUD", "ON_PREMISE", "HYBRID", "UNKNOWN"]);
export const vendorClass = pgEnum("vendor_class", ["CONFIRMED_INCUMBENT", "PROBABLE_INCUMBENT", "UNKNOWN", "NONE_IDENTIFIED"]);
export const verification = pgEnum("verification", ["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]);
export const confidence = pgEnum("confidence", ["LOW", "MEDIUM", "HIGH"]);
export const instStatus = pgEnum("inst_status", ["ACTIVE", "INACTIVE", "UNDER_LIQUIDATION", "UNKNOWN"]);
export const factClass = pgEnum("fact_class", ["VERIFIED_FACT", "PUBLICLY_REPORTED", "ESTIMATE"]);
export const contactRole = pgEnum("contact_role", [
  "CHAIRMAN", "VICE_CHAIRMAN", "SECRETARY", "CEO_MD", "GENERAL_MANAGER", "IT_MANAGER",
  "FINANCE_HEAD", "DIRECTOR", "BRANCH_MANAGER", "INFLUENCER", "OTHER",
]);

// ───────────── Identity & access ─────────────

export const roles = pgTable("roles", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});

export const teams = pgTable("teams", {
  id: id(),
  name: text("name").notNull().unique(),
  region: text("region"),
  managerId: uuid("manager_id"),
  createdAt: created(),
});

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  teamId: uuid("team_id").references(() => teams.id),
  isFounder: boolean("is_founder").notNull().default(false),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  tokenVersion: integer("token_version").notNull().default(0),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  lastLoginAt: ts("last_login_at"),
  createdAt: created(),
  updatedAt: updated(),
});

/** Break-glass: time-boxed authorisation for the Technical Administrator to see business data. */
export const dataAccessGrants = pgTable("data_access_grants", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  grantedById: uuid("granted_by_id").notNull().references(() => users.id),
  scope: text("scope").notNull().default("READ"), // READ | READ_EXPORT
  reason: text("reason").notNull(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  createdAt: created(),
});

// ───────────── Geography & taxonomy ─────────────

export const districts = pgTable("districts", {
  id: id(),
  name: text("name").notNull(),
  state: text("state").notNull().default("Maharashtra"),
  code: text("code").notNull(), // used in lead codes: FP-PUN-00001
  active: boolean("active").notNull().default(true),
  launched: boolean("launched").notNull().default(false),
  createdAt: created(),
}, (t) => [uniqueIndex("districts_name_state").on(t.name, t.state)]);

export const talukas = pgTable("talukas", {
  id: id(),
  name: text("name").notNull(),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  districtId: uuid("district_id").notNull().references(() => districts.id),
  active: boolean("active").notNull().default(true),
}, (t) => [uniqueIndex("talukas_district_name").on(t.districtId, t.name)]);

export const institutionTypes = pgTable("institution_types", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  isPrimary: boolean("is_primary").notNull().default(true), // primary credit-society prospect vs expansion category
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// ───────────── Institution master ─────────────

export const institutions = pgTable("institutions", {
  id: id(),
  leadCode: text("lead_code").notNull().unique(),
  legalName: text("legal_name").notNull(),
  shortName: text("short_name"),
  typeId: uuid("type_id").notNull().references(() => institutionTypes.id),
  regNumber: text("reg_number"),
  regDate: ts("reg_date"),
  regAuthority: text("reg_authority"),
  multiState: boolean("multi_state"),
  status: instStatus("status").notNull().default("UNKNOWN"),
  address: text("address"),
  districtId: uuid("district_id").notNull().references(() => districts.id),
  talukaId: uuid("taluka_id").references(() => talukas.id),
  city: text("city"),
  pinCode: text("pin_code"),
  branchCount: integer("branch_count"),
  branchLocations: text("branch_locations"),
  website: text("website"),
  mapsUrl: text("maps_url"),
  socialProfiles: text("social_profiles"),
  // official institutional contact points — never guessed
  landline: text("landline"),
  mobile: text("mobile"),
  email: text("email"),
  contactPageUrl: text("contact_page_url"),
  contactVerification: verification("contact_verification").notNull().default("UNVERIFIED"),
  // size & financials (₹)
  totalMembers: integer("total_members"),
  activeMembers: integer("active_members"),
  totalDeposits: money("total_deposits"),
  loanBook: money("loan_book"),
  totalAssets: money("total_assets"),
  annualIncome: money("annual_income"),
  annualProfit: money("annual_profit"),
  netWorth: money("net_worth"),
  employeeCount: integer("employee_count"),
  txnVolume: text("txn_volume"),
  financialYear: text("financial_year"),
  financialSource: text("financial_source"),
  financialConfidence: confidence("financial_confidence"),
  // technology
  cbsVendor: text("cbs_vendor"),
  cbsProduct: text("cbs_product"),
  vendorWebsite: text("vendor_website"),
  hosting: hosting("hosting").notNull().default("UNKNOWN"),
  vendorClass: vendorClass("vendor_class").notNull().default("UNKNOWN"),
  mobileApp: triState("mobile_app").notNull().default("UNKNOWN"),
  internetBanking: triState("internet_banking").notNull().default("UNKNOWN"),
  upiIntegration: triState("upi_integration").notNull().default("UNKNOWN"),
  digitalLoans: triState("digital_loans").notNull().default("UNKNOWN"),
  ekyc: triState("ekyc").notNull().default("UNKNOWN"),
  centralisedCbs: triState("centralised_cbs").notNull().default("UNKNOWN"),
  memberDigitalServices: text("member_digital_services"),
  recentTechProcurement: text("recent_tech_procurement"),
  contractRenewal: text("contract_renewal"),
  legacyEvidence: text("legacy_evidence"),
  techComplaints: text("tech_complaints"),
  // research state
  verification: verification("verification").notNull().default("UNVERIFIED"),
  dataConfidence: confidence("data_confidence").notNull().default("LOW"),
  factStatus: jsonb("fact_status").$type<Record<string, string>>().notNull().default({}),
  qualification: jsonb("qualification").$type<Record<string, string>>().notNull().default({}),
  manualScores: jsonb("manual_scores").$type<Record<string, number>>().notNull().default({}),
  lastVerifiedAt: ts("last_verified_at"),
  nextVerificationAt: ts("next_verification_at"),
  shariahInterest: boolean("shariah_interest").notNull().default(false),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  // intelligence (computed — never treated as fact)
  score: integer("score").notNull().default(0),
  scoreBand: text("score_band").notNull().default("LOW"),
  scoreBreakdown: jsonb("score_breakdown").$type<ScoreLine[]>().notNull().default([]),
  missingInfo: text("missing_info").array().notNull().default(sql`'{}'::text[]`),
  opportunityCategory: text("opportunity_category").notNull().default("NOT_QUALIFIED"),
  insights: jsonb("insights").$type<Insights | null>(),
  insightsAt: ts("insights_at"),
  insightsSource: text("insights_source"),
  scoredAt: ts("scored_at"),
  ownerId: uuid("owner_id").references(() => users.id),
  researchedById: uuid("researched_by_id").references(() => users.id),
  dedupeKey: text("dedupe_key").notNull(),
  deletedAt: ts("deleted_at"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  index("inst_geo").on(t.districtId, t.talukaId),
  index("inst_type").on(t.typeId),
  index("inst_owner").on(t.ownerId),
  index("inst_band").on(t.scoreBand),
  index("inst_dedupe").on(t.dedupeKey),
  index("inst_reg").on(t.regNumber),
]);

export type ScoreLine = { key: string; name: string; max: number; points: number; reason: string; missing?: string[] };
export type Insights = {
  whyApproach: string; whyNow: string; painPoint: string; evidence: string[]; missing: string[];
  influencers: string; modules: string[]; price: string; blockers: string; nextAction: string;
  disclaimer: string;
};

export const contacts = pgTable("contacts", {
  id: id(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: contactRole("role").notNull().default("OTHER"),
  designation: text("designation"),
  isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
  isFinalApprover: boolean("is_final_approver").notNull().default(false),
  isChampion: boolean("is_champion").notNull().default(false),
  isInfluencer: boolean("is_influencer").notNull().default(false),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  linkedinUrl: text("linkedin_url"),
  verification: verification("verification").notNull().default("UNVERIFIED"),
  relationshipStrength: integer("relationship_strength").notNull().default(0),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  lastMetAt: ts("last_met_at"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("contacts_inst").on(t.institutionId)]);

export const signals = pgTable("signals", {
  id: id(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  evidenceUrl: text("evidence_url"),
  signalDate: ts("signal_date"),
  strength: confidence("strength").notNull().default("MEDIUM"),
  confidence: confidence("confidence").notNull().default("MEDIUM"),
  recommendedAction: text("recommended_action"),
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: created(),
}, (t) => [index("signals_inst").on(t.institutionId)]);

export const competitors = pgTable("competitors", {
  id: id(),
  name: text("name").notNull().unique(),
  product: text("product"),
  website: text("website"),
  features: text("features"),
  targetSegment: text("target_segment"),
  publicPricing: text("public_pricing"),
  verifiedCustomers: text("verified_customers"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  differentiation: text("differentiation"),
  positioning: text("positioning"),
  verification: verification("verification").notNull().default("UNVERIFIED"),
  createdAt: created(),
  updatedAt: updated(),
});

export const sources = pgTable("sources", {
  id: id(),
  institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "cascade" }),
  competitorId: uuid("competitor_id").references(() => competitors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url"),
  accessedAt: ts("accessed_at").notNull().defaultNow(),
  evidence: text("evidence"),
  fieldKeys: text("field_keys").array().notNull().default(sql`'{}'::text[]`),
  classification: factClass("classification").notNull().default("PUBLICLY_REPORTED"),
  verification: verification("verification").notNull().default("UNVERIFIED"),
  confidence: confidence("confidence").notNull().default("MEDIUM"),
  lastVerifiedAt: ts("last_verified_at"),
  nextVerificationAt: ts("next_verification_at"),
  notes: text("notes"),
  addedById: uuid("added_by_id").references(() => users.id),
  createdAt: created(),
}, (t) => [index("sources_inst").on(t.institutionId)]);

// ───────────── Pipeline ─────────────

export const pipelineStages = pgTable("pipeline_stages", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  probability: integer("probability").notNull().default(0),
  isOpen: boolean("is_open").notNull().default(true),
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
  isQualified: boolean("is_qualified").notNull().default(false), // counts as "qualified" in KPIs
  stallDays: integer("stall_days").notNull().default(14),
  active: boolean("active").notNull().default(true),
});

export const lostReasons = pgTable("lost_reasons", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

export const deals = pgTable("deals", {
  id: id(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id),
  title: text("title").notNull(),
  stageId: uuid("stage_id").notNull().references(() => pipelineStages.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  opportunityCategory: text("opportunity_category").notNull().default("GREENFIELD_CBS"),
  modules: text("modules").array().notNull().default(sql`'{}'::text[]`),
  members: integer("members"),
  branches: integer("branches"),
  mrr: money("mrr").notNull().default(0),
  implementationFee: money("implementation_fee").notNull().default(0),
  probabilityOverride: integer("probability_override"),
  expectedCloseDate: ts("expected_close_date"),
  nextAction: text("next_action"),
  followUpDate: ts("follow_up_date"),
  founderFlag: boolean("founder_flag").notNull().default(false),
  founderFlagReason: text("founder_flag_reason"),
  lostReasonId: uuid("lost_reason_id").references(() => lostReasons.id),
  lostNotes: text("lost_notes"),
  competitorId: uuid("competitor_id").references(() => competitors.id),
  stageChangedAt: ts("stage_changed_at").notNull().defaultNow(),
  wonAt: ts("won_at"),
  lostAt: ts("lost_at"),
  financialsLocked: boolean("financials_locked").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("deals_stage").on(t.stageId), index("deals_owner").on(t.ownerId), index("deals_inst").on(t.institutionId)]);

export const dealStageHistory = pgTable("deal_stage_history", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  changedById: uuid("changed_by_id").references(() => users.id),
  changedAt: ts("changed_at").notNull().defaultNow(),
  note: text("note"),
});

// ───────────── Activities & tasks ─────────────

export const activityTypes = pgTable("activity_types", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  countsAsCall: boolean("counts_as_call").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const activities = pgTable("activities", {
  id: id(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id),
  dealId: uuid("deal_id").references(() => deals.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  typeKey: text("type_key").notNull(),
  status: text("status").notNull().default("DONE"), // PLANNED | DONE | CANCELLED
  outcome: text("outcome"),
  occurredAt: ts("occurred_at").notNull().defaultNow(),
  notes: text("notes"),
  objection: text("objection"),
  feedback: text("feedback"),
  nextAction: text("next_action"),
  followUpDate: ts("follow_up_date"),
  decisionMakerReached: boolean("decision_maker_reached").notNull().default(false),
  meaningful: boolean("meaningful").notNull().default(false),
  createdAt: created(),
}, (t) => [index("act_user_time").on(t.userId, t.occurredAt), index("act_inst").on(t.institutionId)]);

export const tasks = pgTable("tasks", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").notNull().references(() => users.id),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  institutionId: uuid("institution_id").references(() => institutions.id),
  dealId: uuid("deal_id").references(() => deals.id),
  dueAt: ts("due_at"),
  priority: text("priority").notNull().default("MEDIUM"),
  status: text("status").notNull().default("OPEN"),
  completedAt: ts("completed_at"),
  createdAt: created(),
});

// ───────────── Catalogue, pricing, quotes, approvals ─────────────

export const productModules = pgTable("product_modules", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("CORE"),
  pricingType: text("pricing_type").notNull().default("INCLUDED"), // INCLUDED | PER_MEMBER | FLAT_MONTHLY | PER_BRANCH | ONE_TIME
  price: money("price").notNull().default(0),
  isCore: boolean("is_core").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
});

export const pricingSlabs = pgTable("pricing_slabs", {
  id: id(),
  minMembers: integer("min_members").notNull(),
  maxMembers: integer("max_members"),
  ratePerMember: numeric("rate_per_member", { precision: 8, scale: 2, mode: "number" }).notNull(),
  label: text("label"),
});

export type QuoteLine = { key: string; name: string; kind: "MONTHLY" | "ONE_TIME"; amount: number; note?: string };
export type Milestone = { name: string; pct: number; trigger: string };

export const quotes = pgTable("quotes", {
  id: id(),
  number: text("number").notNull().unique(),
  serial: integer("serial").notNull().unique(),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id),
  dealId: uuid("deal_id").references(() => deals.id),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  status: text("status").notNull().default("DRAFT"),
  model: text("model").notNull().default("MEMBER"),
  members: integer("members").notNull().default(0),
  branches: integer("branches").notNull().default(1),
  modules: text("modules").array().notNull().default(sql`'{}'::text[]`),
  lines: jsonb("lines").$type<QuoteLine[]>().notNull().default([]),
  scope: text("scope"),
  ratePerMember: numeric("rate_per_member", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
  monthlyFee: money("monthly_fee").notNull().default(0),
  implementationFee: money("implementation_fee").notNull().default(0),
  migrationFee: money("migration_fee").notNull().default(0),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(18),
  terms: text("terms"),
  milestones: jsonb("milestones").$type<Milestone[]>().notNull().default([]),
  validUntil: ts("valid_until"),
  approvedById: uuid("approved_by_id").references(() => users.id),
  approvedAt: ts("approved_at"),
  sentAt: ts("sent_at"),
  createdAt: created(),
  updatedAt: updated(),
});

export const approvalRequests = pgTable("approval_requests", {
  id: id(),
  type: text("type").notNull(), // DISCOUNT | PRICE_EXCEPTION | DEAL_VALUE_EDIT | CHANGE_REQUEST
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  requestedById: uuid("requested_by_id").notNull().references(() => users.id),
  status: text("status").notNull().default("PENDING"),
  decidedById: uuid("decided_by_id").references(() => users.id),
  decidedAt: ts("decided_at"),
  decisionNote: text("decision_note"),
  createdAt: created(),
}, (t) => [index("approvals_status").on(t.status)]);

// ───────────── Onboarding ─────────────

export type OnboardingStep = { key: string; name: string; status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED"; dueDate?: string | null; notes?: string; completedAt?: string | null };

export const onboardings = pgTable("onboardings", {
  id: id(),
  dealId: uuid("deal_id").notNull().unique().references(() => deals.id),
  institutionId: uuid("institution_id").notNull().references(() => institutions.id),
  ownerId: uuid("owner_id").references(() => users.id),
  status: text("status").notNull().default("IN_PROGRESS"),
  steps: jsonb("steps").$type<OnboardingStep[]>().notNull().default([]),
  contractValue: money("contract_value").notNull().default(0),
  advanceReceived: money("advance_received").notNull().default(0),
  outstandingAmount: money("outstanding_amount").notNull().default(0),
  goLiveDate: ts("go_live_date"),
  notes: text("notes"),
  createdAt: created(),
  updatedAt: updated(),
});

// ───────────── Change requests ─────────────

export type CrEvent = { at: string; by: string; action: string; note?: string };

export const changeRequests = pgTable("change_requests", {
  id: id(),
  code: text("code").notNull().unique(),
  requestedById: uuid("requested_by_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  businessReason: text("business_reason"),
  priority: text("priority").notNull().default("MEDIUM"),
  category: text("category").notNull(), // CONFIGURATION | DATA | DEVELOPMENT | SECURITY | INFRASTRUCTURE
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  proposedSolution: text("proposed_solution"),
  approvalRequired: boolean("approval_required").notNull().default(false),
  approvalStatus: text("approval_status").notNull().default("NOT_REQUIRED"),
  status: text("status").notNull().default("REQUESTED"),
  testingStatus: text("testing_status").notNull().default("NOT_STARTED"),
  completedAt: ts("completed_at"),
  changeNotes: text("change_notes"),
  history: jsonb("history").$type<CrEvent[]>().notNull().default([]),
  createdAt: created(),
  updatedAt: updated(),
});

// ───────────── Configuration ─────────────

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  category: text("category").notNull(),
  label: text("label"),
  description: text("description"),
  ownerRole: text("owner_role").notNull().default("SUPER_ADMIN"), // SUPER_ADMIN (business) | TECH_ADMIN (technical)
  updatedById: uuid("updated_by_id"),
  updatedAt: updated(),
});

export const scoringParameters = pgTable("scoring_parameters", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  maxScore: integer("max_score").notNull(),
  kind: text("kind").notNull().default("BUILTIN"), // BUILTIN | MANUAL
  guidance: text("guidance"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const qualificationQuestions = pgTable("qualification_questions", {
  id: id(),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const targets = pgTable("targets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  period: text("period").notNull(), // YYYY-MM
  metric: text("metric").notNull(), // CALLS | MEETINGS | DEMOS | PROPOSALS | WON_DEALS | MRR
  value: integer("value").notNull(),
}, (t) => [uniqueIndex("targets_unique").on(t.userId, t.period, t.metric)]);

// ───────────── Ops & observability ─────────────

/** Append-only. UPDATE/DELETE are blocked by a database trigger (see migrations/0001_hardening.sql). */
export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: ts("at").notNull().defaultNow(),
  actorId: uuid("actor_id"),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
}, (t) => [index("audit_entity").on(t.entityType, t.entityId), index("audit_at").on(t.at)]);

export const errorLogs = pgTable("error_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: ts("at").notNull().defaultNow(),
  route: text("route"),
  method: text("method"),
  status: integer("status"),
  message: text("message").notNull(),
  stack: text("stack"),
  userId: uuid("user_id"),
});

export const jobs = pgTable("jobs", {
  id: id(),
  type: text("type").notNull(),
  status: text("status").notNull().default("QUEUED"), // QUEUED | RUNNING | DONE | FAILED
  attempts: integer("attempts").notNull().default(0),
  payload: jsonb("payload").notNull().default({}),
  result: jsonb("result"),
  lastError: text("last_error"),
  runAt: ts("run_at").notNull().defaultNow(),
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  createdAt: created(),
}, (t) => [index("jobs_status_run").on(t.status, t.runAt)]);

export const backups = pgTable("backups", {
  id: id(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  status: text("status").notNull().default("RUNNING"),
  file: text("file"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  error: text("error"),
  trigger: text("trigger").notNull().default("SCHEDULED"),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  channel: text("channel").notNull().default("IN_APP"),
  delivery: text("delivery").notNull().default("DELIVERED"), // DELIVERED | PENDING | FAILED
  error: text("error"),
  readAt: ts("read_at"),
  createdAt: created(),
}, (t) => [index("notif_user").on(t.userId, t.readAt)]);

// ───────────── Relations (for the query API) ─────────────

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
}));
export const institutionsRelations = relations(institutions, ({ one, many }) => ({
  type: one(institutionTypes, { fields: [institutions.typeId], references: [institutionTypes.id] }),
  district: one(districts, { fields: [institutions.districtId], references: [districts.id] }),
  taluka: one(talukas, { fields: [institutions.talukaId], references: [talukas.id] }),
  owner: one(users, { fields: [institutions.ownerId], references: [users.id] }),
  contacts: many(contacts), signals: many(signals), sources: many(sources), deals: many(deals), activities: many(activities),
}));
export const talukasRelations = relations(talukas, ({ one }) => ({
  district: one(districts, { fields: [talukas.districtId], references: [districts.id] }),
}));
export const contactsRelations = relations(contacts, ({ one }) => ({
  institution: one(institutions, { fields: [contacts.institutionId], references: [institutions.id] }),
}));
export const signalsRelations = relations(signals, ({ one }) => ({
  institution: one(institutions, { fields: [signals.institutionId], references: [institutions.id] }),
}));
export const sourcesRelations = relations(sources, ({ one }) => ({
  institution: one(institutions, { fields: [sources.institutionId], references: [institutions.id] }),
  competitor: one(competitors, { fields: [sources.competitorId], references: [competitors.id] }),
}));
export const dealsRelations = relations(deals, ({ one, many }) => ({
  institution: one(institutions, { fields: [deals.institutionId], references: [institutions.id] }),
  stage: one(pipelineStages, { fields: [deals.stageId], references: [pipelineStages.id] }),
  owner: one(users, { fields: [deals.ownerId], references: [users.id] }),
  lostReason: one(lostReasons, { fields: [deals.lostReasonId], references: [lostReasons.id] }),
  competitor: one(competitors, { fields: [deals.competitorId], references: [competitors.id] }),
  history: many(dealStageHistory),
}));
export const dealStageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
  deal: one(deals, { fields: [dealStageHistory.dealId], references: [deals.id] }),
}));
export const activitiesRelations = relations(activities, ({ one }) => ({
  institution: one(institutions, { fields: [activities.institutionId], references: [institutions.id] }),
  deal: one(deals, { fields: [activities.dealId], references: [deals.id] }),
  contact: one(contacts, { fields: [activities.contactId], references: [contacts.id] }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));
export const competitorsRelations = relations(competitors, ({ many }) => ({ sources: many(sources) }));
export const quotesRelations = relations(quotes, ({ one }) => ({
  institution: one(institutions, { fields: [quotes.institutionId], references: [institutions.id] }),
  deal: one(deals, { fields: [quotes.dealId], references: [deals.id] }),
  createdBy: one(users, { fields: [quotes.createdById], references: [users.id] }),
}));
export const onboardingsRelations = relations(onboardings, ({ one }) => ({
  deal: one(deals, { fields: [onboardings.dealId], references: [deals.id] }),
  institution: one(institutions, { fields: [onboardings.institutionId], references: [institutions.id] }),
  owner: one(users, { fields: [onboardings.ownerId], references: [users.id] }),
}));
export const changeRequestsRelations = relations(changeRequests, ({ one }) => ({
  requestedBy: one(users, { fields: [changeRequests.requestedById], references: [users.id] }),
  assignedTo: one(users, { fields: [changeRequests.assignedToId], references: [users.id] }),
}));
export const approvalRequestsRelations = relations(approvalRequests, ({ one }) => ({
  requestedBy: one(users, { fields: [approvalRequests.requestedById], references: [users.id] }),
}));
export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  institution: one(institutions, { fields: [tasks.institutionId], references: [institutions.id] }),
}));
