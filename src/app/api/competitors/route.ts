import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { competitorInput } from "@/lib/schemas";
export const POST = api(["competitor.edit"], async (ctx) => {
  assertWritable(ctx); const b = await ctx.json(competitorInput);
  const [c] = await db.insert(t.competitors).values(b as any).returning(); await audit(ctx, "create", "competitor", c.id, null, { name: c.name }); return { id: c.id };
});
