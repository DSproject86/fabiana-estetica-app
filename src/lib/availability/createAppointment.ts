import "server-only";
import { Prisma } from "@prisma/client";
import { dayKeyOf } from "@/lib/time/rome";
import { bookingDuration } from "./duration";
import { isSlotAvailable } from "./engine";
import { withBookingLock } from "./lock";
import { ADMIN_LIMITS, clientLimits, loadRangeContext, loadSettings } from "./queries";
import { loadServicesForBooking, type BookingActor } from "./services";

export const SLOT_TAKEN_MESSAGE = "Orario appena occupato, scegline un altro.";
export const SLOT_UNAVAILABLE_MESSAGE = "Questo orario non è prenotabile. Scegline un altro.";

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string; startsAt: Date; endsAt: Date; totalPriceCents: number }
  | { ok: false; code: "INVALID" | "SLOT_TAKEN" | "SLOT_UNAVAILABLE"; error: string };

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

  try {
    return await withBookingLock(async (tx): Promise<CreateAppointmentResult> => {
      const client = await tx.client.findUnique({ where: { id: clientId }, select: { id: true, blockedAt: true } });
      if (!client) return { ok: false, code: "INVALID", error: "Cliente non trovata." };
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
      const query = {
        durationMin,
        bufferMin,
        gridMin: settings.slotGridMin,
        limits: actor === "CLIENT" ? clientLimits(settings, now) : ADMIN_LIMITS,
      };

      const day = dayKeyOf(startsAt);
      const ctx = await loadRangeContext(day, day, tx);
      const effective = ctx.days[0];
      if (!isSlotAvailable(startsAt, effective, effective.blocks, ctx.appointments, query)) {
        // Distingue "preso da un altro appuntamento" da "mai stato prenotabile".
        const freeWithoutAppointments = isSlotAvailable(startsAt, effective, effective.blocks, [], query);
        return freeWithoutAppointments
          ? { ok: false, code: "SLOT_TAKEN", error: SLOT_TAKEN_MESSAGE }
          : { ok: false, code: "SLOT_UNAVAILABLE", error: SLOT_UNAVAILABLE_MESSAGE };
      }

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
    if (isOverlapError(error)) return { ok: false, code: "SLOT_TAKEN", error: SLOT_TAKEN_MESSAGE };
    throw error;
  }
}
