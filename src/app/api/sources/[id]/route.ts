import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { forbidden, notFound } from "@/lib/errors";
import { sourceInput } from "@/lib/schemas";
async function load(ctx: any, id: string) {
  const [s] = await db.select().from(t.sources).where(eq(t.sources.id, id)); if (!s) throw notFound();
  if (s.institutionId) await getInstitutionOr404(ctx, s.institutionId); else if (!ctx.can("competitor.edit")) throw forbidden();
  return s;
}
export const PATCH = api<{ id: string }>(["research.edit", "competitor.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); await load(ctx, id); const b = await ctx.json(sourceInput.partial());
  await db.update(t.sources).set(b as any).where(eq(t.sources.id, id)); await audit(ctx, "update", "source", id, null, b); return { id };
});
export const DELETE = api<{ id: string }>(["research.edit", "competitor.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const s = await load(ctx, id);
  await db.delete(t.sources).where(eq(t.sources.id, id)); await audit(ctx, "delete", "source", id, s, null); return { id };
});
