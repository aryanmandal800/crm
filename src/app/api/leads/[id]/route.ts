import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { EXEC_EDITABLE, dedupeKey, institutionInput } from "@/lib/leads";
import { rescore } from "@/lib/scoring";
import { notify } from "@/lib/notify";

export const PATCH = api<{ id: string }>(["lead.edit", "lead.assign"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const before = await getInstitutionOr404(ctx, id);
  const patch = (await ctx.json(institutionInput.partial())) as Record<string, any>;
  if ("ownerId" in patch && patch.ownerId !== before.ownerId) {
    if (patch.ownerId && !canAssignTo(ctx, patch.ownerId)) throw forbidden("You cannot assign leads to that user");
    if (!ctx.can("lead.assign")) throw forbidden("Reassignment needs lead.assign");
  }
  const fields = Object.keys(patch).filter((k) => k !== "ownerId");
  if (fields.length && !ctx.can("lead.edit")) throw forbidden();
  // Sales executives (no research rights) may only update contact-type fields
  if (!ctx.can("research.edit")) {
    const blocked = fields.filter((k) => !EXEC_EDITABLE.includes(k));
    if (blocked.length) throw forbidden(`Your role can only update contact details. Not allowed: ${blocked.join(", ")}`);
  }
  if (patch.legalName) patch.dedupeKey = dedupeKey(patch.legalName);
  const [after] = await db.update(t.institutions).set(patch).where(eq(t.institutions.id, id)).returning();
  await rescore([id]);
  const changed = Object.fromEntries(Object.keys(patch).map((k) => [k, { from: (before as any)[k], to: (after as any)[k] }]));
  await audit(ctx, "update", "institution", id, null, changed);
  if (patch.ownerId && patch.ownerId !== ctx.user.id) await notify([patch.ownerId], { type: "ASSIGNED", title: `Lead assigned: ${after.legalName}`, link: `/leads/${id}` });
  return { id };
});

export const DELETE = api<{ id: string }>(["lead.delete"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const before = await getInstitutionOr404(ctx, id);
  await db.update(t.institutions).set({ deletedAt: new Date() }).where(eq(t.institutions.id, id));
  await audit(ctx, "archive", "institution", id, { legalName: before.legalName }, null);
  return { id };
});
