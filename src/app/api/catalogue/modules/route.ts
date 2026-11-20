import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { moduleSchema } from "@/lib/schemas";
import { allSettings } from "@/lib/settings";

export const GET = api(["pricing.view", "pricing.config", "quote.create"], async () => {
  const [modules, slabs, s] = await Promise.all([
    db.select().from(t.productModules).orderBy(asc(t.productModules.sortOrder)),
    db.select().from(t.pricingSlabs).orderBy(asc(t.pricingSlabs.minMembers)),
    allSettings(),
  ]);
  return {
    modules,
    slabs,
    settings: {
      listRate: Number(s.get("pricing.listRate")),
      floorRate: Number(s.get("pricing.floorRate")),
      minMonthly: Number(s.get("pricing.minMonthly")),
      gstRate: Number(s.get("pricing.gstRate")),
    },
  };
});

export const POST = api(["pricing.config"], async (ctx) => {
  const b = await ctx.json(moduleSchema);
  const [m] = await db.insert(t.productModules).values(b as any).returning(); await audit(ctx, "create", "product_module", m.id, null, b); return { id: m.id };
});
