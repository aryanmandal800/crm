import { NextRequest, NextResponse } from "next/server";
// Cheap edge gate only — real authentication & authorisation run server-side on every page and API call.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/health") || pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();
  if (!req.cookies.get("fp_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = ""; return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
