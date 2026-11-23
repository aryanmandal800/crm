import { NextRequest, NextResponse } from "next/server";
import { getCtx } from "@/lib/auth";
import { touchSession } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  await touchSession(ctx.sessionId, ctx.user.id, body.route);

  return NextResponse.json({ ok: true });
}
