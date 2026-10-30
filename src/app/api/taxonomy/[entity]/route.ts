import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden } from "@/lib/errors";
import { TAXONOMY, type TaxonomyKey } from "@/lib/taxonomy";
import { db } from "@/db";
import { rescore } from "@/lib/scoring";
export const POST = api<{ entity: string }>(null, async (ctx, _r, { entity }) => {
  const def = TAXONOMY[entity as TaxonomyKey]; if (!def) throw bad("Unknown list");
  if (!def.perms.some((p) => ctx.can(p))) throw forbidden();
  const b = await ctx.json(def.schema as any);
  if (entity === "scoring" && (b as any).kind === "BUILTIN") throw bad("New parameters must be MANUAL (analyst-entered). Built-in rules require a development change request.");
  const row = ((await db.insert(def.table as any).values(b as any).returning()) as any[])[0];
  await audit(ctx, "create", "taxonomy", `${entity}:${(row as any).id}`, null, b);
  if (entity === "scoring") await rescore();
  return { id: (row as any).id, message: "Added" };
});
