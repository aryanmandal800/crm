import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad, forbidden } from "@/lib/errors";

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
