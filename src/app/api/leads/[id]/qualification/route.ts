import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
export const POST = api<{ id: string }>(["lead.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const inst = await getInstitutionOr404(ctx, id);
  const b = await ctx.json(z.record(z.string(), z.string().max(2000).nullable()));
  const q = { ...inst.qualification } as Record<string, string>;
  for (const [k, v] of Object.entries(b)) { if (v) q[k] = v; else delete q[k]; }
  await db.update(t.institutions).set({ qualification: q }).where(eq(t.institutions.id, id));
  await audit(ctx, "qualification", "institution", id, null, b); return { id, message: "Saved" };
});
