import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addDays,
  dayBounds,
  dayKeyOf,
  dayKeyToDbDate,
  dbDateToDayKey,
  formatDayShort,
  formatTime,
  weekdayOf,
  type DayKey,
} from "@/lib/time/rome";
import {
  appointmentsInBlock,
  appointmentsOutsideSlots,
  effectiveDay,
  treatmentEnd,
  type BlockRow,
  type EffectiveDay,
  type OverrideRow,
  type WeeklySlotRow,
} from "./effective";
import type { Slot } from "./slots";

/** Client Prisma normale o di una transazione (per lavorare sotto il lock delle prenotazioni). */
export type Db = Prisma.TransactionClient;

export async function loadWeekly(db: Db = prisma): Promise<WeeklySlotRow[]> {
  return db.weeklySlot.findMany({
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    select: { weekday: true, startMinute: true, endMinute: true },
  });
}

export async function loadOverrides(fromDay: DayKey, toDay?: DayKey, db: Db = prisma): Promise<OverrideRow[]> {
  const rows = await db.dateOverride.findMany({
    where: {
      date: { gte: dayKeyToDbDate(fromDay), ...(toDay ? { lte: dayKeyToDbDate(toDay) } : {}) },
    },
    orderBy: { date: "asc" },
    include: { slots: { orderBy: { startMinute: "asc" } } },
  });
  return rows.map((r) => ({
    id: r.id,
    day: dbDateToDayKey(r.date),
    closed: r.closed,
    note: r.note,
    slots: r.slots.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })),
  }));
}

export async function loadBlocks(from: Date, to?: Date, db: Db = prisma): Promise<BlockRow[]> {
  return db.timeBlock.findMany({
    where: { endsAt: { gt: from }, ...(to ? { startsAt: { lt: to } } : {}) },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, reason: true },
  });
}

/** Orario effettivo dei prossimi `count` giorni a partire da `fromDay`. */
export async function loadEffectiveDays(fromDay: DayKey, count: number): Promise<EffectiveDay[]> {
  const lastDay = addDays(fromDay, count - 1);
  const [weekly, overrides, blocks] = await Promise.all([
    loadWeekly(),
    loadOverrides(fromDay, lastDay),
    loadBlocks(dayBounds(fromDay).start, dayBounds(lastDay).end),
  ]);
  return Array.from({ length: count }, (_, i) => effectiveDay(addDays(fromDay, i), weekly, overrides, blocks));
}

// ─────────────── Conflitti ───────────────

export type ConflictItem = { id: string; when: string; client: string; services: string };

const appointmentSelect = {
  id: true,
  startsAt: true,
  durationMin: true,
  client: { select: { firstName: true, lastName: true } },
  items: { select: { name: true }, orderBy: { sortOrder: "asc" as const } },
};

type AppointmentRow = {
  id: string;
  startsAt: Date;
  durationMin: number;
  client: { firstName: string; lastName: string };
  items: { name: string }[];
};

function toConflictItems(rows: AppointmentRow[]): ConflictItem[] {
  return rows
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((a) => ({
      id: a.id,
      when: `${formatDayShort(dayKeyOf(a.startsAt))}, ${formatTime(a.startsAt)}–${formatTime(treatmentEnd(a))}`,
      client: `${a.client.firstName} ${a.client.lastName}`,
      services: a.items.map((i) => i.name).join(", "),
    }));
}

/** Appuntamenti confermati di un giorno che non starebbero nelle nuove fasce. */
export async function conflictsForDay(day: DayKey, slots: Slot[], db: Db = prisma): Promise<ConflictItem[]> {
  const { start, end } = dayBounds(day);
  const rows = await db.appointment.findMany({
    where: { status: "CONFIRMED", startsAt: { gte: start, lt: end } },
    select: appointmentSelect,
  });
  return toConflictItems(appointmentsOutsideSlots(rows, slots));
}

/** Appuntamenti confermati il cui trattamento cade nel blocco. */
export async function conflictsForBlock(startsAt: Date, endsAt: Date, db: Db = prisma): Promise<ConflictItem[]> {
  const rows = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: appointmentSelect,
  });
  return toConflictItems(appointmentsInBlock(rows, { startsAt, endsAt }));
}

/**
 * Appuntamenti futuri nei giorni della settimana indicati (senza eccezione su quella data)
 * che resterebbero fuori dalle nuove fasce della settimana tipo.
 */
export async function conflictsForWeekdays(
  weekdays: number[],
  slots: Slot[],
  db: Db = prisma,
): Promise<ConflictItem[]> {
  const now = new Date();
  const rows = await db.appointment.findMany({
    where: { status: "CONFIRMED", startsAt: { gte: now } },
    select: appointmentSelect,
  });
  const candidates = rows.filter((a) => weekdays.includes(weekdayOf(dayKeyOf(a.startsAt))));
  if (candidates.length === 0) return [];

  const overrides = await loadOverrides(dayKeyOf(now), undefined, db);
  const exceptionDays = new Set(overrides.map((o) => o.day));
  const affected = candidates.filter((a) => !exceptionDays.has(dayKeyOf(a.startsAt)));
  return toConflictItems(appointmentsOutsideSlots(affected, slots));
}
