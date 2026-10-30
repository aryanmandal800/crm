import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { rescore } from "@/lib/scoring";
export const POST = api<{ id: string }>(["research.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const inst = await getInstitutionOr404(ctx, id);
  const b = await ctx.json(z.record(z.string(), z.number().min(0).max(100).nullable()));
  const params = await db.select().from(t.scoringParameters).where(eq(t.scoringParameters.kind, "MANUAL"));
  const ms: Record<string, number> = { ...inst.manualScores };
  for (const p of params) { const v = b[p.key]; if (v == null) delete ms[p.key]; else ms[p.key] = Math.min(p.maxScore, v); }
  await db.update(t.institutions).set({ manualScores: ms }).where(eq(t.institutions.id, id));
  await rescore([id]); await audit(ctx, "manual_scores", "institution", id, inst.manualScores, ms); return { id };
});
