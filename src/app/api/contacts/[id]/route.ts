import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { contactInput } from "@/lib/schemas";
import { rescore } from "@/lib/scoring";
async function load(ctx: any, id: string) {
  const [c] = await db.select().from(t.contacts).where(eq(t.contacts.id, id)); if (!c) throw notFound();
  await getInstitutionOr404(ctx, c.institutionId); return c;
}
export const PATCH = api<{ id: string }>(["contact.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const c = await load(ctx, id); const b = await ctx.json(contactInput.partial());
  await db.update(t.contacts).set(b as any).where(eq(t.contacts.id, id)); await rescore([c.institutionId]);
  await audit(ctx, "update", "contact", id, null, b); return { id };
});
export const DELETE = api<{ id: string }>(["contact.edit"], async (ctx, _r, { id }) => {
  assertWritable(ctx); const c = await load(ctx, id);
  await db.update(t.activities).set({ contactId: null }).where(eq(t.activities.contactId, id));
  await db.delete(t.contacts).where(eq(t.contacts.id, id)); await rescore([c.institutionId]);
  await audit(ctx, "delete", "contact", id, { name: c.name }, null); return { id };
});
