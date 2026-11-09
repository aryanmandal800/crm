import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { generateInsights } from "@/lib/insights";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

export const POST = api<{ id: string }>(["lead.edit", "research.edit", "pricing.view"], async (ctx, _r, { id }) => {
  assertWritable(ctx); await getInstitutionOr404(ctx, id);
  const r = await generateInsights(id, ctx.user.id);
  await audit(ctx, "generate_insights", "institution", id, null, { source: r.source });
  return { id, source: r.source };
});
