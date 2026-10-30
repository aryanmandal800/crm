import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { moduleSchema } from "@/lib/schemas";
export const POST = api(["pricing.config"], async (ctx) => {
  const b = await ctx.json(moduleSchema);
  const [m] = await db.insert(t.productModules).values(b as any).returning(); await audit(ctx, "create", "product_module", m.id, null, b); return { id: m.id };
});
