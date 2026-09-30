import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, loginUrl } from "@/lib/routes";
import { isTokenUsable, TOKEN_COOKIE } from "@/lib/session";

/**
 * Optimistic session check: sends visitors without a usable token to login.
 * The signature is only checked by the backend; a 401 there logs out too.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (isTokenUsable(token)) return NextResponse.next();

  const res = NextResponse.redirect(new URL(loginUrl(`${pathname}${search}`), request.url));
  if (token !== undefined) res.cookies.delete(TOKEN_COOKIE);
  return res;
}

export const config = {
  // Skip Next internals and static files (anything with an extension).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
