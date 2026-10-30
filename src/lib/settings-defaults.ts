export type SettingDef = { value: unknown; category: string; label: string; description?: string; ownerRole?: "SUPER_ADMIN" | "TECH_ADMIN" };

const A = "ASSUMPTION — not a verified market rate. Edit to suit.";

/** Defaults are seeded once; afterwards the database is the source of truth (editable in Settings). */
export const SETTING_DEFAULTS: Record<string, SettingDef> = {
  "company.name": { value: "MANALIX TECHNOLOGIES PRIVATE LIMITED", category: "COMPANY", label: "Legal entity" },
  "company.product": { value: "Fivopay", category: "COMPANY", label: "Product name" },
  "company.tagline": { value: "Making Banking Easier", category: "COMPANY", label: "Tagline" },
  "company.website": { value: "https://fivopay.com", category: "COMPANY", label: "Website", description: "Verify before use on proposals." },
  "company.address": { value: "Viman Nagar, Pune, Maharashtra, India", category: "COMPANY", label: "Address" },
  "company.cin": { value: "U62090PN2025PTC236810", category: "COMPANY", label: "CIN" },
  "company.gstin": { value: "27ABOCS9740H1ZP", category: "COMPANY", label: "GSTIN" },
  "company.phone": { value: "9096081885", category: "COMPANY", label: "Phone" },
  "company.email": { value: "info@fivopay.com", category: "COMPANY", label: "Email" },

  "pricing.listRate": { value: 5, category: "PRICING", label: "List rate (₹/member/month)", description: "Benchmark list price." },
  "pricing.floorRate": { value: 3, category: "PRICING", label: "Floor rate (₹/member/month)", description: "Below this needs Super Admin approval." },
  "pricing.useSlabs": { value: true, category: "PRICING", label: "Apply member slabs (volume pricing)" },
  "pricing.minMonthly": { value: 3000, category: "PRICING", label: "Minimum monthly billing (₹)", description: A },
  "pricing.branchMonthly": { value: 1500, category: "PRICING", label: "Per-branch monthly fee (₹) — branch model", description: A },
  "pricing.branchBaseMonthly": { value: 5000, category: "PRICING", label: "Base monthly fee (₹) — branch model", description: A },
  "pricing.implBase": { value: 50000, category: "PRICING", label: "Implementation base (₹, one-time)", description: A },
  "pricing.implPerBranch": { value: 5000, category: "PRICING", label: "Implementation per branch (₹)", description: A },
  "pricing.migrationBase": { value: 25000, category: "PRICING", label: "Legacy migration base (₹)", description: A },
  "pricing.migrationPerBranch": { value: 2500, category: "PRICING", label: "Migration per branch (₹)", description: A },
  "pricing.migrationMultiplier": { value: { NONE: 0, LOW: 1, MEDIUM: 1.5, HIGH: 2.5 }, category: "PRICING", label: "Migration complexity multipliers" },
  "pricing.integrationEach": { value: 15000, category: "PRICING", label: "Per third-party integration setup (₹)", description: A },
  "pricing.trainingPerDay": { value: 5000, category: "PRICING", label: "On-site training per day (₹)", description: A },
  "pricing.dedicatedHostingMonthly": { value: 10000, category: "PRICING", label: "Dedicated hosting surcharge (₹/month)", description: A },
  "pricing.slaPremiumPct": { value: { STANDARD: 0, PRIORITY: 10, PREMIUM: 20 }, category: "PRICING", label: "SLA premium (% of monthly)" },
  "pricing.txnVolumeUpliftPct": { value: { LOW: 0, MEDIUM: 5, HIGH: 10 }, category: "PRICING", label: "Enterprise transaction-volume uplift (%)", description: A },
  "pricing.maxDiscountNoApprovalPct": { value: 10, category: "PRICING", label: "Max discount without approval (%)" },
  "pricing.pilotMonths": { value: 3, category: "PRICING", label: "Paid pilot duration (months)" },
  "pricing.pilotFeePct": { value: 50, category: "PRICING", label: "Paid pilot fee (% of pro-rata monthly)", description: A },
  "pricing.enterpriseMembers": { value: 50000, category: "PRICING", label: "Enterprise threshold — members" },
  "pricing.enterpriseBranches": { value: 15, category: "PRICING", label: "Enterprise threshold — branches" },
  "pricing.gstRate": { value: 18, category: "PRICING", label: "GST rate (%)", description: "GST assumption applied to quotations." },
  "pricing.quoteValidityDays": { value: 30, category: "PRICING", label: "Quote validity (days)" },
  "pricing.thirdPartyNote": { value: "Third-party charges (cloud hosting at scale, SMS, WhatsApp, eKYC, eSign, eStamp, payment gateway and other APIs) are excluded and billed at actuals.", category: "PRICING", label: "Third-party cost note" },
  "pricing.milestones": { value: [{ name: "Advance on signing", pct: 50, trigger: "Agreement execution" }, { name: "UAT sign-off", pct: 30, trigger: "UAT acceptance" }, { name: "Go-live", pct: 20, trigger: "Production go-live" }], category: "PRICING", label: "Default implementation payment milestones" },
  "pricing.terms": { value: "1. Subscription billed monthly in advance from go-live.\n2. Implementation fee payable per milestones.\n3. Prices exclusive of GST.\n4. Data remains the property of the institution.\n5. Subject to a signed SaaS agreement.", category: "PRICING", label: "Default commercial terms" },

  "scoring.bands": { value: { HOT: 75, WARM: 55, NURTURE: 35 }, category: "SCORING", label: "Score bands (minimum score)" },
  "scoring.signalRecencyMonths": { value: 12, category: "SCORING", label: "Signals older than this count half (months)" },

  "sales.noContactDays": { value: 14, category: "SALES", label: "Hot lead at risk after N days without activity" },
  "sales.quotePrefix": { value: "FP/CP", category: "SALES", label: "Quote number prefix", description: "Format: PREFIX/CLIENT-CODE/YYYY/NNN" },
  "sales.quoteNextSerial": { value: 40, category: "SALES", label: "Next quote serial", description: "Continues the existing register (039 was last used)." },
  "sales.verificationIntervalDays": { value: 180, category: "SALES", label: "Re-verify research every N days" },

  "ai.provider": { value: "RULES", category: "AI", label: "Insight engine (RULES or ANTHROPIC)", ownerRole: "TECH_ADMIN", description: "API key is read from ANTHROPIC_API_KEY env var, never stored in the database." },
  "ai.model": { value: "claude-sonnet-5-5", category: "AI", label: "LLM model id", ownerRole: "TECH_ADMIN" },
  "ai.maxTokens": { value: 1500, category: "AI", label: "LLM max output tokens", ownerRole: "TECH_ADMIN" },
  "notify.emailEnabled": { value: false, category: "NOTIFY", label: "Send email notifications (SMTP_* env vars)", ownerRole: "TECH_ADMIN" },
  "notify.followupReminders": { value: true, category: "NOTIFY", label: "Daily follow-up reminders", ownerRole: "TECH_ADMIN" },
  "notify.dailySummary": { value: true, category: "NOTIFY", label: "Daily sales summary to Founder", ownerRole: "TECH_ADMIN" },
  "backup.retentionDays": { value: 14, category: "SYSTEM", label: "Backup retention (days)", ownerRole: "TECH_ADMIN" },
  "backup.dir": { value: "./backups", category: "SYSTEM", label: "Backup directory", ownerRole: "TECH_ADMIN" },
};

