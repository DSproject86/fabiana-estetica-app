import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, CLIENT_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Primo filtro veloce: controlla solo firma e scadenza dei cookie.
 * Il controllo completo (utente esistente, sessionVersion, blocco) è nelle pagine
 * con requireAdmin() / requireClient().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/prenota" || pathname.startsWith("/prenota/") || pathname === "/appuntamenti") {
    const session = await verifySession(request.cookies.get(CLIENT_COOKIE)?.value, "client");
    return session ? NextResponse.next() : NextResponse.redirect(new URL("/accedi", request.url));
  }

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
  matcher: ["/admin", "/admin/:path*", "/prenota", "/prenota/:path*", "/appuntamenti"],
};
