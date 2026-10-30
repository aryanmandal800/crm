import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getDealOr404, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad } from "@/lib/errors";
import { rescore } from "@/lib/scoring";

const d = z.preprocess((v) => (v === "" || v == null ? null : new Date(v as string)), z.date().nullable()).optional();
const s = z.preprocess((v) => (typeof v === "string" ? (v.trim() || null) : v), z.string().max(4000).nullable()).optional();
const activityInput = z.object({
  institutionId: z.string().uuid(), dealId: z.string().uuid().nullable().optional(), contactId: z.string().uuid().nullable().optional(),
  typeKey: z.string().min(2).max(40), status: z.enum(["PLANNED", "DONE", "CANCELLED"]).default("DONE"), outcome: s,
  occurredAt: d, notes: s, objection: s, feedback: s, nextAction: s, followUpDate: d,
  decisionMakerReached: z.boolean().optional(), meaningful: z.boolean().optional(),
});

export const POST = api(["activity.create"], async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(activityInput);
  await getInstitutionOr404(ctx, b.institutionId);
  const [ty] = await db.select().from(t.activityTypes).where(eq(t.activityTypes.key, b.typeKey));
  if (!ty) throw bad("Unknown activity type");
  if (b.contactId) {
    const [c] = await db.select().from(t.contacts).where(and(eq(t.contacts.id, b.contactId), eq(t.contacts.institutionId, b.institutionId)));
    if (!c) throw bad("Contact does not belong to this institution");
    if (b.status === "DONE" && ["MEETING", "DEMO", "VISIT"].includes(b.typeKey)) await db.update(t.contacts).set({ lastMetAt: b.occurredAt ?? new Date() }).where(eq(t.contacts.id, c.id));
  }
  if (b.dealId) {
    const deal = await getDealOr404(ctx, b.dealId);
    if (deal.institutionId !== b.institutionId) throw bad("Deal does not belong to this institution");
    if (b.nextAction || b.followUpDate) await db.update(t.deals).set({ nextAction: b.nextAction ?? deal.nextAction, followUpDate: b.followUpDate ?? deal.followUpDate }).where(eq(t.deals.id, deal.id));
  }
  const [a] = await db.insert(t.activities).values({ ...b, occurredAt: b.occurredAt ?? new Date(), userId: ctx.user.id } as any).returning();
  if (b.decisionMakerReached) await rescore([b.institutionId]);
  await audit(ctx, "create", "activity", a.id, null, { type: b.typeKey, institutionId: b.institutionId });
  return { id: a.id, message: "Activity logged" };
});
