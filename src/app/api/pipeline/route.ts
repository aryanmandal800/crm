import { and, asc, eq, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { dealScope } from "@/lib/access";
import { options } from "@/lib/options";

export const dynamic = "force-dynamic";

export const GET = api(["deal.view"], async (ctx, req) => {
  const sp = req.nextUrl.searchParams;
  const o = await options();
  const conds: (SQL | undefined)[] = [dealScope(ctx)];

  const owner = sp.get("owner");
  const category = sp.get("category");
  const taluka = sp.get("taluka");
  const stage = sp.get("stage");

  if (owner) conds.push(eq(t.deals.ownerId, owner));
  if (category) conds.push(eq(t.deals.opportunityCategory, category));
  if (taluka) conds.push(eq(t.institutions.talukaId, taluka));
  if (stage) conds.push(eq(t.deals.stageId, stage));

  const rows = await db
    .select({
      id: t.deals.id,
      title: t.deals.title,
      stageId: t.deals.stageId,
      mrr: t.deals.mrr,
      followUpDate: t.deals.followUpDate,
      nextAction: t.deals.nextAction,
      founderFlag: t.deals.founderFlag,
      stageChangedAt: t.deals.stageChangedAt,
      owner: t.users.name,
      ownerId: t.deals.ownerId,
      institution: t.institutions.legalName,
      institutionId: t.institutions.id,
      leadCode: t.institutions.leadCode,
      band: t.institutions.scoreBand,
      score: t.institutions.score,
      taluka: t.talukas.name,
      category: t.deals.opportunityCategory,
    })
    .from(t.deals)
    .innerJoin(t.institutions, eq(t.institutions.id, t.deals.institutionId))
    .innerJoin(t.users, eq(t.users.id, t.deals.ownerId))
    .leftJoin(t.talukas, eq(t.talukas.id, t.institutions.talukaId))
    .where(and(...conds))
    .orderBy(asc(t.deals.followUpDate));

  const stages = o.stages.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    isOpen: s.isOpen,
    isWon: s.isWon,
    isLost: s.isLost,
    stallDays: s.stallDays,
    probability: s.probability,
  }));

  const openDeals = rows.filter((r) => stages.find((s) => s.id === r.stageId)?.isOpen);
  const totalOpenMrr = openDeals.reduce((sum, r) => sum + (r.mrr || 0), 0);

  return {
    stages,
    deals: rows,
    totalCount: rows.length,
    openDealsCount: openDeals.length,
    totalOpenMrr,
  };
});
