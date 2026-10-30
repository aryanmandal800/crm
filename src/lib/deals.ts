import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { OnboardingStep } from "@/db/schema";

export const ONBOARDING_STEPS: [string, string][] = [
  ["AGREEMENT", "Agreement signed"], ["ADVANCE", "Advance payment received"], ["OWNER", "Implementation owner assigned"],
  ["DATA_COLLECTION", "Data collection"], ["MIGRATION", "Legacy data migration"], ["CONFIGURATION", "Configuration"],
  ["TRAINING", "Staff training"], ["UAT", "User acceptance testing"], ["GO_LIVE", "Go-live"],
  ["PAYMENT_CLEARED", "Outstanding payment cleared"], ["SUPPORT_HANDOVER", "Support handover"],
];

export async function ensureOnboarding(dealId: string) {
  const [d] = await db.select().from(t.deals).where(eq(t.deals.id, dealId));
  const [ex] = await db.select({ id: t.onboardings.id }).from(t.onboardings).where(eq(t.onboardings.dealId, dealId));
  if (ex) return ex.id;
  const steps: OnboardingStep[] = ONBOARDING_STEPS.map(([key, name]) => ({ key, name, status: "PENDING", dueDate: null, notes: "", completedAt: null }));
  const value = d.mrr * 12 + d.implementationFee;
  const [o] = await db.insert(t.onboardings).values({ dealId, institutionId: d.institutionId, ownerId: d.ownerId, steps, contractValue: value, outstandingAmount: d.implementationFee }).returning();
  return o.id;
}

export const stageMap = async () => new Map((await db.select().from(t.pipelineStages)).map((s) => [s.id, s]));
export const effectiveProbability = sql`coalesce(${t.deals.probabilityOverride}, ${t.pipelineStages.probability})`;
