import "server-only";
import {
  OVERLAP_MESSAGE,
  checkStart,
  createAppointment,
  isOverlapError,
  type CreateAppointmentResult,
} from "@/lib/availability/createAppointment";
import { roundUpTo } from "@/lib/availability/duration";
import { withBookingLock } from "@/lib/availability/lock";
import { loadSettings } from "@/lib/availability/queries";
import { loadServicesForBooking } from "@/lib/availability/services";
import { MAX_CENTS } from "@/lib/money";
import { loadOfferPackages } from "@/lib/packages/queries";
import { amountAfterPackageChange, defaultLinks, itemOffers } from "@/lib/packages/rules";
import type { Db } from "@/lib/schedule/queries";
import { dayKeyOf } from "@/lib/time/rome";
import { canCancel, canEdit, canMarkOutcome, collectableCents, mergeItems } from "./rules";

/**
 * Operazioni dell'agenda admin. Tutte passano dal lock delle prenotazioni (pg_advisory_xact_lock),
 * come createAppointment: ricontrollano lo stato dentro la transazione e trasformano la violazione
 * del vincolo anti-sovrapposizione in un messaggio leggibile.
 */

export type AgendaResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const NOT_FOUND = "Appuntamento non trovato.";
export const NOT_EDITABLE =
  "Si possono modificare solo gli appuntamenti confermati e non ancora segnati come Fatti (togli prima la spunta).";
export const TOO_EARLY = "Si può segnare solo dal giorno dell'appuntamento in poi.";
export const CANCEL_NOT_ALLOWED = "Si possono annullare solo gli appuntamenti confermati (una “non presentata” va prima ripristinata).";
export const CONFIRM_DONE_CANCEL =
  "Questo appuntamento è segnato come Fatto: per annullarlo serve la conferma (l'incasso verrà tolto dalle statistiche).";
export const RESTORE_TAKEN =
  "Nel frattempo quell'orario è stato occupato da un altro appuntamento: non posso rimetterla tra i confermati.";

async function locked<T>(fn: (tx: Db) => Promise<AgendaResult<T>>, overlapMessage = OVERLAP_MESSAGE): Promise<AgendaResult<T>> {
  try {
    return await withBookingLock(fn);
  } catch (error) {
    if (isOverlapError(error)) return { ok: false, error: overlapMessage };
    throw error;
  }
}

function validDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// ─────────────── Nuovo appuntamento ───────────────

export function createAdminAppointment(input: {
  clientId: string;
  serviceIds: string[];
  startsAt: Date;
  noBuffer: boolean;
  ignoreWorkingHours: boolean;
  now?: Date;
}): Promise<CreateAppointmentResult> {
  return createAppointment({
    clientId: input.clientId,
    serviceIds: input.serviceIds,
    startsAt: input.startsAt,
    actor: "ADMIN",
    bufferOverride: input.noBuffer ? 0 : undefined,
    ignoreWorkingHours: input.ignoreWorkingHours,
    now: input.now,
  });
}

/** Pausa dopo una modifica: 0 con "Senza pausa", altrimenti quella dell'appuntamento (o quella di default se era 0). */
function nextBuffer(current: number, noBuffer: boolean, defaultBuffer: number): number {
  if (noBuffer) return 0;
  return current > 0 ? current : defaultBuffer;
}

// ─────────────── Sposta ───────────────

export function rescheduleAppointment(input: {
  appointmentId: string;
  startsAt: Date;
  noBuffer: boolean;
  ignoreWorkingHours: boolean;
  now?: Date;
}): Promise<AgendaResult<{ previousStartsAt: Date; changed: boolean; dayChanged: boolean }>> {
  const now = input.now ?? new Date();
  if (!validDate(input.startsAt)) return Promise.resolve({ ok: false, error: "Orario non valido." });

  return locked<{ previousStartsAt: Date; changed: boolean; dayChanged: boolean }>(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, status: true, doneAt: true, startsAt: true, durationMin: true, bufferMin: true },
    });
    if (!appt) return { ok: false, error: NOT_FOUND };
    if (!canEdit(appt)) return { ok: false, error: NOT_EDITABLE };

    const settings = await loadSettings(tx);
    const bufferMin = nextBuffer(appt.bufferMin, input.noBuffer, settings.bufferMin);
    const problem = await checkStart(tx, {
      startsAt: input.startsAt,
      durationMin: appt.durationMin,
      bufferMin,
      settings,
      actor: "ADMIN",
      now,
      excludeAppointmentId: appt.id,
      ignoreWorkingHours: input.ignoreWorkingHours,
    });
    if (problem) return { ok: false, error: problem.error };

    const changed = appt.startsAt.getTime() !== input.startsAt.getTime() || appt.bufferMin !== bufferMin;
    const dayChanged = dayKeyOf(appt.startsAt) !== dayKeyOf(input.startsAt);
    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        startsAt: input.startsAt,
        endsAt: new Date(input.startsAt.getTime() + (appt.durationMin + bufferMin) * 60_000),
        bufferMin,
        // Nuovo giorno: il promemoria (email e spunta WhatsApp) riparte per la nuova data.
        ...(dayChanged ? { reminderEmailSentAt: null, whatsappSentAt: null } : {}),
      },
    });
    return { ok: true, previousStartsAt: appt.startsAt, changed, dayChanged };
  });
}

// ─────────────── Modifica servizi ───────────────

export function updateAppointmentServices(input: {
  appointmentId: string;
  serviceIds: string[];
  /** Voci di servizi non più in listino da tenere. */
  keepItemIds?: string[];
  noBuffer: boolean;
  ignoreWorkingHours: boolean;
  now?: Date;
}): Promise<AgendaResult<{ startsAt: Date; durationMin: number; totalPriceCents: number }>> {
  const now = input.now ?? new Date();
  return locked<{ startsAt: Date; durationMin: number; totalPriceCents: number }>(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true,
        status: true,
        doneAt: true,
        startsAt: true,
        bufferMin: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, serviceId: true, name: true, durationMin: true, priceCents: true, clientPackageId: true },
        },
      },
    });
    if (!appt) return { ok: false, error: NOT_FOUND };
    if (!canEdit(appt)) return { ok: false, error: NOT_EDITABLE };

    let services: { id: string; name: string; durationMin: number; priceCents: number }[] = [];
    if (input.serviceIds.length > 0) {
      const loaded = await loadServicesForBooking(input.serviceIds, "ADMIN", tx);
      if (!loaded.ok) return { ok: false, error: loaded.error };
      services = loaded.services;
    }
    const items = mergeItems(appt.items, services, input.keepItemIds ?? []);
    if (items.length === 0) return { ok: false, error: "Scegli almeno un servizio." };

    const settings = await loadSettings(tx);
    const durationMin = roundUpTo(
      items.reduce((sum, i) => sum + i.durationMin, 0),
      settings.durationRoundingMin,
    );
    const bufferMin = nextBuffer(appt.bufferMin, input.noBuffer, settings.bufferMin);
    if (durationMin <= 0) return { ok: false, error: "La durata dei servizi scelti è zero." };

    const problem = await checkStart(tx, {
      startsAt: appt.startsAt,
      durationMin,
      bufferMin,
      settings,
      actor: "ADMIN",
      now,
      excludeAppointmentId: appt.id,
      ignoreWorkingHours: input.ignoreWorkingHours,
    });
    if (problem) {
      return {
        ok: false,
        error:
          problem.code === "SLOT_UNAVAILABLE" && !input.ignoreWorkingHours
            ? "Con questi servizi l'appuntamento uscirebbe dall'orario di lavoro o finirebbe in un blocco. Attiva “Fuori orario” oppure spostalo."
            : problem.error,
      };
    }

    const totalPriceCents = items.reduce((sum, i) => sum + i.priceCents, 0);
    await tx.appointmentItem.deleteMany({ where: { appointmentId: appt.id } });
    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        durationMin,
        bufferMin,
        totalPriceCents,
        endsAt: new Date(appt.startsAt.getTime() + (durationMin + bufferMin) * 60_000),
        items: { create: items },
      },
    });
    return { ok: true, startsAt: appt.startsAt, durationMin, totalPriceCents };
  });
}

// ─────────────── Annulla ───────────────

/**
 * Annulla un appuntamento confermato. Se è già "Fatto" serve `confirmDone` (la conferma che l'admin
 * ha visto l'importo che sparisce): stato, doneAt e importo cambiano nella stessa transazione.
 */
export function cancelAppointment(input: {
  appointmentId: string;
  confirmDone?: boolean;
  now?: Date;
}): Promise<AgendaResult<{ startsAt: Date; removedAmountCents: number | null }>> {
  const now = input.now ?? new Date();
  return locked<{ startsAt: Date; removedAmountCents: number | null }>(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, status: true, doneAt: true, startsAt: true, amountCollectedCents: true },
    });
    if (!appt) return { ok: false, error: NOT_FOUND };
    if (!canCancel(appt)) return { ok: false, error: CANCEL_NOT_ALLOWED };
    // Segnato Fatto da un altro telefono dopo che la conferma era stata mostrata senza importo: si richiede di nuovo.
    if (appt.doneAt && !input.confirmDone) return { ok: false, error: CONFIRM_DONE_CANCEL };
    // Le sedute scalate tornano nei pacchetti.
    await tx.appointmentItem.updateMany({ where: { appointmentId: appt.id }, data: { clientPackageId: null } });
    await tx.appointment.update({
      where: { id: appt.id },
      data: { status: "CANCELLED", cancelledAt: now, cancelledBy: "ADMIN", doneAt: null, amountCollectedCents: null },
    });
    return { ok: true, startsAt: appt.startsAt, removedAmountCents: appt.doneAt ? appt.amountCollectedCents : null };
  });
}

// ─────────────── Fatto e importo incassato ───────────────

/**
 * Spunta "Fatto": salva doneAt e l'importo precompilato. Le voci coperte da UN SOLO pacchetto attivo della
 * cliente (con sedute rimaste) si scalano subito da quel pacchetto e l'importo le esclude; con più pacchetti
 * possibili si sceglie dopo (setItemPackage). Togliere la spunta azzera doneAt e importo e rimette le sedute.
 */
export function setDone(input: {
  appointmentId: string;
  done: boolean;
  now?: Date;
}): Promise<AgendaResult<{ amountCollectedCents: number | null; linkedItems: number }>> {
  const now = input.now ?? new Date();
  return locked<{ amountCollectedCents: number | null; linkedItems: number }>(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true,
        clientId: true,
        status: true,
        startsAt: true,
        doneAt: true,
        amountCollectedCents: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, priceCents: true, clientPackageId: true, serviceId: true, service: { select: { categoryId: true } } },
        },
      },
    });
    if (!appt) return { ok: false, error: NOT_FOUND };

    if (!input.done) {
      if (appt.doneAt) {
        await tx.appointmentItem.updateMany({ where: { appointmentId: appt.id }, data: { clientPackageId: null } });
        await tx.appointment.update({ where: { id: appt.id }, data: { doneAt: null, amountCollectedCents: null } });
      }
      return { ok: true, amountCollectedCents: null, linkedItems: 0 };
    }

    if (appt.status !== "CONFIRMED") return { ok: false, error: "Si può segnare come Fatto solo un appuntamento confermato." };
    if (appt.doneAt) {
      // doppio tocco
      return { ok: true, amountCollectedCents: appt.amountCollectedCents, linkedItems: appt.items.filter((i) => i.clientPackageId).length };
    }
    if (!canMarkOutcome(appt, now)) return { ok: false, error: TOO_EARLY };

    const offerItems = appt.items.map((i) => ({
      id: i.id,
      serviceId: i.serviceId,
      categoryId: i.service?.categoryId ?? null,
      clientPackageId: null,
    }));
    const packages = (await loadOfferPackages([appt.clientId], [appt.id], tx)).get(appt.clientId) ?? [];
    const links = defaultLinks(offerItems, packages);
    // Eventuali collegamenti rimasti da prima (non dovrebbero esserci) vengono sostituiti da quelli di adesso.
    await tx.appointmentItem.updateMany({ where: { appointmentId: appt.id }, data: { clientPackageId: null } });
    for (const [itemId, clientPackageId] of links) {
      await tx.appointmentItem.update({ where: { id: itemId }, data: { clientPackageId } });
    }
    const amountCollectedCents = collectableCents(appt.items.map((i) => ({ priceCents: i.priceCents, clientPackageId: links.get(i.id) ?? null })));
    await tx.appointment.update({ where: { id: appt.id }, data: { doneAt: now, amountCollectedCents } });
    return { ok: true, amountCollectedCents, linkedItems: links.size };
  });
}

export const PACKAGE_NOT_AVAILABLE = "Questo pacchetto non si può usare per questa voce (archiviato, sedute finite o servizio diverso).";

/**
 * "Scala dal pacchetto": collega (o scollega, con `clientPackageId` null) una voce di un appuntamento
 * Fatto a un pacchetto attivo della stessa cliente che la copre e ha ancora sedute. L'importo incassato
 * si ricalcola (vedi amountAfterPackageChange).
 */
export function setItemPackage(input: {
  appointmentId: string;
  itemId: string;
  clientPackageId: string | null;
}): Promise<AgendaResult<{ amountCollectedCents: number }>> {
  return locked<{ amountCollectedCents: number }>(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true,
        clientId: true,
        status: true,
        doneAt: true,
        amountCollectedCents: true,
        items: { select: { id: true, priceCents: true, clientPackageId: true, serviceId: true, service: { select: { categoryId: true } } } },
      },
    });
    if (!appt) return { ok: false, error: NOT_FOUND };
    if (appt.status !== "CONFIRMED" || !appt.doneAt) {
      return { ok: false, error: "Si può scalare da un pacchetto solo un appuntamento segnato come Fatto." };
    }
    const item = appt.items.find((i) => i.id === input.itemId);
    if (!item) return { ok: false, error: "Voce non trovata." };

    if (input.clientPackageId) {
      // Sedute rimaste senza le voci di questo appuntamento, meno quelle usate dalle ALTRE sue voci.
      const packages = (await loadOfferPackages([appt.clientId], [appt.id], tx)).get(appt.clientId) ?? [];
      const others = appt.items.filter((i) => i.id !== item.id);
      const adjusted = packages.map((p) => ({
        ...p,
        remainingSessions: p.remainingSessions - others.filter((o) => o.clientPackageId === p.id).length,
      }));
      const offer = itemOffers(
        [{ id: item.id, serviceId: item.serviceId, categoryId: item.service?.categoryId ?? null, clientPackageId: null }],
        adjusted,
      )[0];
      if (!offer?.packages.some((p) => p.id === input.clientPackageId)) return { ok: false, error: PACKAGE_NOT_AVAILABLE };
    }

    const before = collectableCents(appt.items);
    const after = collectableCents(appt.items.map((i) => (i.id === item.id ? { ...i, clientPackageId: input.clientPackageId } : i)));
    const amountCollectedCents = amountAfterPackageChange(appt.amountCollectedCents, before, after);
    await tx.appointmentItem.update({ where: { id: item.id }, data: { clientPackageId: input.clientPackageId } });
    await tx.appointment.update({ where: { id: appt.id }, data: { amountCollectedCents } });
    return { ok: true, amountCollectedCents };
  });
}

/** Corregge l'importo incassato (sconto o extra) di un appuntamento già Fatto. */
export function setAmountCollected(input: { appointmentId: string; cents: number }): Promise<AgendaResult> {
  if (!Number.isInteger(input.cents) || input.cents < 0 || input.cents > MAX_CENTS) {
    return Promise.resolve({ ok: false, error: "Importo non valido." });
  }
  return locked(async (tx) => {
    const updated = await tx.appointment.updateMany({
      where: { id: input.appointmentId, status: "CONFIRMED", doneAt: { not: null } },
      data: { amountCollectedCents: input.cents },
    });
    return updated.count === 1 ? { ok: true } : { ok: false, error: "L'appuntamento non è più segnato come Fatto." };
  });
}

// ─────────────── Non presentata ───────────────

export function setNoShow(input: { appointmentId: string; noShow: boolean; now?: Date }): Promise<AgendaResult> {
  const now = input.now ?? new Date();
  return locked(
    async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { id: true, status: true, doneAt: true, startsAt: true, endsAt: true },
      });
      if (!appt) return { ok: false, error: NOT_FOUND };

      if (input.noShow) {
        if (appt.status === "NO_SHOW") return { ok: true };
        if (!canEdit(appt)) return { ok: false, error: "Togli prima la spunta “Fatto”." };
        if (!canMarkOutcome(appt, now)) return { ok: false, error: TOO_EARLY };
        await tx.appointment.update({ where: { id: appt.id }, data: { status: "NO_SHOW" } });
        return { ok: true };
      }

      if (appt.status !== "NO_SHOW") return { ok: true };
      // Una "non presentata" non occupa il calendario: nel frattempo l'orario può essere stato preso.
      const other = await tx.appointment.findFirst({
        where: { status: "CONFIRMED", id: { not: appt.id }, startsAt: { lt: appt.endsAt }, endsAt: { gt: appt.startsAt } },
        select: { id: true },
      });
      if (other) return { ok: false, error: RESTORE_TAKEN };
      await tx.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRMED" } });
      return { ok: true };
    },
    RESTORE_TAKEN,
  );
}
