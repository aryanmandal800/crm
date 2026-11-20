import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { activityScope, assertWritable, getDealOr404, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad } from "@/lib/errors";
import { rescore } from "@/lib/scoring";
import { addDays, startOfDay } from "@/lib/format";

export const GET = api(["activity.create", "reports.view.all", "reports.view.team"], async (ctx, req) => {
  const sp = req.nextUrl.searchParams;
  const user = sp.get("user");
  const type = sp.get("type");
  const status = sp.get("status");
  const from = sp.get("from");
  const to = sp.get("to");
  const range = sp.get("range");
  const institutionId = sp.get("institutionId");

  const conds: (SQL | undefined)[] = [activityScope(ctx)];
  if (user) conds.push(eq(t.activities.userId, user));
  if (type) conds.push(eq(t.activities.typeKey, type));
  if (status) conds.push(eq(t.activities.status, status as any));
  if (institutionId) conds.push(eq(t.activities.institutionId, institutionId));
  if (from) conds.push(gte(t.activities.occurredAt, new Date(from)));
  if (to) conds.push(lte(t.activities.occurredAt, addDays(new Date(to), 1)));
  if (range === "today") conds.push(gte(t.activities.occurredAt, startOfDay()));

  const rows = await db
    .select({
      id: t.activities.id,
      typeKey: t.activities.typeKey,
      status: t.activities.status,
      occurredAt: t.activities.occurredAt,
      outcome: t.activities.outcome,
      notes: t.activities.notes,
      objection: t.activities.objection,
      feedback: t.activities.feedback,
      nextAction: t.activities.nextAction,
      followUpDate: t.activities.followUpDate,
      decisionMakerReached: t.activities.decisionMakerReached,
      meaningful: t.activities.meaningful,
      institutionId: t.activities.institutionId,
      institutionName: t.institutions.legalName,
      leadCode: t.institutions.leadCode,
      contactId: t.activities.contactId,
      contactName: t.contacts.name,
      userId: t.activities.userId,
      userName: t.users.name,
    })
    .from(t.activities)
    .innerJoin(t.users, eq(t.users.id, t.activities.userId))
    .innerJoin(t.institutions, eq(t.institutions.id, t.activities.institutionId))
    .leftJoin(t.contacts, eq(t.contacts.id, t.activities.contactId))
    .where(and(...conds))
    .orderBy(desc(t.activities.occurredAt))
    .limit(300);

  return { activities: rows };
});

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
