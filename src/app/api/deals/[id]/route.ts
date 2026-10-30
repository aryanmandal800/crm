import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo, getDealOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad, forbidden } from "@/lib/errors";
import { ensureOnboarding } from "@/lib/deals";
import { notify, superAdminIds } from "@/lib/notify";

const d = z.preprocess((v) => (v === "" || v == null ? null : new Date(v as string)), z.date().nullable()).optional();
const s = z.preprocess((v) => (typeof v === "string" ? (v.trim() || null) : v), z.string().max(2000).nullable()).optional();
const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(), stageId: z.string().uuid().optional(), ownerId: z.string().uuid().optional(),
  opportunityCategory: z.string().max(40).optional(), modules: z.array(z.string()).optional(),
  members: z.number().int().min(0).nullable().optional(), branches: z.number().int().min(0).nullable().optional(),
  mrr: z.number().min(0).optional(), implementationFee: z.number().min(0).optional(), probabilityOverride: z.number().int().min(0).max(100).nullable().optional(),
  expectedCloseDate: d, nextAction: s, followUpDate: d, founderFlag: z.boolean().optional(), founderFlagReason: s,
  lostReasonId: z.string().uuid().nullable().optional(), lostNotes: s, competitorId: z.string().uuid().nullable().optional(), note: s,
});
const FINANCIAL = ["mrr", "implementationFee", "stageId"];

export const PATCH = api<{ id: string }>(["deal.edit", "lead.assign"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const deal = await getDealOr404(ctx, id);
  const { note, ...b } = await ctx.json(patchSchema);
  const keys = Object.keys(b).filter((k) => (b as any)[k] !== undefined && (b as any)[k] !== (deal as any)[k]);
  if (keys.some((k) => k !== "ownerId") && !ctx.can("deal.edit")) throw forbidden();
  if (b.ownerId && b.ownerId !== deal.ownerId && !canAssignTo(ctx, b.ownerId)) throw forbidden("You cannot reassign this deal to that user");
  const touchesLocked = deal.financialsLocked && keys.some((k) => FINANCIAL.includes(k) && (b as any)[k] !== (deal as any)[k]);
  if (touchesLocked && !ctx.can("deal.edit_locked")) throw forbidden("This deal is closed. Only the Super Admin can change its financials or stage.");

  const stages = new Map((await db.select().from(t.pipelineStages)).map((x) => [x.id, x]));
  const from = stages.get(deal.stageId)!; const to = b.stageId ? stages.get(b.stageId) : from;
  if (!to) throw bad("Unknown stage");
  const merged = { ...deal, ...b };
  const patch: Record<string, any> = { ...b };
  if (to.id !== from.id) {
    patch.stageChangedAt = new Date();
    if (to.isLost) { if (!merged.lostReasonId) throw bad("Select a lost reason"); patch.lostAt = new Date(); patch.nextAction = null; patch.followUpDate = null; }
    if (to.isWon) { patch.wonAt = new Date(); patch.financialsLocked = true; patch.nextAction = null; patch.followUpDate = null; }
    if (!to.isWon && from.isWon) { patch.wonAt = null; patch.financialsLocked = false; }
  }
  if (to.isOpen && (!merged.nextAction || !merged.followUpDate)) throw bad("Open deals need a next action and a follow-up date");

  await db.transaction(async (tx) => {
    if (touchesLocked) await tx.execute(sql`select set_config('app.allow_locked_edit', 'on', true)`);
    await tx.update(t.deals).set(patch).where(eq(t.deals.id, id));
    if (to.id !== from.id) await tx.insert(t.dealStageHistory).values({ dealId: id, fromStage: from.key, toStage: to.key, changedById: ctx.user.id, note: note ?? null });
  });
  await audit(ctx, touchesLocked ? "update_locked_financials" : "update", "deal", id,
    Object.fromEntries(keys.map((k) => [k, (deal as any)[k]])), Object.fromEntries(keys.map((k) => [k, (b as any)[k]])));

  if (to.isWon && !from.isWon) {
    await ensureOnboarding(id);
    await notify(await superAdminIds(), { type: "DEAL_WON", title: `Deal won: ${deal.title}`, body: `MRR ₹${merged.mrr}`, link: `/deals/${id}` });
  }
  if (b.founderFlag && !deal.founderFlag) await notify(await superAdminIds(), { type: "FOUNDER_FLAG", title: `Founder help requested: ${deal.title}`, body: b.founderFlagReason ?? "", link: `/deals/${id}` });
  if (b.ownerId && b.ownerId !== deal.ownerId) await notify([b.ownerId], { type: "ASSIGNED", title: `Deal assigned to you: ${deal.title}`, link: `/deals/${id}` });
  return { id };
});
