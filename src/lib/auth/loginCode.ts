import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Codici di accesso per le clienti: 6 cifre, inviati per email.
 * Nel database finisce solo l'HMAC (chiave ricavata da SESSION_SECRET), mai il codice in chiaro.
 */

export const CODE_TTL_MIN = 10; // validità del codice
export const CODE_MAX_ATTEMPTS = 5; // tentativi per codice
export const CODE_RATE_WINDOW_MIN = 15; // finestra del limite anti-abuso…
export const CODE_RATE_MAX = 3; // …al massimo 3 codici per email

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Toglie spazi e trattini (chi copia "123 456" dall'email); null se non sono 6 cifre. */
export function normalizeCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** HMAC-SHA256 legato alla cliente: lo stesso codice di un'altra cliente dà un hash diverso. */
export function hashCode(clientId: string, code: string, secret: string): string {
  const key = createHmac("sha256", secret).update("login-code").digest();
  return createHmac("sha256", key).update(`${clientId}:${code}`).digest("hex");
}

export function codeMatches(clientId: string, code: string, storedHash: string, secret: string): boolean {
  const a = Buffer.from(hashCode(clientId, code, secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Si può mandare un altro codice? `recent` = istanti dei codici già creati per questa cliente. */
export function canIssueCode(recent: Date[], now: Date): boolean {
  const since = now.getTime() - CODE_RATE_WINDOW_MIN * 60_000;
  return recent.filter((d) => d.getTime() > since).length < CODE_RATE_MAX;
}

export type StoredCode = { codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null };

/** Il codice salvato accetta ancora tentativi? (non usato, non scaduto, tentativi non esauriti) */
export function isCodeUsable(stored: StoredCode, now: Date): boolean {
  return !stored.consumedAt && stored.expiresAt > now && stored.attempts < CODE_MAX_ATTEMPTS;
}
