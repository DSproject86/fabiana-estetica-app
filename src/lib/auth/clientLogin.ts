import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendLoginCodeEmail } from "@/lib/notifications/loginCode";
import {
  CODE_RATE_WINDOW_MIN,
  CODE_TTL_MIN,
  canIssueCode,
  codeMatches,
  generateCode,
  hashCode,
  isCodeUsable,
} from "./loginCode";
import { sessionSecret } from "./session";

/**
 * Crea un codice e lo manda per email, se l'email è di una cliente non bloccata e il limite
 * (3 codici ogni 15 minuti) lo permette. Non dice mai a chi chiama com'è andata: la risposta
 * alla cliente è sempre la stessa, così non si scopre chi è iscritta.
 */
export async function issueLoginCode(email: string, now = new Date()): Promise<void> {
  const issued = await prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { email },
      select: { id: true, firstName: true, lastName: true, email: true, blockedAt: true },
    });
    if (!client?.email || client.blockedAt) return null;

    // Blocca la riga della cliente: due richieste simultanee non superano il limite insieme.
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${client.id} FOR UPDATE`;
    const recent = await tx.loginCode.findMany({
      where: { clientId: client.id, createdAt: { gt: new Date(now.getTime() - CODE_RATE_WINDOW_MIN * 60_000) } },
      select: { createdAt: true },
    });
    if (!canIssueCode(recent.map((r) => r.createdAt), now)) return null;

    // Vale solo l'ultimo codice: quelli precedenti non ancora usati vengono annullati.
    await tx.loginCode.updateMany({ where: { clientId: client.id, consumedAt: null }, data: { consumedAt: now } });
    const code = generateCode();
    await tx.loginCode.create({
      data: {
        clientId: client.id,
        codeHash: hashCode(client.id, code, sessionSecret()),
        expiresAt: new Date(now.getTime() + CODE_TTL_MIN * 60_000),
        createdAt: now,
      },
    });
    return { client: { id: client.id, firstName: client.firstName, lastName: client.lastName, email: client.email }, code };
  });

  if (issued) await sendLoginCodeEmail(issued.client, issued.code);
}

/**
 * Prepara e manda il codice DOPO la risposta: i tempi sono uguali per tutte le email,
 * registrate o no, e la cliente vede sempre lo stesso messaggio.
 */
export function sendCodeInBackground(email: string) {
  after(async () => {
    try {
      await issueLoginCode(email);
    } catch (error) {
      console.error("Codice di accesso non creato:", error);
    }
  });
}

export type VerifyResult = { ok: true; client: { id: string; sessionVersion: number } } | { ok: false };

/** Controlla il codice dell'ultima richiesta. Ogni tentativo (anche giusto) ne consuma uno. */
export async function verifyLoginCode(email: string, code: string, now = new Date()): Promise<VerifyResult> {
  const client = await prisma.client.findUnique({
    where: { email },
    select: { id: true, sessionVersion: true, blockedAt: true },
  });
  if (!client || client.blockedAt) return { ok: false };

  const stored = await prisma.loginCode.findFirst({
    where: { clientId: client.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!stored || !isCodeUsable(stored, now)) return { ok: false };

  // Il tentativo si conta prima del confronto, in modo atomico: niente tentativi "gratis" in parallelo.
  const counted = await prisma.loginCode.updateMany({
    where: { id: stored.id, consumedAt: null, attempts: stored.attempts },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) return { ok: false };
  if (!codeMatches(client.id, code, stored.codeHash, sessionSecret())) return { ok: false };

  const consumed = await prisma.loginCode.updateMany({
    where: { id: stored.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count !== 1) return { ok: false };

  await prisma.client.update({ where: { id: client.id }, data: { lastLoginAt: now } });
  return { ok: true, client: { id: client.id, sessionVersion: client.sessionVersion } };
}
