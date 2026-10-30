import { db, t } from "@/db";
import type { Ctx } from "./auth";

/** Strip secrets before they reach the audit log. */
function clean(v: unknown): unknown {
  if (v == null || typeof v !== "object") return v ?? null;
  const o: Record<string, unknown> = Array.isArray(v) ? ([...v] as any) : { ...(v as object) };
  for (const k of Object.keys(o)) if (/password|secret|token|apikey|api_key/i.test(k)) o[k] = "[redacted]";
  return o;
}

export async function audit(ctx: Ctx | null, action: string, entityType: string, entityId: string | null, before?: unknown, after?: unknown) {
  await db.insert(t.auditLogs).values({
    actorId: ctx?.user.id ?? null, actorName: ctx?.user.name ?? "system", actorRole: ctx?.role.key ?? "SYSTEM",
    action, entityType, entityId, before: clean(before) as any, after: clean(after) as any, ip: ctx?.ip ?? null,
  });
}

/** Entity types visible to the Technical Administrator's restricted audit view. */
export const TECHNICAL_AUDIT_ENTITIES = ["setting", "role", "user", "taxonomy", "change_request", "backup", "job", "grant", "auth"];
