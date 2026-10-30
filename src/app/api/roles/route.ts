import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad } from "@/lib/errors";
import { ALL_PERMISSIONS, SUPER_ADMIN_ONLY } from "@/lib/permissions";
export const POST = api(["roles.manage"], async (ctx) => {
  const b = await ctx.json(z.object({ key: z.string().regex(/^[A-Z_]{3,40}$/), name: z.string().min(2).max(100), description: z.string().max(500).nullable().optional(), permissions: z.array(z.string()).default([]) }));
  const bad1 = b.permissions.filter((p) => !ALL_PERMISSIONS.includes(p as any) || SUPER_ADMIN_ONLY.includes(p as any));
  if (bad1.length) throw bad(`Not allowed on custom roles: ${bad1.join(", ")}`);
  const [r] = await db.insert(t.roles).values(b).returning(); await audit(ctx, "create", "role", r.id, null, b); return { id: r.id };
});
