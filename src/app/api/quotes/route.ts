import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getDealOr404, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { allocateQuoteNumber } from "@/lib/quotes";
import { priceFor } from "@/lib/pricing";
import { allSettings } from "@/lib/settings";
import { notify, superAdminIds } from "@/lib/notify";
import { addDays, inr } from "@/lib/format";
import type { Milestone } from "@/db/schema";

const quoteInput = z.object({
  institutionId: z.string().uuid(), dealId: z.string().uuid().nullable().optional(),
  model: z.enum(["MONTHLY_SLAB", "MODULE_WISE", "AUTO", "MEMBER", "BRANCH", "ENTERPRISE"]).default("MONTHLY_SLAB"),
  setupLevel: z.enum(["AUTO", "LEVEL_1", "LEVEL_2", "LEVEL_3"]).default("AUTO"),
  members: z.number().int().min(0), branches: z.number().int().min(1), modules: z.array(z.string()).default([]),
  migration: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).default("NONE"), integrations: z.number().int().min(0).max(50).default(0),
  trainingDays: z.number().int().min(0).max(100).default(0), hosting: z.enum(["SHARED", "DEDICATED"]).default("SHARED"),
  sla: z.enum(["STANDARD", "PRIORITY", "PREMIUM"]).default("STANDARD"), txnVolume: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  discountPct: z.number().min(0).max(100).default(0),
  setupDiscountPct: z.number().min(0).max(100).default(0),
  scope: z.string().max(8000).nullable().optional(), terms: z.string().max(8000).nullable().optional(),
  validityDays: z.number().int().min(1).max(365).optional(), milestones: z.array(z.object({ name: z.string(), pct: z.number(), trigger: z.string() })).optional(),
  justification: z.string().max(2000).nullable().optional(),
});

export const POST = api(["quote.create"], async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(quoteInput);
  const inst = await getInstitutionOr404(ctx, b.institutionId);
  if (b.dealId) { const d = await getDealOr404(ctx, b.dealId); if (d.institutionId !== inst.id) throw new Error("Deal mismatch"); }
  const s = await allSettings();
  const p = await priceFor(b); // server-side calculation — client numbers are never trusted
  const ms: Milestone[] = b.milestones ?? (s.get("pricing.milestones") as Milestone[]);
  if (Math.round(ms.reduce((a, m) => a + m.pct, 0)) !== 100) throw new Error("Payment milestones must total 100%");
  const { serial, number } = await allocateQuoteNumber(inst.shortName ?? inst.legalName);
  const needs = p.needsApproval;
  const [q] = await db.insert(t.quotes).values({
    number, serial, institutionId: inst.id, dealId: b.dealId ?? null, createdById: ctx.user.id, status: needs ? "PENDING_APPROVAL" : "DRAFT",
    model: p.model, members: p.members, branches: p.branches, modules: b.modules, lines: p.lines, scope: b.scope ?? null,
    ratePerMember: p.ratePerMember, monthlyFee: p.monthly, implementationFee: p.implementation, migrationFee: p.migration,
    discountPct: p.discountPct, setupDiscountPct: p.setupDiscountPct,
    gstRate: Number(s.get("pricing.gstRate")), terms: b.terms ?? String(s.get("pricing.terms")), milestones: ms,
    validUntil: addDays(new Date(), b.validityDays ?? Number(s.get("pricing.quoteValidityDays"))),
  }).returning();
  if (needs) {
    await db.insert(t.approvalRequests).values({
      type: "DISCOUNT", entityType: "quote", entityId: q.id, requestedById: ctx.user.id,
      summary: `${number} — ${inst.legalName}: ${p.approvalReasons.join("; ")}`,
      payload: {
        monthlyList: p.monthly,
        monthlyAfterDiscount: p.monthlyAfterDiscount,
        minAcceptable: p.negotiation.minAcceptableMonthly,
        discountPct: p.discountPct,
        setupDiscountPct: p.setupDiscountPct,
        setupMigrationFee: p.setupMigrationFee,
        setupMigrationAfterDiscount: p.setupMigrationAfterDiscount,
        effectiveRate: p.effectiveRate,
        justification: b.justification ?? null,
      },
    });
    await notify(await superAdminIds(), {
      type: "APPROVAL",
      title: `Pricing approval needed: ${number}`,
      body: `${inst.legalName} — ${inr(p.monthlyAfterDiscount)}/mo (SaaS) + ${inr(p.setupMigrationAfterDiscount)} (Setup). ${p.approvalReasons.join("; ")}`,
      link: "/approvals",
    });
  }
  if (b.dealId) await db.update(t.deals).set({ modules: b.modules }).where(eq(t.deals.id, b.dealId));
  await audit(ctx, "create", "quote", q.id, null, {
    number,
    monthly: p.monthlyAfterDiscount,
    discountPct: p.discountPct,
    setupMigration: p.setupMigrationAfterDiscount,
    setupDiscountPct: p.setupDiscountPct,
    needsApproval: needs,
  });
  return { id: q.id, number, needsApproval: needs };
});
