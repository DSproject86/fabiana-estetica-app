import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  CLIENT_COOKIE,
  CLIENT_SESSION_SECONDS,
  LOGIN_PENDING_COOKIE,
  LOGIN_PENDING_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "./session";

export type CurrentClient = { id: string; firstName: string; lastName: string; email: string | null; phone: string };

/** Cliente collegata (firma, scadenza, sessionVersion e blocco verificati), oppure null. */
export const getCurrentClient = cache(async (): Promise<CurrentClient | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(CLIENT_COOKIE)?.value, "client");
  if (!session) return null;

  const client = await prisma.client.findUnique({
    where: { id: session.sub },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, sessionVersion: true, blockedAt: true },
  });
  if (!client || client.sessionVersion !== session.ver || client.blockedAt) return null;

  return { id: client.id, firstName: client.firstName, lastName: client.lastName, email: client.email, phone: client.phone };
});

export async function requireClient(): Promise<CurrentClient> {
  const client = await getCurrentClient();
  if (!client) redirect("/accedi");
  return client;
}

export async function startClientSession(client: { id: string; sessionVersion: number }) {
  const token = await signSession({ sub: client.id, role: "client", ver: client.sessionVersion }, CLIENT_SESSION_SECONDS);
  const store = await cookies();
  store.set(CLIENT_COOKIE, token, sessionCookieOptions(CLIENT_SESSION_SECONDS));
}

export async function endClientSession() {
  const store = await cookies();
  store.delete(CLIENT_COOKIE);
}

// ─────────────── Accesso in corso: email in attesa del codice ───────────────

/** L'email resta in un cookie firmato e breve, non nell'indirizzo della pagina. */
export async function setPendingLogin(email: string) {
  const token = await signSession({ sub: email, role: "login", ver: 0 }, LOGIN_PENDING_SECONDS);
  const store = await cookies();
  store.set(LOGIN_PENDING_COOKIE, token, sessionCookieOptions(LOGIN_PENDING_SECONDS));
}

export async function getPendingLogin(): Promise<string | null> {
  const store = await cookies();
  const session = await verifySession(store.get(LOGIN_PENDING_COOKIE)?.value, "login");
  return session?.sub ?? null;
}

export async function clearPendingLogin() {
  const store = await cookies();
  store.delete(LOGIN_PENDING_COOKIE);
}
