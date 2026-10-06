import { DateTime } from "luxon";
import { TIME_ZONE, type DayKey } from "@/lib/time/rome";

export type CalendarCell = { day: DayKey; n: number; available: boolean; today: boolean } | null;

export function monthOf(day: DayKey): string {
  return day.slice(0, 7);
}

export function addMonthsToMonth(month: string, n: number): string {
  return DateTime.fromISO(`${month}-01`, { zone: TIME_ZONE }).plus({ months: n }).toFormat("yyyy-LL");
}

/** Primo e ultimo giorno del mese "YYYY-MM". */
export function monthRange(month: string): { first: DayKey; last: DayKey } {
  const start = DateTime.fromISO(`${month}-01`, { zone: TIME_ZONE });
  return { first: start.toISODate()!, last: start.endOf("month").toISODate()! };
}

/** "ottobre 2026" */
export function formatMonth(month: string): string {
  return DateTime.fromISO(`${month}-01`, { zone: TIME_ZONE }).setLocale("it").toFormat("LLLL yyyy");
}

/** Griglia del mese a settimane che iniziano di lunedì (celle vuote prima del giorno 1). */
export function monthGrid(month: string, available: Set<DayKey>, today: DayKey): CalendarCell[] {
  const start = DateTime.fromISO(`${month}-01`, { zone: TIME_ZONE });
  const cells: CalendarCell[] = Array.from({ length: start.weekday - 1 }, () => null);
  for (let n = 1; n <= start.daysInMonth!; n++) {
    const day = start.set({ day: n }).toISODate()!;
    cells.push({ day, n, available: available.has(day), today: day === today });
  }
  return cells;
}
