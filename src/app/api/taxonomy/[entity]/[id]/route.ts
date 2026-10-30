import { eq } from "drizzle-orm";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden, notFound } from "@/lib/errors";
import { TAXONOMY, type TaxonomyKey } from "@/lib/taxonomy";
import { db } from "@/db";
import { rescore } from "@/lib/scoring";
export const PATCH = api<{ entity: string; id: string }>(null, async (ctx, _r, { entity, id }) => {
  const def = TAXONOMY[entity as TaxonomyKey]; if (!def) throw bad("Unknown list");
  if (!def.perms.some((p) => ctx.can(p))) throw forbidden();
  const tbl = def.table as any;
  const [before] = await db.select().from(tbl).where(eq(tbl.id, id)); if (!before) throw notFound();
  const b = (await ctx.json((def.schema as any).partial())) as Record<string, any>;
  if ("key" in b && b.key !== (before as any).key) throw bad("Keys cannot be renamed (records refer to them). Rename the label instead.");
  await db.update(tbl).set(b).where(eq(tbl.id, id));
  await audit(ctx, "update", "taxonomy", `${entity}:${id}`, before, b);
  if (entity === "scoring" || entity === "districts") await rescore();
  return { id, message: "Saved" };
});
