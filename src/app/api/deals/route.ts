import { and, asc, desc, eq, ilike, or, SQL } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo, dealScope, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad, forbidden } from "@/lib/errors";

export const GET = api(["deal.view"], async (ctx, req) => {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const stage = sp.get("stage");
  const owner = sp.get("owner");
  const category = sp.get("category");
  const institutionId = sp.get("institutionId");

  const conds: (SQL | undefined)[] = [dealScope(ctx)];
  if (q) conds.push(or(ilike(t.deals.title, `%${q}%`), ilike(t.institutions.legalName, `%${q}%`)));
  if (stage) conds.push(eq(t.deals.stageId, stage));
  if (owner) conds.push(eq(t.deals.ownerId, owner));
  if (category) conds.push(eq(t.deals.opportunityCategory, category));
  if (institutionId) conds.push(eq(t.deals.institutionId, institutionId));

  const deals = await db
    .select({
      id: t.deals.id,
      title: t.deals.title,
      stageId: t.deals.stageId,
      stageName: t.pipelineStages.name,
      stageKey: t.pipelineStages.key,
      isOpen: t.pipelineStages.isOpen,
      isWon: t.pipelineStages.isWon,
      isLost: t.pipelineStages.isLost,
      ownerId: t.deals.ownerId,
      ownerName: t.users.name,
      institutionId: t.deals.institutionId,
      institutionName: t.institutions.legalName,
      leadCode: t.institutions.leadCode,
      mrr: t.deals.mrr,
      implementationFee: t.deals.implementationFee,
      opportunityCategory: t.deals.opportunityCategory,
      nextAction: t.deals.nextAction,
      followUpDate: t.deals.followUpDate,
      founderFlag: t.deals.founderFlag,
      founderFlagReason: t.deals.founderFlagReason,
      financialsLocked: t.deals.financialsLocked,
      createdAt: t.deals.createdAt,
      stageChangedAt: t.deals.stageChangedAt,
    })
    .from(t.deals)
    .innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId))
    .innerJoin(t.pipelineStages, eq(t.pipelineStages.id, t.deals.stageId))
    .innerJoin(t.users, eq(t.users.id, t.deals.ownerId))
    .where(and(...conds))
    .orderBy(desc(t.deals.createdAt));

  return { deals };
});

const d = z.preprocess((v) => (v === "" || v == null ? null : new Date(v as string)), z.date().nullable()).optional();
export const POST = api(["deal.create"], async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(z.object({
    institutionId: z.string().uuid(), title: z.string().trim().min(3).max(200), stageId: z.string().uuid(), opportunityCategory: z.string().max(40),
    ownerId: z.string().uuid().nullable().optional(), nextAction: z.string().trim().min(3).max(500), followUpDate: d, mrr: z.number().min(0).nullable().optional(),
    modules: z.array(z.string()).optional(),
  }));
  const inst = await getInstitutionOr404(ctx, b.institutionId);
  const [stage] = await db.select().from(t.pipelineStages).where(eq(t.pipelineStages.id, b.stageId));
  if (!stage || !stage.isOpen) throw bad("New deals must start in an open stage");
  if (!b.followUpDate) throw bad("Every open deal needs a follow-up date");
  const ownerId = b.ownerId ?? ctx.user.id;
  if (ownerId !== ctx.user.id && !canAssignTo(ctx, ownerId)) throw forbidden("You cannot assign deals to that user");
  const [deal] = await db.insert(t.deals).values({
    institutionId: inst.id, title: b.title, stageId: stage.id, ownerId, opportunityCategory: b.opportunityCategory, nextAction: b.nextAction,
    followUpDate: b.followUpDate, mrr: b.mrr ?? 0, members: inst.activeMembers ?? inst.totalMembers, branches: inst.branchCount, modules: b.modules ?? [],
  }).returning();
  await db.insert(t.dealStageHistory).values({ dealId: deal.id, toStage: stage.key, changedById: ctx.user.id, note: "Deal created" });
  if (!inst.ownerId) await db.update(t.institutions).set({ ownerId }).where(eq(t.institutions.id, inst.id));
  await audit(ctx, "create", "deal", deal.id, null, { title: deal.title, stage: stage.key });
  return { id: deal.id };
});
