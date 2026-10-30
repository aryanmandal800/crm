import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";
import { getCtx, type Ctx } from "./auth";
import { HttpError, forbidden } from "./errors";
import type { Permission } from "./permissions";
import { db, t } from "@/db";

type Handler<P> = (ctx: Ctx & { json: <T>(schema: ZodType<T>) => Promise<T> }, req: NextRequest, params: P) => Promise<unknown>;

/**
 * Wraps every API route: authentication, any-of permission check, same-origin check on writes,
 * input validation errors → 400, unexpected errors → logged to error_logs for the tech dashboard.
 */
export function api<P = Record<string, string>>(anyOf: Permission[] | null, fn: Handler<P>) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    let ctx: Ctx | null = null;
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
        if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request blocked");
      }
      ctx = await getCtx();
      if (!ctx) throw new HttpError(401, "Not signed in");
      if (ctx.user.mustChangePassword && !req.nextUrl.pathname.startsWith("/api/auth")) throw new HttpError(403, "Change your password first");
      if (anyOf && anyOf.length && !anyOf.some((p) => ctx!.can(p))) throw forbidden();
      const c = Object.assign(ctx, { json: async <T,>(s: ZodType<T>) => s.parse(await req.json()) });
      const out = await fn(c, req, (await route.params) as P);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e: any) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Invalid input", details: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
      const pgMsg = typeof e?.message === "string" && /locked|append-only|cannot be deleted/.test(e.message) ? e.message : null;
      if (pgMsg) return NextResponse.json({ error: pgMsg }, { status: 409 });
      console.error(e);
      try {
        await db.insert(t.errorLogs).values({ route: req.nextUrl.pathname, method: req.method, status: 500, message: String(e?.message ?? e).slice(0, 2000), stack: String(e?.stack ?? "").slice(0, 8000), userId: ctx?.user.id ?? null });
      } catch {}
      return NextResponse.json({ error: "Internal error — logged for the technical team" }, { status: 500 });
    }
  };
}
