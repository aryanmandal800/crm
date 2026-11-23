import { NextRequest, NextResponse } from "next/server";
import { getCtx } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const activityType = body.activityType || "PAGE_VIEW";
  const route = body.route || "/";
  const title = body.title || `Visited ${route}`;

  await logActivity({
    sessionId: ctx.sessionId,
    userId: ctx.user.id,
    userName: ctx.user.name,
    userEmail: ctx.user.email,
    roleKey: ctx.role.key,
    activityType,
    title,
    route,
    entityType: body.entityType,
    entityId: body.entityId,
    details: body.details,
    ip: ctx.ip,
    location: body.clientAddress,
  });

  return NextResponse.json({ ok: true });
}
