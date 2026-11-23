import { NextRequest, NextResponse } from "next/server";
import { getCtx } from "@/lib/auth";
import { getStaffMonitoringData } from "@/lib/staffMonitor";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.can("dashboard.founder") && !ctx.can("audit.view"))) {
    return NextResponse.json({ error: "Access denied. Founder / CEO privileges required." }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const role = (searchParams.get("role") as any) || "ALL";
  const userId = searchParams.get("userId") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;
  const range = (searchParams.get("range") as any) || "today";
  const activityType = searchParams.get("activityType") || "ALL";
  const status = (searchParams.get("status") as any) || "ALL";
  const search = searchParams.get("search") || undefined;
  const limit = Number(searchParams.get("limit") || 200);

  const data = await getStaffMonitoringData({
    role,
    userId,
    sessionId,
    range,
    activityType,
    status,
    search,
    limit,
  });

  return NextResponse.json({ ok: true, ...data });
}
