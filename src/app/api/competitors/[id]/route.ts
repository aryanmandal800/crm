import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { competitorInput } from "@/lib/schemas";
export const PATCH = api<{ id: string }>(["competitor.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const b = await ctx.json(competitorInput.partial());
  await db.update(t.competitors).set(b as any).where(eq(t.competitors.id, id)); await audit(ctx, "update", "competitor", id, null, b); return { id };
});
