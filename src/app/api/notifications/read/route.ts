import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
export const POST = api(null, async (ctx) => { await db.update(t.notifications).set({ readAt: new Date() }).where(and(eq(t.notifications.userId, ctx.user.id), isNull(t.notifications.readAt))); return { ok: true }; });
