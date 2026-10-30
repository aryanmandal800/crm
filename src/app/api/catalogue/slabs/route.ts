import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad } from "@/lib/errors";
import { setting } from "@/lib/settings";
/** Replace all member slabs. Must be contiguous from 0 with one open-ended top slab. */
export const PUT = api(["pricing.config"], async (ctx) => {
  const { slabs } = await ctx.json(z.object({ slabs: z.array(z.object({ minMembers: z.number().int().min(0), maxMembers: z.number().int().nullable(), ratePerMember: z.number().min(0), label: z.string().nullable().optional() })).min(1).max(20) }));
  const sorted = [...slabs].sort((a, b) => a.minMembers - b.minMembers);
  if (sorted[0].minMembers !== 0) throw bad("First slab must start at 0 members");
  for (let i = 0; i < sorted.length - 1; i++) if (sorted[i].maxMembers == null || sorted[i].maxMembers! + 1 !== sorted[i + 1].minMembers) throw bad("Slabs must be contiguous (next min = previous max + 1)");
  if (sorted.at(-1)!.maxMembers != null) throw bad("Last slab must be open-ended (no max)");
  const floor = await setting<number>("pricing.floorRate");
  if (sorted.some((s) => s.ratePerMember < floor)) throw bad(`A slab rate is below the floor rate ₹${floor}`);
  const before = await db.select().from(t.pricingSlabs);
  await db.transaction(async (tx) => { await tx.delete(t.pricingSlabs); await tx.insert(t.pricingSlabs).values(sorted); });
  await audit(ctx, "replace", "pricing_slabs", null, before, sorted); return { ok: true, message: "Slabs saved" };
});
