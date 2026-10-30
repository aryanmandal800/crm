import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { moduleSchema } from "@/lib/schemas";
export const PATCH = api<{ id: string }>(["pricing.config"], async (ctx, _r, { id }) => {
  const b = await ctx.json(moduleSchema.partial());
  const [before] = await db.select().from(t.productModules).where(eq(t.productModules.id, id));
  await db.update(t.productModules).set(b as any).where(eq(t.productModules.id, id)); await audit(ctx, "update", "product_module", id, before, b); return { id };
});
