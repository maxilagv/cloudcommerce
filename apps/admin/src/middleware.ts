import { NextResponse, type NextRequest } from "next/server";

/** Set by the API on login (httpOnly). Its mere presence gates the panel. */
const SESSION_COOKIE = "cc_admin_session";
const PUBLIC_PREFIXES = ["/login", "/recuperar"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authenticated = req.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!authenticated && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (authenticated && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
