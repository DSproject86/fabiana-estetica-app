import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminClientSchema, type AdminClientField } from "./adminClients";

/** Scheda cliente lato admin: modifica dati, blocco ed eliminazione per la privacy. */

export const ANONYMIZED_FIRST_NAME = "Cliente";
export const ANONYMIZED_LAST_NAME = "eliminata";
export const ANONYMIZED_RECIPIENT = "cliente eliminata";

const notes = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .pipe(z.string().max(max, `Massimo ${max} caratteri.`).nullable());

const editSchema = adminClientSchema.extend({ adminNotes: notes(1000), allergyNotes: notes(500) });

export type EditClientField = AdminClientField | "adminNotes" | "allergyNotes";
export type EditClientResult = { ok: true } | { ok: false; error?: string; fieldErrors?: Partial<Record<EditClientField, string>> };

/**
 * Salva i dati della cliente. Le note allergie si toccano solo se il campo era nel modulo
 * (`includeAllergy`): con l'impostazione "Mostra note allergie" spenta il dato resta com'è.
 */
export async function updateClientByAdmin(
  clientId: string,
  raw: Record<string, string>,
  includeAllergy: boolean,
): Promise<EditClientResult> {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<EditClientField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as EditClientField | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { anonymizedAt: true } });
  if (!client) return { ok: false, error: "Cliente non trovata." };
  if (client.anonymizedAt) return { ok: false, error: "I dati di questa cliente sono stati eliminati." };

  const { allergyNotes, ...values } = parsed.data;
  if (values.email) {
    const other = await prisma.client.findFirst({ where: { email: values.email, id: { not: clientId } }, select: { id: true } });
    if (other) return { ok: false, fieldErrors: { email: "Questa email è già di un'altra cliente." } };
  }
  try {
    await prisma.client.update({ where: { id: clientId }, data: { ...values, ...(includeAllergy ? { allergyNotes } : {}) } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { ok: false, fieldErrors: { email: "Questa email è già di un'altra cliente." } };
    }
    throw error;
  }
  return { ok: true };
}

/** Bloccare fa uscire subito la cliente (sessionVersion) e annulla i codici di accesso in sospeso. */
export async function setClientBlocked(clientId: string, blocked: boolean, now = new Date()): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.updateMany({
      where: { id: clientId, anonymizedAt: null },
      data: blocked ? { blockedAt: now, sessionVersion: { increment: 1 } } : { blockedAt: null },
    });
    if (blocked) await tx.loginCode.deleteMany({ where: { clientId } });
    return updated.count === 1;
  });
}

// ─────────────── Elimina cliente (privacy) ───────────────

export type DeleteClientResult = { ok: true; mode: "deleted" | "anonymized" } | { ok: false; error: string };

export const FUTURE_APPOINTMENTS = "Ha ancora appuntamenti in programma: annullali prima di eliminarla.";
export const CONFIRM_MISMATCH = "Per confermare scrivi il cognome della cliente.";

/** Il cognome scritto per confermare (maiuscole e spazi in più non contano). */
export function confirmsLastName(typed: string, lastName: string): boolean {
  const norm = (v: string) => v.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");
  return norm(typed) !== "" && norm(typed) === norm(lastName);
}

/**
 * Su richiesta della cliente:
 * - senza appuntamenti né pacchetti → la cliente si cancella davvero;
 * - con uno storico → si anonimizza: nome "Cliente eliminata", niente cellulare, email, note, allergie,
 *   consenso e codici; svuotate anche le note di appuntamenti, pacchetti e pagamenti e i destinatari nel
 *   registro invii. Importi, servizi e date restano (statistiche).
 * Rifiutato se ha appuntamenti futuri confermati.
 */
export async function deleteClientForPrivacy(clientId: string, typedLastName: string, now = new Date()): Promise<DeleteClientResult> {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { lastName: true, anonymizedAt: true, _count: { select: { appointments: true, packages: true } } },
    });
    if (!client || client.anonymizedAt) return { ok: false, error: "Cliente non trovata." };
    if (!confirmsLastName(typedLastName, client.lastName)) return { ok: false, error: CONFIRM_MISMATCH };
    const future = await tx.appointment.count({ where: { clientId, status: "CONFIRMED", startsAt: { gte: now } } });
    if (future > 0) return { ok: false, error: FUTURE_APPOINTMENTS };

    // Il registro invii tiene il destinatario anche dopo: lo si cancella in entrambi i casi.
    await tx.notificationLog.updateMany({
      where: { clientId, kind: { not: "ADMIN_NEW_BOOKING" } },
      data: { recipient: ANONYMIZED_RECIPIENT },
    });

    if (client._count.appointments === 0 && client._count.packages === 0) {
      await tx.client.delete({ where: { id: clientId } });
      return { ok: true, mode: "deleted" };
    }

    await tx.loginCode.deleteMany({ where: { clientId } });
    await tx.appointment.updateMany({ where: { clientId }, data: { adminNotes: null } });
    await tx.clientPackage.updateMany({ where: { clientId }, data: { notes: null } });
    await tx.packagePayment.updateMany({ where: { package: { clientId } }, data: { note: null } });
    await tx.client.update({
      where: { id: clientId },
      data: {
        firstName: ANONYMIZED_FIRST_NAME,
        lastName: ANONYMIZED_LAST_NAME,
        phone: "",
        email: null,
        allergyNotes: null,
        adminNotes: null,
        privacyAcceptedAt: null,
        privacyVersion: null,
        lastLoginAt: null,
        blockedAt: now,
        anonymizedAt: now,
        sessionVersion: { increment: 1 },
      },
    });
    return { ok: true, mode: "anonymized" };
  });
}

// ─────────────── Scheda ───────────────

/** Totale speso (incassi degli appuntamenti Fatti + pagamenti dei pacchetti) e non presentate. */
export async function loadClientTotals(clientId: string) {
  const [done, payments, noShows, doneCount] = await Promise.all([
    prisma.appointment.aggregate({
      where: { clientId, status: "CONFIRMED", doneAt: { not: null } },
      _sum: { amountCollectedCents: true },
    }),
    prisma.packagePayment.aggregate({ where: { package: { clientId } }, _sum: { amountCents: true } }),
    prisma.appointment.count({ where: { clientId, status: "NO_SHOW" } }),
    prisma.appointment.count({ where: { clientId, status: "CONFIRMED", doneAt: { not: null } } }),
  ]);
  const appointmentsCents = done._sum.amountCollectedCents ?? 0;
  const packagesCents = payments._sum.amountCents ?? 0;
  return { appointmentsCents, packagesCents, totalCents: appointmentsCents + packagesCents, noShows, doneCount };
}
