import { z } from "zod";
const s = z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v), z.string().max(4000).nullable()).optional();
const d = z.preprocess((v) => (v === "" || v == null ? null : new Date(v as string)), z.date().nullable()).optional();
const conf = z.enum(["LOW", "MEDIUM", "HIGH"]);
const ver = z.enum(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]);
const url = z.preprocess((v) => (v === "" ? null : v), z.string().url().max(2000).nullable()).optional();

export const contactInput = z.object({
  name: z.string().trim().min(2).max(200),
  role: z.enum(["CHAIRMAN", "VICE_CHAIRMAN", "SECRETARY", "CEO_MD", "GENERAL_MANAGER", "IT_MANAGER", "FINANCE_HEAD", "DIRECTOR", "BRANCH_MANAGER", "INFLUENCER", "OTHER"]),
  designation: s, isDecisionMaker: z.boolean().optional(), isFinalApprover: z.boolean().optional(), isChampion: z.boolean().optional(), isInfluencer: z.boolean().optional(),
  businessPhone: s, businessEmail: z.preprocess((v) => (v === "" ? null : v), z.string().email().nullable()).optional(), linkedinUrl: url,
  verification: ver.optional(), relationshipStrength: z.number().int().min(0).max(5).optional(), sourceUrl: url, notes: s, lastMetAt: d,
});

export const signalInput = z.object({
  type: z.string().min(2).max(60), description: z.string().trim().min(3).max(2000), evidenceUrl: url, signalDate: d,
  strength: conf.optional(), confidence: conf.optional(), recommendedAction: s,
});

export const sourceInput = z.object({
  name: z.string().trim().min(2).max(300), url, accessedAt: d, evidence: s, fieldKeys: z.array(z.string()).max(60).optional(),
  classification: z.enum(["VERIFIED_FACT", "PUBLICLY_REPORTED", "ESTIMATE"]).optional(), verification: ver.optional(), confidence: conf.optional(),
  lastVerifiedAt: d, nextVerificationAt: d, notes: s,
});

export const SIGNAL_LABELS: Record<string, string> = {
  BRANCH_EXPANSION: "Branch expansion", MEMBERSHIP_GROWTH: "Membership expansion", NEW_MANAGEMENT: "New management / board",
  DIGITAL_TRANSFORMATION: "Digital transformation initiative", CBS_TENDER: "CBS / software tender", REPLACEMENT_REQUIREMENT: "Replacement requirement",
  VENDOR_DISSATISFACTION: "Existing vendor dissatisfaction", TECH_RECRUITMENT: "Technology recruitment", NEW_MOBILE_APP: "New mobile application",
  DIGITAL_SERVICES: "Digital services launch", REGULATORY_AUDIT: "Regulatory / audit-driven tech need", MERGER: "Merger or expansion",
  TECH_PARTNERSHIP: "New technology partnership", CONTRACT_EXPIRY: "Contract renewal / expiry",
};

const cs = z.preprocess((v) => (typeof v === "string" ? (v.trim() || null) : v), z.string().max(6000).nullable()).optional();
export const competitorInput = z.object({ name: z.string().trim().min(2).max(200), product: cs, website: cs, features: cs, targetSegment: cs, publicPricing: cs, verifiedCustomers: cs,
  strengths: cs, weaknesses: cs, differentiation: cs, positioning: cs, verification: z.enum(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]).optional() });

export const moduleSchema = z.object({ key: z.string().regex(/^[A-Z0-9_]{2,40}$/, "Key: CAPITALS_AND_UNDERSCORES"), name: z.string().min(2).max(200), description: z.string().max(2000).nullable().optional(),
  category: z.enum(["CORE", "DIGITAL", "INTEGRATION", "SERVICE"]), pricingType: z.enum(["INCLUDED", "PER_MEMBER", "FLAT_MONTHLY", "PER_BRANCH", "ONE_TIME"]),
  price: z.number().min(0), isCore: z.boolean().optional(), active: z.boolean().optional(), notes: z.string().max(2000).nullable().optional() });
