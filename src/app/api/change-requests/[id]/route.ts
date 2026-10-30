import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden, notFound } from "@/lib/errors";
import { notify, superAdminIds } from "@/lib/notify";

/** Workflow: Requested → Reviewed → (Approval required) → In progress → Tested → Completed. */
const FLOW: Record<string, string[]> = { review: ["REQUESTED"], start: ["REVIEWED"], test: ["IN_PROGRESS"], complete: ["TESTED"], reject: ["REQUESTED", "REVIEWED", "APPROVAL_REQUIRED", "IN_PROGRESS"], comment: [] };

export const POST = api<{ id: string }>(["cr.manage", "cr.approve", "cr.create"], async (ctx, _r, { id }) => {
  const [cr] = await db.select().from(t.changeRequests).where(eq(t.changeRequests.id, id)); if (!cr) throw notFound();
  const b = await ctx.json(z.object({ action: z.enum(["review", "start", "test", "complete", "reject", "comment"]), note: z.string().max(4000).nullable().optional(),
    proposedSolution: z.string().max(8000).nullable().optional(), assignedToId: z.string().uuid().nullable().optional(), testingStatus: z.enum(["PASSED", "FAILED"]).optional(),
    approvalRequired: z.boolean().optional() }));
  if (b.action !== "comment" && !FLOW[b.action].includes(cr.status)) throw bad(`Cannot ${b.action} a request in status ${cr.status}`);
  if (["review", "start", "test", "complete"].includes(b.action) && !ctx.can("cr.manage") && !ctx.can("cr.approve")) throw forbidden("Only the technical owner can progress change requests");
  if (b.action === "reject" && !ctx.can("cr.approve") && !ctx.can("cr.manage")) throw forbidden();
  if (b.action === "comment" && !ctx.can("cr.manage") && cr.requestedById !== ctx.user.id && !ctx.can("cr.approve")) throw forbidden();
  const patch: Record<string, any> = {};
  let status = cr.status;
  if (b.action === "review") {
    patch.proposedSolution = b.proposedSolution ?? cr.proposedSolution; patch.assignedToId = b.assignedToId ?? cr.assignedToId ?? ctx.user.id;
    // Tech owner may add an approval requirement but never remove one that the system set.
    const required = cr.approvalRequired || !!b.approvalRequired; patch.approvalRequired = required;
    if (required) {
      status = "APPROVAL_REQUIRED"; patch.approvalStatus = "PENDING";
      await db.insert(t.approvalRequests).values({ type: "CHANGE_REQUEST", entityType: "change_request", entityId: id, requestedById: ctx.user.id, summary: `${cr.code}: ${cr.title} (${cr.category})`, payload: { proposedSolution: patch.proposedSolution } });
      await notify(await superAdminIds(), { type: "APPROVAL", title: `Change approval needed: ${cr.code}`, body: cr.title, link: "/approvals" });
    } else status = "REVIEWED";
  }
  if (b.action === "start") status = "IN_PROGRESS";
  if (b.action === "test") { if (!b.testingStatus) throw bad("Record the test result"); patch.testingStatus = b.testingStatus; status = b.testingStatus === "PASSED" ? "TESTED" : "IN_PROGRESS"; }
  if (b.action === "complete") { status = "COMPLETED"; patch.completedAt = new Date(); }
  if (b.action === "reject") status = "REJECTED";
  if (b.note) patch.changeNotes = [cr.changeNotes, `[${new Date().toISOString().slice(0, 16)} ${ctx.user.name}] ${b.note}`].filter(Boolean).join("\n");
  patch.status = status;
  patch.history = [...cr.history, { at: new Date().toISOString(), by: ctx.user.name, action: b.action === "comment" ? "Comment" : `→ ${status}`, note: b.note ?? undefined }];
  await db.update(t.changeRequests).set(patch).where(eq(t.changeRequests.id, id));
  await audit(ctx, `cr_${b.action}`, "change_request", id, { status: cr.status }, { status, note: b.note });
  if (cr.requestedById !== ctx.user.id) await notify([cr.requestedById], { type: "CHANGE_REQUEST", title: `${cr.code} → ${status.replace(/_/g, " ").toLowerCase()}`, body: b.note ?? "", link: `/change-requests/${id}` });
  return { id };
});
