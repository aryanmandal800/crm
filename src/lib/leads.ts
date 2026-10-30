import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";

const STOP = new Set(["the", "co", "op", "operative", "cooperative", "coop", "credit", "society", "societies", "ltd", "limited", "maryadit", "mydt", "sahakari", "sah", "patsanstha", "pat", "sanstha", "pvt", "and"]);
export function dedupeKey(name: string) {
  return name.toLowerCase().replace(/co-?op(erative)?/g, " cooperative ").replace(/[^a-z0-9ऀ-ॿ ]+/g, " ")
    .split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ").trim() || name.toLowerCase().trim();
}

export async function nextLeadCode(districtId: string) {
  const [d] = await db.select({ code: t.districts.code }).from(t.districts).where(eq(t.districts.id, districtId));
  const { rows } = await db.execute<{ n: string }>(sql`select nextval('lead_code_seq') as n`);
  return `FP-${d?.code ?? "XXX"}-${String(rows[0].n).padStart(5, "0")}`;
}

/** Exact duplicates (same registration number, or same normalised name in the same taluka) and fuzzy name matches. */
export async function findDuplicates(input: { legalName: string; regNumber?: string | null; talukaId?: string | null; excludeId?: string }) {
  const key = dedupeKey(input.legalName);
  const exact = await db.select({ id: t.institutions.id, leadCode: t.institutions.leadCode, legalName: t.institutions.legalName })
    .from(t.institutions).where(and(isNull(t.institutions.deletedAt), input.excludeId ? ne(t.institutions.id, input.excludeId) : sql`true`,
      or(input.regNumber ? eq(t.institutions.regNumber, input.regNumber) : sql`false`,
        and(eq(t.institutions.dedupeKey, key), input.talukaId ? eq(t.institutions.talukaId, input.talukaId) : sql`true`))));
  const { rows: fuzzy } = await db.execute<{ id: string; lead_code: string; legal_name: string; sim: number }>(sql`
    select id, lead_code, legal_name, similarity(legal_name, ${input.legalName}) as sim from institutions
    where deleted_at is null and similarity(legal_name, ${input.legalName}) > 0.55 ${input.excludeId ? sql`and id <> ${input.excludeId}` : sql``}
    order by sim desc limit 5`);
  return { exact, fuzzy: fuzzy.filter((f) => !exact.some((e) => e.id === f.id)).map((f) => ({ id: f.id, leadCode: f.lead_code, legalName: f.legal_name, similarity: Number(f.sim) })) };
}

const opt = <T extends z.ZodTypeAny>(s: T) => s.optional().nullable();
const tri = z.enum(["YES", "NO", "UNKNOWN"]);
const conf = z.enum(["LOW", "MEDIUM", "HIGH"]);
const ver = z.enum(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]);
const date = z.preprocess((v) => (v === "" || v == null ? null : new Date(v as string)), z.date().nullable()).optional();
const int = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()).optional();
const amt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nullable()).optional();
const str = z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v), z.string().max(4000).nullable()).optional();

/** Fields a user may set on an institution. Score/insight columns are computed only. */
export const institutionInput = z.object({
  legalName: z.string().trim().min(3).max(300),
  shortName: str, typeId: z.string().uuid(), regNumber: str, regDate: date, regAuthority: str,
  multiState: z.boolean().nullable().optional(), status: z.enum(["ACTIVE", "INACTIVE", "UNDER_LIQUIDATION", "UNKNOWN"]).optional(),
  address: str, districtId: z.string().uuid(), talukaId: opt(z.string().uuid()), city: str, pinCode: opt(z.string().regex(/^\d{6}$/, "PIN must be 6 digits")),
  branchCount: int, branchLocations: str, website: str, mapsUrl: str, socialProfiles: str,
  landline: str, mobile: str, email: opt(z.string().email()), contactPageUrl: str, contactVerification: ver.optional(),
  totalMembers: int, activeMembers: int, totalDeposits: amt, loanBook: amt, totalAssets: amt, annualIncome: amt, annualProfit: amt, netWorth: amt,
  employeeCount: int, txnVolume: str, financialYear: str, financialSource: str, financialConfidence: conf.nullable().optional(),
  cbsVendor: str, cbsProduct: str, vendorWebsite: str, hosting: z.enum(["CLOUD", "ON_PREMISE", "HYBRID", "UNKNOWN"]).optional(),
  vendorClass: z.enum(["CONFIRMED_INCUMBENT", "PROBABLE_INCUMBENT", "UNKNOWN", "NONE_IDENTIFIED"]).optional(),
  mobileApp: tri.optional(), internetBanking: tri.optional(), upiIntegration: tri.optional(), digitalLoans: tri.optional(), ekyc: tri.optional(), centralisedCbs: tri.optional(),
  memberDigitalServices: str, recentTechProcurement: str, contractRenewal: str, legacyEvidence: str, techComplaints: str,
  verification: ver.optional(), dataConfidence: conf.optional(), factStatus: z.record(z.string(), z.enum(["VERIFIED_FACT", "PUBLICLY_REPORTED", "ESTIMATE"])).optional(),
  qualification: z.record(z.string(), z.string()).optional(), manualScores: z.record(z.string(), z.number()).optional(),
  lastVerifiedAt: date, nextVerificationAt: date, shariahInterest: z.boolean().optional(), tags: z.array(z.string().max(40)).max(20).optional(), notes: str,
  ownerId: opt(z.string().uuid()),
});
export type InstitutionInput = z.infer<typeof institutionInput>;

/** Fields a Sales Executive may change (contact details, notes) — everything else needs lead.edit + research rights. */
export const EXEC_EDITABLE = ["landline", "mobile", "email", "contactPageUrl", "website", "address", "notes", "qualification", "branchLocations"];
