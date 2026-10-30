import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { sourceInput } from "@/lib/schemas";
import { setting } from "@/lib/settings";
import { addDays } from "@/lib/format";

/** Adding a source also marks the fields it supports with its fact classification. */
export const POST = api<{ id: string }>(["research.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const inst = await getInstitutionOr404(ctx, id);
  const b = await ctx.json(sourceInput);
  const interval = await setting<number>("sales.verificationIntervalDays");
  const [s] = await db.insert(t.sources).values({ ...b, institutionId: id, addedById: ctx.user.id, nextVerificationAt: b.nextVerificationAt ?? addDays(new Date(), interval) } as any).returning();
  if (b.fieldKeys?.length) {
    const fs = { ...(inst.factStatus ?? {}) }; for (const k of b.fieldKeys) fs[k] = b.classification ?? "PUBLICLY_REPORTED";
    await db.update(t.institutions).set({ factStatus: fs, lastVerifiedAt: new Date(), nextVerificationAt: addDays(new Date(), interval) }).where(eq(t.institutions.id, id));
  }
  await audit(ctx, "create", "source", s.id, null, { name: s.name, url: s.url, fields: b.fieldKeys }); return { id: s.id };
});
