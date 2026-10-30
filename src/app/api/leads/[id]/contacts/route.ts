import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { contactInput } from "@/lib/schemas";
import { rescore } from "@/lib/scoring";
export const POST = api<{ id: string }>(["contact.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); await getInstitutionOr404(ctx, id);
  const b = await ctx.json(contactInput);
  const [c] = await db.insert(t.contacts).values({ ...b, institutionId: id } as any).returning();
  await rescore([id]); await audit(ctx, "create", "contact", c.id, null, { name: c.name, institutionId: id });
  return { id: c.id };
});
