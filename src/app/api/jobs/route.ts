import { z } from "zod";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
/** Queue a maintenance job for the worker (backup, full rescore, reminders). */
export const POST = api(["tech.dashboard", "settings.business"], async (ctx) => {
  const b = await ctx.json(z.object({ type: z.enum(["BACKUP", "RESCORE", "FOLLOWUP_REMINDERS", "VERIFICATION_DUE", "EXPIRE_QUOTES", "DAILY_SUMMARY"]) }));
  const [j] = await db.insert(t.jobs).values({ type: b.type, payload: { trigger: "MANUAL", by: ctx.user.name } }).returning();
  await audit(ctx, "queue_job", "job", j.id, null, b); return { id: j.id, message: `${b.type} queued — the worker picks it up within a minute` };
});
