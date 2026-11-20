import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { getInstitutionOr404 } from "@/lib/access";
import { notFound } from "@/lib/errors";

export const GET = api<{ id: string }>(["quote.create", "pricing.approve"], async (ctx, _r, { id }) => {
  const q = await db.query.quotes.findFirst({
    where: eq(t.quotes.id, id),
    with: { institution: true, createdBy: true },
  });
  if (!q) throw notFound();
  await getInstitutionOr404(ctx, q.institutionId);
  return { quote: q };
});
