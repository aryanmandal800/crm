import { NextRequest, NextResponse } from "next/server";
// Cheap edge gate only — real authentication & authorisation run server-side on every page and API call.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(png|svg|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  ) return NextResponse.next();
  const authHeader = req.headers.get("authorization");
  const hasBearer = authHeader?.startsWith("Bearer ");
  const hasCookie = Boolean(req.cookies.get("fp_session"));

  if (!hasCookie && !hasBearer) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = ""; return NextResponse.redirect(url);
  }

  // If mobile sends Bearer token but no cookie, copy it into request cookies for downstream getCtx
  if (!hasCookie && hasBearer) {
    const token = authHeader!.slice(7).trim();
    const res = NextResponse.next();
    res.cookies.set("fp_session", token);
    return res;
  }

  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
