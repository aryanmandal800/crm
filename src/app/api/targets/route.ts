import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
export const POST = api(["settings.business"], async (ctx) => {
  const b = await ctx.json(z.object({ userId: z.string().uuid(), period: z.string().regex(/^\d{4}-\d{2}$/), CALLS: z.number().int().min(0).nullable().optional(), MEETINGS: z.number().int().min(0).nullable().optional(),
    DEMOS: z.number().int().min(0).nullable().optional(), PROPOSALS: z.number().int().min(0).nullable().optional(), WON_DEALS: z.number().int().min(0).nullable().optional(), MRR: z.number().int().min(0).nullable().optional() }));
  for (const m of ["CALLS", "MEETINGS", "DEMOS", "PROPOSALS", "WON_DEALS", "MRR"] as const) {
    const v = b[m]; if (v == null) continue;
    await db.insert(t.targets).values({ userId: b.userId, period: b.period, metric: m, value: v }).onConflictDoUpdate({ target: [t.targets.userId, t.targets.period, t.targets.metric], set: { value: v } });
  }
  await audit(ctx, "set_targets", "target", b.userId, null, b); return { ok: true, message: "Targets saved" };
});
