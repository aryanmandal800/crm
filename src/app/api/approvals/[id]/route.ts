import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden, notFound } from "@/lib/errors";
import { notify } from "@/lib/notify";

export const POST = api<{ id: string }>(["pricing.approve", "cr.approve"], async (ctx, _r, { id }) => {
  const [a] = await db.select().from(t.approvalRequests).where(eq(t.approvalRequests.id, id)); if (!a) throw notFound();
  if (a.status !== "PENDING") throw bad("Already decided");
  const need = a.type === "CHANGE_REQUEST" ? "cr.approve" : "pricing.approve";
  if (!ctx.can(need as any)) throw forbidden();
  if (a.requestedById === ctx.user.id && !ctx.user.isFounder) throw forbidden("You cannot approve your own request");
  const b = await ctx.json(z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(2000).nullable().optional() }));
  await db.update(t.approvalRequests).set({ status: b.decision, decidedById: ctx.user.id, decidedAt: new Date(), decisionNote: b.note ?? null }).where(eq(t.approvalRequests.id, id));
  if (a.entityType === "quote") {
    await db.update(t.quotes).set({ status: b.decision === "APPROVED" ? "APPROVED" : "REJECTED", approvedById: b.decision === "APPROVED" ? ctx.user.id : null, approvedAt: b.decision === "APPROVED" ? new Date() : null }).where(eq(t.quotes.id, a.entityId));
  }
  if (a.entityType === "change_request") {
    const [cr] = await db.select().from(t.changeRequests).where(eq(t.changeRequests.id, a.entityId));
    if (cr) await db.update(t.changeRequests).set({ approvalStatus: b.decision, status: b.decision === "APPROVED" ? "IN_PROGRESS" : "REJECTED",
      history: [...cr.history, { at: new Date().toISOString(), by: ctx.user.name, action: `Approval ${b.decision.toLowerCase()}`, note: b.note ?? undefined }] }).where(eq(t.changeRequests.id, cr.id));
  }
  await audit(ctx, `approval_${b.decision.toLowerCase()}`, a.entityType, a.entityId, null, { approvalId: id, note: b.note });
  await notify([a.requestedById], { type: "APPROVAL_DECISION", title: `${b.decision === "APPROVED" ? "Approved" : "Rejected"}: ${a.summary.slice(0, 80)}`, body: b.note ?? "", link: a.entityType === "quote" ? `/quotes/${a.entityId}` : `/change-requests/${a.entityId}` });
  return { id };
});
