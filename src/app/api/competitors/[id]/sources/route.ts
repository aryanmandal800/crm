import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { sourceInput } from "@/lib/schemas";
export const POST = api<{ id: string }>(["competitor.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const b = await ctx.json(sourceInput);
  const [s] = await db.insert(t.sources).values({ ...b, competitorId: id, addedById: ctx.user.id } as any).returning();
  await audit(ctx, "create", "source", s.id, null, { competitorId: id, url: s.url }); return { id: s.id };
});
