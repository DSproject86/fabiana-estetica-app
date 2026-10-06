import "server-only";
import { prisma } from "@/lib/db";
import { bookingDuration, type BookingDuration } from "@/lib/availability/duration";
import { clientLimits, getDailySlots, loadSettings } from "@/lib/availability/queries";
import { loadServicesForBooking, type BookableService } from "@/lib/availability/services";
import { instantAt, timeToMinutes, type DayKey } from "@/lib/time/rome";
import type { BookingErrorCode } from "./params";

/** Servizi visibili alle clienti (attivi, in categorie attive), per categoria. */
export async function loadBookingCatalog() {
  return prisma.serviceCategory.findMany({
    where: { active: true, services: { some: { active: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      services: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, description: true, durationMin: true, priceCents: true },
      },
    },
  });
}

export type CheckedBooking = {
  services: BookableService[];
  duration: BookingDuration;
  totalCents: number;
  startsAt: Date;
};

/**
 * Controllo per il riepilogo: servizi prenotabili e orario ancora libero, con le regole delle clienti.
 * (La conferma rifà comunque tutto dentro createAppointment, sotto lock.)
 */
export async function checkBooking(
  serviceIds: string[],
  day: DayKey,
  time: string,
  now = new Date(),
): Promise<{ ok: true; booking: CheckedBooking } | { ok: false; error: BookingErrorCode }> {
  const loaded = await loadServicesForBooking(serviceIds, "CLIENT");
  if (!loaded.ok) return { ok: false, error: "servizi" };

  const minutes = timeToMinutes(time);
  if (minutes === null) return { ok: false, error: "non-prenotabile" };
  const startsAt = instantAt(day, minutes);

  const settings = await loadSettings();
  const duration = bookingDuration(loaded.services.map((s) => s.durationMin), settings.durationRoundingMin, settings.bufferMin);
  const [{ slots }] = await getDailySlots(day, 1, {
    durationMin: duration.durationMin,
    bufferMin: duration.bufferMin,
    gridMin: settings.slotGridMin,
    limits: clientLimits(settings, now),
  });
  if (!slots.some((s) => s.getTime() === startsAt.getTime())) {
    return { ok: false, error: "preso" };
  }

  return {
    ok: true,
    booking: {
      services: loaded.services,
      duration,
      totalCents: loaded.services.reduce((sum, s) => sum + s.priceCents, 0),
      startsAt,
    },
  };
}
