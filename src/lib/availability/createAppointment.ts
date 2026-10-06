import "server-only";
import { Prisma, type Settings } from "@prisma/client";
import type { Db } from "@/lib/schedule/queries";
import { dayKeyOf, formatDayShort, formatTime } from "@/lib/time/rome";
import { bookingDuration } from "./duration";
import { isSlotAvailable } from "./engine";
import { withBookingLock } from "./lock";
import { ADMIN_LIMITS, clientLimits, loadRangeContext, loadSettings } from "./queries";
import { loadServicesForBooking, type BookingActor } from "./services";

export const SLOT_TAKEN_MESSAGE = "Orario appena occupato, scegline un altro.";
export const SLOT_UNAVAILABLE_MESSAGE = "Questo orario non è prenotabile. Scegline un altro.";

export const OVERLAP_MESSAGE = "Si sovrappone a un altro appuntamento: scegli un altro orario.";
export const OUTSIDE_HOURS_MESSAGE =
  "Questo orario è fuori dall'orario di lavoro o in un blocco. Scegline uno libero oppure attiva “Fuori orario”.";

/** Passo minimo degli orari scritti a mano ("Fuori orario"). */
export const FREE_TIME_STEP_MIN = 5;

export type SlotProblemCode = "SLOT_TAKEN" | "SLOT_UNAVAILABLE";
export type SlotProblem = { code: SlotProblemCode; error: string };

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string; startsAt: Date; endsAt: Date; totalPriceCents: number }
  | { ok: false; code: "INVALID" | SlotProblemCode; error: string };

/** Violazione del vincolo EXCLUDE "Appointment_no_overlap" (Postgres 23P01). */
export function isOverlapError(error: unknown): boolean {
  const text = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value ?? ""));
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      text(error.meta).includes("23P01") ||
      text(error.meta).includes("Appointment_no_overlap") ||
      error.message.includes("23P01") ||
      error.message.includes("Appointment_no_overlap")
    );
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Error) {
    return error.message.includes("23P01") || error.message.includes("Appointment_no_overlap");
  }
  return false;
}

export type SlotCheck = {
  startsAt: Date;
  durationMin: number;
  bufferMin: number;
  settings: Pick<Settings, "slotGridMin" | "minNoticeMin" | "bookingHorizonMonths">;
  actor: BookingActor;
  now: Date;
  /** Appuntamento da ignorare (quello che si sta spostando o modificando). */
  excludeAppointmentId?: string;
  /** Solo admin: niente orario di lavoro, blocchi e griglia; restano vietate le sovrapposizioni. */
  ignoreWorkingHours?: boolean;
};

/** Appuntamento confermato che occuperebbe lo stesso intervallo (per dire all'admin con chi si scontra). */
async function findOverlap(tx: Db, check: SlotCheck) {
  const occupiedEnd = new Date(check.startsAt.getTime() + (check.durationMin + check.bufferMin) * 60_000);
  return tx.appointment.findFirst({
    where: {
      status: "CONFIRMED",
      startsAt: { lt: occupiedEnd },
      endsAt: { gt: check.startsAt },
      ...(check.excludeAppointmentId ? { id: { not: check.excludeAppointmentId } } : {}),
    },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, durationMin: true, client: { select: { firstName: true, lastName: true } } },
  });
}

function takenMessage(actor: BookingActor, other: Awaited<ReturnType<typeof findOverlap>>): string {
  if (actor === "CLIENT") return SLOT_TAKEN_MESSAGE;
  if (!other) return OVERLAP_MESSAGE;
  const end = new Date(other.startsAt.getTime() + other.durationMin * 60_000);
  return `Si sovrappone all'appuntamento di ${other.client.firstName} ${other.client.lastName} (${formatDayShort(
    dayKeyOf(other.startsAt),
  )}, ${formatTime(other.startsAt)}–${formatTime(end)}). Scegli un altro orario.`;
}

/**
 * Controlla un orario d'inizio con il motore delle disponibilità. Va chiamata dentro withBookingLock.
 * null = orario valido.
 */
export async function checkStart(tx: Db, check: SlotCheck): Promise<SlotProblem | null> {
  const { startsAt, actor } = check;
  if (check.ignoreWorkingHours) {
    if (actor !== "ADMIN") return { code: "SLOT_UNAVAILABLE", error: SLOT_UNAVAILABLE_MESSAGE };
    if (startsAt.getTime() % (FREE_TIME_STEP_MIN * 60_000) !== 0) {
      return { code: "SLOT_UNAVAILABLE", error: `Usa orari a passi di ${FREE_TIME_STEP_MIN} minuti.` };
    }
    const other = await findOverlap(tx, check);
    return other ? { code: "SLOT_TAKEN", error: takenMessage(actor, other) } : null;
  }

  const query = {
    durationMin: check.durationMin,
    bufferMin: check.bufferMin,
    gridMin: check.settings.slotGridMin,
    limits: actor === "CLIENT" ? clientLimits(check.settings, check.now) : ADMIN_LIMITS,
  };
  const day = dayKeyOf(startsAt);
  const ctx = await loadRangeContext(day, day, tx, check.excludeAppointmentId);
  const effective = ctx.days[0];
  if (isSlotAvailable(startsAt, effective, effective.blocks, ctx.appointments, query)) return null;

  // Distingue "preso da un altro appuntamento" da "mai stato prenotabile".
  if (isSlotAvailable(startsAt, effective, effective.blocks, [], query)) {
    return { code: "SLOT_TAKEN", error: takenMessage(actor, actor === "ADMIN" ? await findOverlap(tx, check) : null) };
  }
  return { code: "SLOT_UNAVAILABLE", error: actor === "ADMIN" ? OUTSIDE_HOURS_MESSAGE : SLOT_UNAVAILABLE_MESSAGE };
}

/**
 * Crea un appuntamento ricalcolando tutto dal database: servizi, durata, prezzo e disponibilità.
 * Non si fida di niente di quello che arriva dal browser, tranne gli id dei servizi e l'orario.
 *
 * Tutto avviene sotto pg_advisory_xact_lock: due prenotazioni simultanee passano una alla volta
 * e la seconda trova l'orario occupato. Il vincolo EXCLUDE del database resta l'ultima difesa.
 */
export async function createAppointment(input: {
  clientId: string;
  serviceIds: string[];
  startsAt: Date;
  actor: BookingActor;
  /** Solo admin: pausa diversa da quella di default (es. 0). */
  bufferOverride?: number;
  /** Solo admin: "Fuori orario di lavoro" (le sovrapposizioni restano vietate). */
  ignoreWorkingHours?: boolean;
  adminNotes?: string | null;
  now?: Date;
}): Promise<CreateAppointmentResult> {
  const { clientId, serviceIds, startsAt, actor, bufferOverride, adminNotes } = input;
  const now = input.now ?? new Date();

  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    return { ok: false, code: "INVALID", error: "Orario non valido." };
  }
  if (bufferOverride !== undefined) {
    if (actor !== "ADMIN") return { ok: false, code: "INVALID", error: "Pausa personalizzata non ammessa." };
    if (!Number.isInteger(bufferOverride) || bufferOverride < 0 || bufferOverride > 120) {
      return { ok: false, code: "INVALID", error: "Pausa non valida (da 0 a 120 minuti)." };
    }
  }
  if (input.ignoreWorkingHours && actor !== "ADMIN") {
    return { ok: false, code: "INVALID", error: "Orario fuori dall'orario di lavoro non ammesso." };
  }

  try {
    return await withBookingLock(async (tx): Promise<CreateAppointmentResult> => {
      const client = await tx.client.findUnique({ where: { id: clientId }, select: { id: true, blockedAt: true, anonymizedAt: true } });
      // Una cliente eliminata per la privacy resta solo per le statistiche.
      if (!client || client.anonymizedAt) return { ok: false, code: "INVALID", error: "Cliente non trovata." };
      if (actor === "CLIENT" && client.blockedAt) {
        return { ok: false, code: "INVALID", error: "Non è possibile prenotare online. Contatta Fabiana." };
      }

      const loaded = await loadServicesForBooking(serviceIds, actor, tx);
      if (!loaded.ok) return { ok: false, code: "INVALID", error: loaded.error };

      const settings = await loadSettings(tx);
      const { durationMin, bufferMin } = bookingDuration(
        loaded.services.map((s) => s.durationMin),
        settings.durationRoundingMin,
        bufferOverride ?? settings.bufferMin,
      );
      const problem = await checkStart(tx, {
        startsAt,
        durationMin,
        bufferMin,
        settings,
        actor,
        now,
        ignoreWorkingHours: input.ignoreWorkingHours,
      });
      if (problem) return { ok: false, ...problem };

      const endsAt = new Date(startsAt.getTime() + (durationMin + bufferMin) * 60_000);
      const totalPriceCents = loaded.services.reduce((sum, s) => sum + s.priceCents, 0);
      const appointment = await tx.appointment.create({
        data: {
          clientId,
          startsAt,
          endsAt,
          durationMin,
          bufferMin,
          totalPriceCents,
          createdBy: actor,
          adminNotes: actor === "ADMIN" ? (adminNotes ?? null) : null,
          items: {
            create: loaded.services.map((s, i) => ({
              serviceId: s.id,
              name: s.name,
              durationMin: s.durationMin,
              priceCents: s.priceCents,
              sortOrder: i,
            })),
          },
        },
        select: { id: true },
      });
      return { ok: true, appointmentId: appointment.id, startsAt, endsAt, totalPriceCents };
    });
  } catch (error) {
    if (isOverlapError(error)) {
      return { ok: false, code: "SLOT_TAKEN", error: actor === "ADMIN" ? OVERLAP_MESSAGE : SLOT_TAKEN_MESSAGE };
    }
    throw error;
  }
}
