import { SignJWT, jwtVerify } from "jose";

/**
 * Sessioni senza tabella: cookie con un JWT firmato (HS256) da SESSION_SECRET.
 * Il token contiene l'id e la sessionVersion: aumentandola nel database
 * tutte le sessioni esistenti di quell'utente smettono di valere.
 */

/** "login": accesso cliente in corso (email in attesa del codice), non è una sessione. */
export type SessionRole = "admin" | "client" | "login";

export type SessionPayload = {
  sub: string;
  role: SessionRole;
  ver: number;
};

export const ADMIN_COOKIE = "fl_admin";
export const CLIENT_COOKIE = "fl_client";
export const LOGIN_PENDING_COOKIE = "fl_login";

export const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 giorni
export const CLIENT_SESSION_SECONDS = 60 * 60 * 24 * 180; // 180 giorni
export const LOGIN_PENDING_SECONDS = 60 * 30; // tempo per inserire il codice (o chiederne un altro)

const ISSUER = "fabiana-estetica";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET mancante o troppo corto (minimo 32 caratteri).");
  }
  return secret;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(sessionSecret());
}

export async function signSession(payload: SessionPayload, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({ role: payload.role, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey());
}

/** Restituisce il contenuto se firma e scadenza sono valide, altrimenti null. */
export async function verifySession(
  token: string | undefined,
  role: SessionRole,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    if (payload.role !== role || typeof payload.sub !== "string" || typeof payload.ver !== "number") {
      return null;
    }
    return { sub: payload.sub, role, ver: payload.ver };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
