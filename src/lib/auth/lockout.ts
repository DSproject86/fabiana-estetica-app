/**
 * Blocco dopo troppe password sbagliate: vale per il login e per "Cambia password"
 * (5 errori di fila → 15 minuti di blocco).
 */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** Nuovo stato dopo una password sbagliata. */
export function afterFailedAttempt(failedLoginCount: number, now: Date): { failedLoginCount: number; lockedUntil: Date | null } {
  const failed = failedLoginCount + 1;
  const lock = failed >= MAX_FAILED_ATTEMPTS;
  return { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null };
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return !!lockedUntil && lockedUntil > now;
}
