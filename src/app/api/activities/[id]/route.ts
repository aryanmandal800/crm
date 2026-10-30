import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden, notFound } from "@/lib/errors";

/** Activity history is immutable except: the author (or Super Admin) may mark a PLANNED item done/cancelled and add an outcome. */
export const PATCH = api<{ id: string }>(["activity.create"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const [a] = await db.select().from(t.activities).where(eq(t.activities.id, id)); if (!a) throw notFound();
  if (a.userId !== ctx.user.id && !ctx.can("dashboard.founder")) throw forbidden("Only the author can update this activity");
  if (a.status !== "PLANNED") throw forbidden("Completed activities are part of the history and cannot be changed");
  const b = await ctx.json(z.object({ status: z.enum(["DONE", "CANCELLED"]), outcome: z.string().max(60).nullable().optional(), notes: z.string().max(4000).nullable().optional(), decisionMakerReached: z.boolean().optional() }));
  await db.update(t.activities).set({ ...b, notes: b.notes ? `${a.notes ?? ""}\n${b.notes}`.trim() : a.notes, occurredAt: b.status === "DONE" ? new Date() : a.occurredAt }).where(eq(t.activities.id, id));
  await audit(ctx, "update", "activity", id, { status: a.status }, b); return { id };
});
