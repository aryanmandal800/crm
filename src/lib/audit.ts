import { db, t } from "@/db";
import type { Ctx } from "./auth";
import { logActivity } from "./activity";

/** Strip secrets before they reach the audit log. */
function clean(v: unknown): unknown {
  if (v == null || typeof v !== "object") return v ?? null;
  const o: Record<string, unknown> = Array.isArray(v) ? ([...v] as any) : { ...(v as object) };
  for (const k of Object.keys(o)) if (/password|secret|token|apikey|api_key/i.test(k)) o[k] = "[redacted]";
  return o;
}

export async function audit(ctx: Ctx | null, action: string, entityType: string, entityId: string | null, before?: unknown, after?: unknown) {
  const cleanedBefore = clean(before);
  const cleanedAfter = clean(after);

  await db.insert(t.auditLogs).values({
    actorId: ctx?.user.id ?? null,
    actorName: ctx?.user.name ?? "system",
    actorRole: ctx?.role.key ?? "SYSTEM",
    action,
    entityType,
    entityId,
    before: cleanedBefore as any,
    after: cleanedAfter as any,
    ip: ctx?.ip ?? null,
  });

  // Dual-write into userActivityLogs if user context is present
  if (ctx?.user) {
    const actionLabel = action.replace(/_/g, " ");
    const formattedTitle = `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} on ${entityType.replace(/_/g, " ")}${entityId ? ` (${entityId.slice(0, 8)}...)` : ""}`;
    await logActivity({
      sessionId: ctx.sessionId,
      userId: ctx.user.id,
      userName: ctx.user.name,
      userEmail: ctx.user.email,
      roleKey: ctx.role.key,
      activityType: action.toUpperCase(),
      title: formattedTitle,
      entityType,
      entityId,
      details: { before: cleanedBefore, after: cleanedAfter },
      ip: ctx.ip,
    });
  }
}

/** Entity types visible to the Technical Administrator's restricted audit view. */
export const TECHNICAL_AUDIT_ENTITIES = ["setting", "role", "user", "taxonomy", "change_request", "backup", "job", "grant", "auth", "session"];
