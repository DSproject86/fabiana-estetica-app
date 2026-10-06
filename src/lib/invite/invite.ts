import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/** Limite leggero: se il link finisse in giro non si riempie il database di iscrizioni false. */
export const INVITE_SIGNUPS_PER_HOUR = 5;

export function newInviteToken(): string {
  return randomBytes(18).toString("base64url"); // 24 caratteri, 144 bit casuali
}

export async function getActiveInvite() {
  return prisma.inviteLink.findFirst({ where: { revokedAt: null }, select: { id: true, token: true, createdAt: true } });
}

/** Link attivo con quel token, oppure null (inesistente o rigenerato). */
export async function findActiveInvite(token: string) {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  return prisma.inviteLink.findFirst({ where: { token, revokedAt: null }, select: { id: true } });
}

const INVITE_LOCK_KEY = 7_042_026_002; // diverso da quello delle prenotazioni

/**
 * Disattiva il link attuale e ne crea uno nuovo. I "Rigenera" simultanei passano uno alla volta
 * (lock legato alla transazione); l'indice unico parziale resta l'ultima difesa: un solo link attivo.
 */
export async function regenerateInvite(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${INVITE_LOCK_KEY}::bigint)`;
    await tx.inviteLink.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.inviteLink.create({ data: { token: newInviteToken() } });
  });
}

export async function signupsInLastHour(inviteLinkId: string, now = new Date()): Promise<number> {
  return prisma.client.count({
    where: { inviteLinkId, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
}

/** Indirizzo pubblico dell'app: APP_URL se impostata, altrimenti il dominio da cui si sta navigando. */
export async function appBaseUrl(): Promise<string> {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
