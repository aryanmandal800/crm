import { NextResponse } from "next/server";
import { clearSession, getCtx } from "@/lib/auth";
import { closeSession } from "@/lib/activity";
import { audit } from "@/lib/audit";

export async function POST() {
  const ctx = await getCtx();
  if (ctx) {
    await closeSession(ctx.sessionId, ctx.user.id, ctx.ip);
    await audit(ctx, "logout", "auth", ctx.user.id);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
