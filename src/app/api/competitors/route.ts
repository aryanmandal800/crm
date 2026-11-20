import { asc, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable } from "@/lib/access";
import { audit } from "@/lib/audit";
import { competitorInput } from "@/lib/schemas";

export const GET = api(["competitor.view"], async () => {
  const rows = await db
    .select({
      id: t.competitors.id,
      name: t.competitors.name,
      product: t.competitors.product,
      targetSegment: t.competitors.targetSegment,
      strengths: t.competitors.strengths,
      weaknesses: t.competitors.weaknesses,
      verification: t.competitors.verification,
      sourcesCount: sql<number>`(select count(*) from sources s where s.competitor_id = ${t.competitors.id})::int`,
      institutionsCount: sql<number>`(select count(*) from institutions i where i.deleted_at is null and lower(i.cbs_vendor) = lower(${t.competitors.name}))::int`,
      dealsCount: sql<number>`(select count(*) from deals d where d.competitor_id = ${t.competitors.id})::int`,
    })
    .from(t.competitors)
    .orderBy(asc(t.competitors.name));

  return { competitors: rows };
});

export const POST = api(["competitor.edit"], async (ctx) => {
  assertWritable(ctx); const b = await ctx.json(competitorInput);
  const [c] = await db.insert(t.competitors).values(b as any).returning(); await audit(ctx, "create", "competitor", c.id, null, { name: c.name }); return { id: c.id };
});
