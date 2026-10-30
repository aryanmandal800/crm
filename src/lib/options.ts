import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Ctx } from "./auth";

export async function options() {
  const [districts, talukas, types, users, stages, activityTypes, lostReasons, modules, competitors, questions, params] = await Promise.all([
    db.select().from(t.districts).where(eq(t.districts.active, true)).orderBy(asc(t.districts.name)),
    db.select().from(t.talukas).where(eq(t.talukas.active, true)).orderBy(asc(t.talukas.name)),
    db.select().from(t.institutionTypes).where(eq(t.institutionTypes.active, true)).orderBy(asc(t.institutionTypes.sortOrder)),
    db.select({ id: t.users.id, name: t.users.name, teamId: t.users.teamId, roleId: t.users.roleId }).from(t.users).where(eq(t.users.active, true)).orderBy(asc(t.users.name)),
    db.select().from(t.pipelineStages).where(eq(t.pipelineStages.active, true)).orderBy(asc(t.pipelineStages.sortOrder)),
    db.select().from(t.activityTypes).where(eq(t.activityTypes.active, true)).orderBy(asc(t.activityTypes.sortOrder)),
    db.select().from(t.lostReasons).where(eq(t.lostReasons.active, true)),
    db.select().from(t.productModules).where(eq(t.productModules.active, true)).orderBy(asc(t.productModules.sortOrder)),
    db.select({ id: t.competitors.id, name: t.competitors.name }).from(t.competitors).orderBy(asc(t.competitors.name)),
    db.select().from(t.qualificationQuestions).where(eq(t.qualificationQuestions.active, true)).orderBy(asc(t.qualificationQuestions.sortOrder)),
    db.select().from(t.scoringParameters).where(eq(t.scoringParameters.active, true)).orderBy(asc(t.scoringParameters.sortOrder)),
  ]);
  return { districts, talukas, types, users, stages, activityTypes, lostReasons, modules, competitors, questions, params };
}

/** Users the actor may assign work to. */
export function assignable(ctx: Ctx, users: { id: string; name: string }[]) {
  if (ctx.scope === "ALL" && ctx.can("lead.assign")) return users;
  return users.filter((u) => ctx.teamUserIds.includes(u.id));
}
export const opt = <T extends { id: string; name: string }>(xs: T[]) => xs.map((x) => ({ value: x.id, label: x.name }));
export const enumOpt = (xs: string[]) => xs.map((x) => ({ value: x, label: x.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }));
