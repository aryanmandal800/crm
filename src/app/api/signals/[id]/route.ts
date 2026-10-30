import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { rescore } from "@/lib/scoring";
export const DELETE = api<{ id: string }>(["research.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const [s] = await db.select().from(t.signals).where(eq(t.signals.id, id)); if (!s) throw notFound();
  await getInstitutionOr404(ctx, s.institutionId);
  await db.delete(t.signals).where(eq(t.signals.id, id)); await rescore([s.institutionId]);
  await audit(ctx, "delete", "signal", id, s, null); return { id };
});
