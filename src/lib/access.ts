import { and, eq, inArray, isNull, or, sql, SQL } from "drizzle-orm";
import { db, t } from "@/db";
import type { Ctx } from "./auth";
import { forbidden, notFound } from "./errors";

/** Row-level visibility for institutions. */
export function instScope(ctx: Ctx): SQL {
  const live = isNull(t.institutions.deletedAt);
  switch (ctx.scope) {
    case "ALL": return live;
    case "TEAM": return and(live, or(inArray(t.institutions.ownerId, ctx.teamUserIds), isNull(t.institutions.ownerId)))!;
    case "OWN": return and(live, eq(t.institutions.ownerId, ctx.user.id))!;
    default: return sql`false`;
  }
}

/** Row-level visibility for deals (owner-based). */
export function dealScope(ctx: Ctx): SQL {
  if (!ctx.can("deal.view")) return sql`false`;
  switch (ctx.scope) {
    case "ALL": return sql`true`;
    case "TEAM": return inArray(t.deals.ownerId, ctx.teamUserIds);
    case "OWN": return eq(t.deals.ownerId, ctx.user.id);
    default: return sql`false`;
  }
}

/** Activities: whose activity rows a user may read. */
export function activityScope(ctx: Ctx): SQL {
  switch (ctx.scope) {
    case "ALL": return sql`true`;
    case "TEAM": return inArray(t.activities.userId, ctx.teamUserIds);
    case "OWN": return or(eq(t.activities.userId, ctx.user.id), inArray(t.activities.institutionId,
      db.select({ id: t.institutions.id }).from(t.institutions).where(eq(t.institutions.ownerId, ctx.user.id))))!;
    default: return sql`false`;
  }
}

export async function getInstitutionOr404(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const [row] = await db.select().from(t.institutions).where(and(eq(t.institutions.id, id), instScope(ctx)));
  if (!row) throw notFound("Institution not found or not in your scope");
  return row;
}

export async function getDealOr404(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const [row] = await db.select().from(t.deals).where(and(eq(t.deals.id, id), dealScope(ctx)));
  if (!row) throw notFound("Deal not found or not in your scope");
  return row;
}

/** Can the actor assign work to this user? */
export function canAssignTo(ctx: Ctx, userId: string) {
  if (!ctx.can("lead.assign")) return false;
  if (ctx.scope === "ALL") return true;
  return ctx.teamUserIds.includes(userId);
}

export function assertWritable(ctx: Ctx) {
  // Break-glass grants are read-only
  if (ctx.grant) throw forbidden("Your data-access grant is read-only");
}
