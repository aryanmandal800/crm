import { and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, canAssignTo, instScope } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { notify } from "@/lib/notify";

export const POST = api(["lead.assign"], async (ctx) => {
  assertWritable(ctx);
  const b = await ctx.json(z.object({ ids: z.array(z.string().uuid()).min(1).max(5000), ownerId: z.string().uuid().nullable() }));
  if (b.ownerId && !canAssignTo(ctx, b.ownerId)) throw forbidden("You cannot assign leads to that user");
  const rows = await db.update(t.institutions).set({ ownerId: b.ownerId }).where(and(inArray(t.institutions.id, b.ids), instScope(ctx))).returning({ id: t.institutions.id });
  await audit(ctx, "bulk_assign", "institution", null, null, { count: rows.length, ownerId: b.ownerId });
  if (b.ownerId && b.ownerId !== ctx.user.id) await notify([b.ownerId], { type: "ASSIGNED", title: `${rows.length} lead(s) assigned to you`, link: "/leads?owner=me" });
  return { updated: rows.length, message: `${rows.length} lead(s) updated` };
});
