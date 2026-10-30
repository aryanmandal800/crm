import { z } from "zod";
import { api } from "@/lib/api";
import { priceFor } from "@/lib/pricing";
export const POST = api(["pricing.view", "pricing.config", "quote.create"], async (ctx) => {
  const b = await ctx.json(z.object({
    members: z.number().int().min(0).nullable(), branches: z.number().int().min(0).nullable(), modules: z.array(z.string()).optional(),
    model: z.enum(["AUTO", "MEMBER", "BRANCH", "ENTERPRISE"]).optional(), migration: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
    integrations: z.number().int().min(0).max(50).optional(), trainingDays: z.number().int().min(0).max(100).optional(),
    hosting: z.enum(["SHARED", "DEDICATED"]).optional(), sla: z.enum(["STANDARD", "PRIORITY", "PREMIUM"]).optional(),
    txnVolume: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(), discountPct: z.number().min(0).max(100).optional(),
  }));
  return priceFor(b);
});
