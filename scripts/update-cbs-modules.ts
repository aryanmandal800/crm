import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const CBS_MODULES = [
  {
    key: "MEMBERS",
    name: "Member Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5000,
    isCore: true,
    active: true,
    description: "Member share registry, digital membership lifecycle, KYC profile & voting rights",
    notes: "Complete member lifecycle and demographic directory compliant with State Cooperative Societies Act",
  },
  {
    key: "SHARE_MGMT",
    name: "Share Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5500,
    isCore: true,
    active: true,
    description: "Share capital allotment, share certificates, transfer, surrender, nominal & regular share registry",
    notes: "Cooperative Society Act compliant share ledger with automated share warrant generation",
  },
  {
    key: "ACCOUNT_MGMT",
    name: "Account Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 6500,
    isCore: true,
    active: true,
    description: "Savings, current, recurring & term account operations, nominee setup & joint-holder controls",
    notes: "Multi-scheme account configuration with automated ledger linkages and passbook printing",
  },
  {
    key: "DEPOSITS",
    name: "Deposit Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 7500,
    isCore: true,
    active: true,
    description: "Fixed deposits (FD), Recurring deposits (RD), Pigmy/Daily deposits, auto-renewal & deposit lien",
    notes: "Dynamic maturity calculation, premature closure penalties, and digital deposit certificates",
  },
  {
    key: "LOAN_MGMT",
    name: "Loan Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 9000,
    isCore: true,
    active: true,
    description: "End-to-end loan life cycle: application, sanctioning, disbursement, security lien & closure",
    notes: "Comprehensive support for personal, gold, mortgage, vehicle, and agricultural loan schemes",
  },
  {
    key: "INTEREST_MGMT",
    name: "Interest Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 6000,
    isCore: true,
    active: true,
    description: "Configurable interest tables, auto-accrual, compound interest, penal interest & subsidy accounting",
    notes: "Automated daily accrual engine and quarterly/annual capitalization to general ledger",
  },
  {
    key: "EMI",
    name: "EMI Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5500,
    isCore: true,
    active: true,
    description: "Flexible amortisation schedules, reducing vs flat rate EMI, moratorium & prepayment handling",
    notes: "Automated repayment schedule recalculation upon rate revisions or partial principal prepayments",
  },
  {
    key: "RECOVERY_MGMT",
    name: "Recovery Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 7000,
    isCore: true,
    active: true,
    description: "Overdue tracking, automated demand notices, legal notice dispatch, guarantor notices & field recovery",
    notes: "Integrated with SMS/WhatsApp alerts for overdue installments and recovery officer field tracking",
  },
  {
    key: "AGENT_MGMT",
    name: "Agent Management",
    category: "DIGITAL",
    pricingType: "FLAT_MONTHLY",
    price: 7500,
    isCore: false,
    active: true,
    description: "Pigmy / daily collection agent tracking, Bluetooth thermal printer support & commission automation",
    notes: "Seamless mobile collection sync with offline resilience, route limits and instant member receipts",
  },
  {
    key: "BRANCH_MGMT",
    name: "Branch Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 6000,
    isCore: true,
    active: true,
    description: "Multi-branch synchronization, inter-branch transactions, cash counter vaults & cash in transit",
    notes: "Centralized HO administration with branch-wise cash limit governance and day-end balancing",
  },
  {
    key: "GL_MGMT",
    name: "General Ledger Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 8000,
    isCore: true,
    active: true,
    description: "Chart of accounts, hierarchical sub-ledgers, multi-tier GL structure & automatic journal postings",
    notes: "Standardized chart of accounts for cooperative credit societies and urban banks",
  },
  {
    key: "ACCOUNTING",
    name: "Accounting Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 8500,
    isCore: true,
    active: true,
    description: "Day book, cash book, bank book, journal vouchers, trial balance, P&L account & balance sheet",
    notes: "Real-time double-entry bookkeeping with automated financial year-end closing and audit freeze",
  },
  {
    key: "PAYMENTS",
    name: "Payment Management",
    category: "INTEGRATION",
    pricingType: "FLAT_MONTHLY",
    price: 8000,
    isCore: false,
    active: true,
    description: "UPI QR collections, payment gateway integrations, vendor payouts, utility bills & BBPS",
    notes: "Dynamic member QR generation, automated webhook credits and instant reconciliations",
  },
  {
    key: "FUND_TRANSFER",
    name: "Fund Transfer Management",
    category: "INTEGRATION",
    pricingType: "FLAT_MONTHLY",
    price: 7000,
    isCore: false,
    active: true,
    description: "NEFT, RTGS, IMPS settlement, NACH / e-NACH mandates & sponsor bank switch integrations",
    notes: "Direct sponsor bank API connectivity for real-time inter-bank clearing and mandate debiting",
  },
  {
    key: "DIVIDEND_MGMT",
    name: "Dividend Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5000,
    isCore: true,
    active: true,
    description: "Annual dividend calculation, AGM approval tracking, auto-credit to savings accounts & warrant printing",
    notes: "Configurable dividend rate based on profit allocation, bonus shares and withholding tracking",
  },
  {
    key: "EKYC",
    name: "Onboarding & KYC Management",
    category: "INTEGRATION",
    pricingType: "FLAT_MONTHLY",
    price: 7500,
    isCore: false,
    active: true,
    description: "Paperless digital onboarding, Aadhaar OTP eKYC, PAN verification, CKYC search & document OCR",
    notes: "UIDAI & NSDL compliant eKYC pipeline with automated member profile creation",
  },
  {
    key: "DOCUMENT_MGMT",
    name: "Document Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5500,
    isCore: true,
    active: true,
    description: "Digital locker for member identity proofs, loan security documents, title deeds & branch archives",
    notes: "Encrypted cloud document vault with granular access permissions, watermark and audit logging",
  },
  {
    key: "AUDIT_MGMT",
    name: "Audit Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 6500,
    isCore: true,
    active: true,
    description: "Statutory audit logs, concurrent audit verification, transaction vouchers inspection & sampling tools",
    notes: "Dedicated auditor view with tamper-proof chronological event logging and exportable schedules",
  },
  {
    key: "COMPLIANCE_MGMT",
    name: "Compliance Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 7000,
    isCore: true,
    active: true,
    description: "RCS / State Cooperative Act filings, AML/CFT screening, CTR & STR reporting, regulatory limits tracking",
    notes: "Pre-configured cooperative department compliance returns and threshold monitoring alerts",
  },
  {
    key: "USER_ROLE_MGMT",
    name: "User & Role Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5000,
    isCore: true,
    active: true,
    description: "Granular role-based access control (RBAC), multi-factor authentication, IP whitelisting & user activity log",
    notes: "Branch-level teller, manager, clerk and auditor permission profiles with cash drawer limits",
  },
  {
    key: "MAKER_CHECKER",
    name: "Maker-Checker Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5500,
    isCore: true,
    active: true,
    description: "Dual authorization workflow for high-value cash transactions, loan disbursements, GL edits & vouchers",
    notes: "Customizable transaction threshold limits for supervisor approval and multi-level signing",
  },
  {
    key: "MIS",
    name: "Reports & MIS",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 6500,
    isCore: true,
    active: true,
    description: "Over 150+ operational, management, regulatory and financial reports in PDF and Excel formats",
    notes: "Daily cash scrolls, ledger extracts, executive KPI dashboards and registrar statutory statements",
  },
  {
    key: "RECONCILIATION",
    name: "Reconciliation Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 7000,
    isCore: true,
    active: true,
    description: "Automated bank statement reconciliation, switch reconciliation, payment gateway settlement & dispute logs",
    notes: "Automated rule-based matching of bank feeds, gateway settlements and suspense account resolution",
  },
  {
    key: "INTERNET_BANKING",
    name: "Internet Banking",
    category: "DIGITAL",
    pricingType: "FLAT_MONTHLY",
    price: 10000,
    isCore: false,
    active: true,
    description: "Secure web banking portal for members: view balance, mini-statement, fund transfer & service requests",
    notes: "Responsive 2FA-secured portal with custom cooperative society branding and multi-lingual UI",
  },
  {
    key: "NOTIFICATIONS",
    name: "Notification Management",
    category: "DIGITAL",
    pricingType: "FLAT_MONTHLY",
    price: 5500,
    isCore: false,
    active: true,
    description: "Omnichannel transaction alerts via SMS gateway, WhatsApp Business API, email alerts & push notifications",
    notes: "DLT-approved SMS templates, automated loan due reminders and OTP delivery integration",
  },
  {
    key: "NPA_MGMT",
    name: "NPA Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 8500,
    isCore: true,
    active: true,
    description: "Asset classification (SMA-0/1/2, Sub-Standard, Doubtful, Loss), provisioning norms & recovery tracking",
    notes: "Automated day-end IRAC asset classification, provisioning reserve calculations and recovery stage management",
  },
  {
    key: "TAX_TDS_MGMT",
    name: "Tax & TDS Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 6000,
    isCore: true,
    active: true,
    description: "Section 194A deposit interest TDS deduction, 15G/15H form management, Form 16A generation & GST invoicing",
    notes: "Automated TDS computation, e-filing quarterly return export and customer certificate generation",
  },
  {
    key: "FIXED_ASSETS",
    name: "Fixed Asset Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 5500,
    isCore: true,
    active: true,
    description: "Asset registry, barcode/tagging, straight-line & WDV depreciation calculation, disposal & insurance tracking",
    notes: "Automatic periodic depreciation postings directly to general ledger asset and expense accounts",
  },
  {
    key: "BACKUP_MGMT",
    name: "Database & Backup Management",
    category: "CORE",
    pricingType: "FLAT_MONTHLY",
    price: 7500,
    isCore: true,
    active: true,
    description: "Automated hourly database snapshots, point-in-time recovery (PITR), disaster recovery & encrypted replication",
    notes: "Bank-grade encrypted backups ensuring zero data loss, instant failover and regulatory data retention compliance",
  },
];

async function main() {
  console.log("Starting CBS modules synchronization...");

  // Begin transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear old modules to ensure clean slate with exact 29 modules in order
    await client.query("DELETE FROM product_modules");

    for (let i = 0; i < CBS_MODULES.length; i++) {
      const m = CBS_MODULES[i];
      await client.query(
        `INSERT INTO product_modules (
          key, name, description, category, pricing_type, price, is_core, active, sort_order, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          m.key,
          m.name,
          m.description,
          m.category,
          m.pricingType,
          m.price,
          m.isCore,
          m.active,
          i, // sort_order 0..28
          m.notes,
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Successfully synced ${CBS_MODULES.length} CBS modules!`);

    const res = await client.query(
      "SELECT sort_order + 1 as num, key, name, category, price, is_core FROM product_modules ORDER BY sort_order ASC"
    );
    console.table(res.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update modules:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

