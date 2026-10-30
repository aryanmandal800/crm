import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
export const PATCH = api<{ id: string }>(null, async (ctx, _r, { id }) => {
  const [x] = await db.select().from(t.tasks).where(eq(t.tasks.id, id)); if (!x) throw notFound();
  if (![x.assigneeId, x.createdById].includes(ctx.user.id) && !ctx.can("dashboard.founder")) throw forbidden();
  const b = await ctx.json(z.object({ status: z.enum(["OPEN", "DONE", "CANCELLED"]) }));
  await db.update(t.tasks).set({ status: b.status, completedAt: b.status === "DONE" ? new Date() : null }).where(eq(t.tasks.id, id)); return { id };
});
