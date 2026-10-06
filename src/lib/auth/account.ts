import "server-only";
import { prisma } from "@/lib/db";
import { afterFailedAttempt, isLocked } from "./lockout";
import { hashPassword, normalizePassword, verifyPassword } from "./password";

/** "Il mio account" degli admin: cambio password ed "Esci da tutti i dispositivi". */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

export type ChangePasswordField = "current" | "next" | "confirm";
export type ChangePasswordResult =
  | { ok: true; sessionVersion: number }
  | { ok: false; field?: ChangePasswordField; error: string };

export const LOCKED_MESSAGE = "Troppi tentativi con la password sbagliata. Riprova tra qualche minuto.";

/** Controlli sulla nuova password che non richiedono il database. */
export function newPasswordProblem(current: string, next: string, confirm: string): { field: ChangePasswordField; error: string } | null {
  if (next.length < MIN_PASSWORD_LENGTH) return { field: "next", error: `La nuova password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.` };
  if (next.length > MAX_PASSWORD_LENGTH) return { field: "next", error: `Al massimo ${MAX_PASSWORD_LENGTH} caratteri.` };
  if (next === current) return { field: "next", error: "La nuova password deve essere diversa da quella attuale." };
  if (next !== confirm) return { field: "confirm", error: "Le due password nuove non coincidono." };
  return null;
}

/**
 * Cambia la password dopo aver verificato quella attuale. Gli errori sulla password attuale contano
 * nello stesso blocco del login. Dopo il cambio `sessionVersion` aumenta: escono tutti gli altri
 * dispositivi (questo riceve un cookie nuovo con la versione restituita).
 */
export async function changeAdminPassword(
  adminId: string,
  raw: { current: string; next: string; confirm: string },
  now = new Date(),
): Promise<ChangePasswordResult> {
  const current = normalizePassword(raw.current);
  const next = normalizePassword(raw.next);
  const confirm = normalizePassword(raw.confirm);
  if (!current) return { ok: false, field: "current", error: "Scrivi la password attuale." };

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { passwordHash: true, failedLoginCount: true, lockedUntil: true },
  });
  if (!admin) return { ok: false, error: "Account non trovato." };
  if (isLocked(admin.lockedUntil, now)) return { ok: false, error: LOCKED_MESSAGE };

  if (!(await verifyPassword(current, admin.passwordHash))) {
    const failed = afterFailedAttempt(admin.failedLoginCount, now);
    await prisma.admin.update({ where: { id: adminId }, data: failed });
    return failed.lockedUntil
      ? { ok: false, error: LOCKED_MESSAGE }
      : { ok: false, field: "current", error: "La password attuale non è corretta." };
  }

  const problem = newPasswordProblem(current, next, confirm);
  if (problem) return { ok: false, ...problem };

  const updated = await prisma.admin.update({
    where: { id: adminId },
    data: {
      passwordHash: await hashPassword(next),
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
    select: { sessionVersion: true },
  });
  return { ok: true, sessionVersion: updated.sessionVersion };
}

/** Invalida tutte le sessioni dell'admin, compresa quella in uso. */
export async function signOutEverywhere(adminId: string): Promise<void> {
  await prisma.admin.update({ where: { id: adminId }, data: { sessionVersion: { increment: 1 } } });
}
