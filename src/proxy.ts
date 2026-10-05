import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Primo filtro veloce per l'area admin: controlla solo firma e scadenza del cookie.
 * Il controllo completo (admin esistente, sessionVersion) è nel layout con requireAdmin().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const session = await verifySession(request.cookies.get(ADMIN_COOKIE)?.value, "admin");
  if (session) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  if (pathname !== "/admin" && pathname !== "/admin/agenda") {
    loginUrl.searchParams.set("next", pathname + search);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
