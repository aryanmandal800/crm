import { api } from "@/lib/api";
import { activityKpis, leadKpis, ownerFilter, pipelineKpis, salesPerformance, stageFunnel, talukaCoverage, typePipeline, topOpportunities } from "@/lib/metrics";
import { addDays, startOfDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export const GET = api(["reports.view.all", "reports.view.team"], async (ctx, req) => {
  const sp = req.nextUrl.searchParams;
  const daysParam = Number(sp.get("days") ?? 30);
  const days = [7, 30, 90, 365].includes(daysParam) ? daysParam : 30;
  const owners = ownerFilter(ctx);
  const since = addDays(startOfDay(), -days + 1);

  const [lk, pk, ak, funnel, talukas, types, people, top] = await Promise.all([
    leadKpis(owners),
    pipelineKpis(owners),
    activityKpis(owners, since),
    stageFunnel(owners),
    talukaCoverage(owners),
    typePipeline(owners),
    salesPerformance(owners, since),
    topOpportunities(owners),
  ]);

  return {
    days,
    leadKpis: lk,
    pipelineKpis: pk,
    activityKpis: ak,
    funnel,
    talukas,
    types,
    salesPerformance: people,
    topOpportunities: top,
  };
});
