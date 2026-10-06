import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Controlla "Authorization: Bearer <CRON_SECRET>" a tempo costante (si confrontano gli hash,
 * così anche la lunghezza non trapela). Senza CRON_SECRET configurato non passa nessuno.
 */
export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  const expected = secret?.trim();
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  const provided = match?.[1]?.trim() ?? "";
  // Il confronto avviene sempre, anche con header assente, per non cambiare i tempi.
  const same = timingSafeEqual(digest(provided), digest(expected));
  return same && provided.length > 0;
}
