import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
const d = z.preprocess((v) => (v === "" || v == null ? null : new Date(v as string)), z.date().nullable()).optional();
export const PATCH = api<{ id: string }>(["onboarding.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const [o] = await db.select().from(t.onboardings).where(eq(t.onboardings.id, id)); if (!o) throw notFound();
  await getInstitutionOr404(ctx, o.institutionId);
  const b = await ctx.json(z.object({
    step: z.object({ key: z.string(), status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"]), notes: z.string().max(2000).optional(), dueDate: z.string().nullable().optional() }).optional(),
    ownerId: z.string().uuid().nullable().optional(), advanceReceived: z.number().min(0).optional(), outstandingAmount: z.number().min(0).optional(),
    goLiveDate: d, status: z.enum(["IN_PROGRESS", "LIVE", "ON_HOLD"]).optional(), notes: z.string().max(4000).nullable().optional(),
  }));
  const { step, ...rest } = b; const patch: Record<string, any> = { ...rest };
  if (step) {
    patch.steps = o.steps.map((s) => s.key === step.key ? { ...s, status: step.status, notes: step.notes ?? s.notes, dueDate: step.dueDate ?? s.dueDate, completedAt: step.status === "DONE" ? new Date().toISOString() : null } : s);
    if (step.key === "GO_LIVE" && step.status === "DONE") { patch.status = "LIVE"; patch.goLiveDate = patch.goLiveDate ?? new Date(); }
  }
  await db.update(t.onboardings).set(patch).where(eq(t.onboardings.id, id));
  await audit(ctx, "update", "onboarding", id, null, b); return { id };
});
