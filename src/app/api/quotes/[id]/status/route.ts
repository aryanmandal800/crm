import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { assertWritable, getInstitutionOr404 } from "@/lib/access";
import { audit } from "@/lib/audit";
import { bad, forbidden, notFound } from "@/lib/errors";

/** Quote lifecycle. Pricing is fixed at creation; changes mean a new quote number. */
export const POST = api<{ id: string }>(["quote.create", "quote.send", "pricing.approve"], async (ctx, _r, { id }) => {
  assertWritable(ctx);
  const [q] = await db.select().from(t.quotes).where(eq(t.quotes.id, id)); if (!q) throw notFound();
  await getInstitutionOr404(ctx, q.institutionId);
  const { action } = await ctx.json(z.object({ action: z.enum(["send", "accept", "reject", "cancel"]) }));
  const next: Record<string, string> = { send: "SENT", accept: "ACCEPTED", reject: "REJECTED", cancel: "CANCELLED" };
  if (action === "send") {
    if (!ctx.can("quote.send") && !ctx.can("pricing.approve")) throw forbidden("Sales executives prepare drafts; a manager or the Founder sends them");
    if (!["DRAFT", "APPROVED"].includes(q.status)) throw bad(q.status === "PENDING_APPROVAL" ? "This quote is waiting for pricing approval" : `Cannot send a ${q.status.toLowerCase()} quote`);
  }
  if ((action === "accept" || action === "reject") && q.status !== "SENT") throw bad("Only sent quotes can be accepted or rejected");
  if (action === "cancel" && q.createdById !== ctx.user.id && !ctx.can("pricing.approve")) throw forbidden();
  await db.update(t.quotes).set({ status: next[action], sentAt: action === "send" ? new Date() : q.sentAt }).where(eq(t.quotes.id, id));
  await audit(ctx, `quote_${action}`, "quote", id, { status: q.status }, { status: next[action] });
  return { id };
});
