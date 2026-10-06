import "server-only";
import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/db";
import { effectiveDay, type BlockRow, type EffectiveDay } from "@/lib/schedule/effective";
import { loadBlocks, loadOverrides, loadWeekly, type Db } from "@/lib/schedule/queries";
import { addDays, addMonths, dayBounds, todayKey, type DayKey } from "@/lib/time/rome";
import { availableDays, slotsForDay, type BookingLimits, type BusyAppointment, type SlotQuery } from "./engine";

export async function loadSettings(db: Db = prisma): Promise<Settings> {
  return db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** Limiti per le clienti: preavviso minimo e mesi prenotabili. */
export function clientLimits(settings: Pick<Settings, "minNoticeMin" | "bookingHorizonMonths">, now = new Date()): BookingLimits {
  return {
    earliestStart: new Date(now.getTime() + settings.minNoticeMin * 60_000),
    lastDay: addMonths(todayKey(now), settings.bookingHorizonMonths),
  };
}

/** L'admin non ha limiti di preavviso né di mesi. */
export const ADMIN_LIMITS: BookingLimits = { earliestStart: null, lastDay: null };

export type RangeContext = {
  days: EffectiveDay[];
  blocks: BlockRow[];
  appointments: BusyAppointment[];
};

/**
 * Tutto ciò che serve per calcolare la disponibilità di un intervallo di giorni
 * con 4 query in totale (non una per giorno).
 */
export async function loadRangeContext(fromDay: DayKey, toDay: DayKey, db: Db = prisma): Promise<RangeContext> {
  const rangeStart = dayBounds(fromDay).start;
  const rangeEnd = dayBounds(toDay).end;
  const [weekly, overrides, blocks, appointments] = await Promise.all([
    loadWeekly(db),
    loadOverrides(fromDay, toDay, db),
    loadBlocks(rangeStart, rangeEnd, db),
    db.appointment.findMany({
      where: { status: "CONFIRMED", startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      select: { startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const days: EffectiveDay[] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    days.push(effectiveDay(day, weekly, overrides, blocks));
  }
  return { days, blocks, appointments };
}

/** Restringe blocchi e appuntamenti a quelli che toccano un giorno (calcolo più leggero). */
function forDay(ctx: RangeContext, day: EffectiveDay) {
  const { start, end } = dayBounds(day.day);
  return {
    blocks: day.blocks,
    appointments: ctx.appointments.filter((a) => a.startsAt < end && a.endsAt > start),
  };
}

export type DaySlots = { day: EffectiveDay; slots: Date[] };

/** Orari liberi giorno per giorno. */
export function computeDailySlots(ctx: RangeContext, query: SlotQuery): DaySlots[] {
  return ctx.days.map((day) => {
    const { blocks, appointments } = forDay(ctx, day);
    return { day, slots: slotsForDay(day, blocks, appointments, query) };
  });
}

/** Giorni con almeno un orario libero (per disattivare i giorni pieni nel calendario). */
export function computeAvailableDays(ctx: RangeContext, query: SlotQuery): DayKey[] {
  return ctx.days.filter((day) => {
    const { blocks, appointments } = forDay(ctx, day);
    return availableDays([day], blocks, appointments, query).length > 0;
  }).map((d) => d.day);
}

export async function getDailySlots(fromDay: DayKey, count: number, query: SlotQuery, db: Db = prisma) {
  return computeDailySlots(await loadRangeContext(fromDay, addDays(fromDay, count - 1), db), query);
}

export async function getAvailableDays(fromDay: DayKey, toDay: DayKey, query: SlotQuery, db: Db = prisma) {
  return computeAvailableDays(await loadRangeContext(fromDay, toDay, db), query);
}
