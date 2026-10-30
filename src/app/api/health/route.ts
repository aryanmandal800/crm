import { NextResponse } from "next/server";
import { pool } from "@/db";
export const dynamic = "force-dynamic";
/** Liveness/readiness probe for load balancer / uptime monitor. No business data. */
export async function GET() {
  const t0 = Date.now();
  try { await pool.query("select 1"); return NextResponse.json({ status: "ok", db: "ok", dbMs: Date.now() - t0, uptimeSec: Math.round(process.uptime()) }); }
  catch { return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 }); }
}
