import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { bad, forbidden, notFound } from "@/lib/errors";
import { ALL_PERMISSIONS, SUPER_ADMIN_ONLY } from "@/lib/permissions";
export const PATCH = api<{ id: string }>(["roles.manage"], async (ctx, _r, { id }) => {
  const [r] = await db.select().from(t.roles).where(eq(t.roles.id, id)); if (!r) throw notFound();
  if (r.key === "SUPER_ADMIN") throw forbidden("The Super Admin role always has every permission and cannot be edited");
  const b = await ctx.json(z.object({ name: z.string().min(2).max(100).optional(), description: z.string().max(500).nullable().optional(), permissions: z.array(z.string()).optional() }));
  if (b.permissions) {
    const invalid = b.permissions.filter((p) => !ALL_PERMISSIONS.includes(p as any)); if (invalid.length) throw bad(`Unknown: ${invalid.join(", ")}`);
    const reserved = b.permissions.filter((p) => SUPER_ADMIN_ONLY.includes(p as any)); if (reserved.length) throw forbidden(`Reserved for Super Admin: ${reserved.join(", ")}`);
  }
  await db.update(t.roles).set(b).where(eq(t.roles.id, id));
  await audit(ctx, "update_permissions", "role", id, { permissions: r.permissions }, b);
  return { id, message: "Role updated — takes effect on users' next request" };
});
