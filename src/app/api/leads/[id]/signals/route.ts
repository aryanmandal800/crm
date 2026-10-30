import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { signalInput } from "@/lib/schemas";
import { rescore } from "@/lib/scoring";
export const POST = api<{ id: string }>(["research.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); await getInstitutionOr404(ctx, id);
  const b = await ctx.json(signalInput);
  const [s] = await db.insert(t.signals).values({ ...b, institutionId: id, createdById: ctx.user.id } as any).returning();
  await rescore([id]); await audit(ctx, "create", "signal", s.id, null, b); return { id: s.id };
});
