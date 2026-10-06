import { DateTime } from "luxon";

/**
 * Tutti i calcoli di calendario si fanno nel fuso di Fabiana (Europe/Rome, ora legale compresa).
 *
 * - Un "giorno" è una stringa "YYYY-MM-DD" (data di calendario a Roma).
 * - Le fasce orarie sono minuti dalla mezzanotte, ora di Roma (540 = 09:00).
 * - Nel database gli istanti sono timestamptz (Date JS in UTC).
 *
 * Ore che non esistono (cambio di marzo, 02:00–02:59) vengono spostate in avanti di un'ora;
 * per quelle che esistono due volte (cambio di ottobre, 02:00–02:59) si usa la prima.
 * Gli orari di lavoro non toccano mai quella fascia notturna.
 */

export const TIME_ZONE = "Europe/Rome";

export type DayKey = string; // "YYYY-MM-DD"

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fromDayKey(day: DayKey): DateTime {
  const dt = DateTime.fromISO(day, { zone: TIME_ZONE });
  if (!DAY_KEY_RE.test(day) || !dt.isValid) throw new Error(`Data non valida: ${day}`);
  return dt.startOf("day");
}

export function isValidDayKey(value: string): boolean {
  return DAY_KEY_RE.test(value) && DateTime.fromISO(value, { zone: TIME_ZONE }).isValid;
}

/** Giorno di calendario a Roma di un istante (default: adesso). */
export function dayKeyOf(instant: Date = new Date()): DayKey {
  return DateTime.fromJSDate(instant, { zone: TIME_ZONE }).toISODate()!;
}

export function todayKey(now: Date = new Date()): DayKey {
  return dayKeyOf(now);
}

export function addDays(day: DayKey, days: number): DayKey {
  return fromDayKey(day).plus({ days }).toISODate()!;
}

/** Stesso giorno N mesi dopo (31 gen + 1 mese = 28/29 feb). */
export function addMonths(day: DayKey, months: number): DayKey {
  return fromDayKey(day).plus({ months }).toISODate()!;
}

/** 1 = lunedì … 7 = domenica */
export function weekdayOf(day: DayKey): number {
  return fromDayKey(day).weekday;
}

/** Istante corrispondente a "giorno + minuti dalla mezzanotte" ora di Roma (1440 = mezzanotte successiva). */
export function instantAt(day: DayKey, minuteOfDay: number): Date {
  if (minuteOfDay === 1440) return fromDayKey(addDays(day, 1)).toJSDate();
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const base = fromDayKey(day);
  return DateTime.fromObject(
    { year: base.year, month: base.month, day: base.day, hour, minute },
    { zone: TIME_ZONE },
  ).toJSDate();
}

/** Inizio e fine (esclusa) del giorno a Roma: durano 23 o 25 ore nei giorni del cambio d'ora. */
export function dayBounds(day: DayKey): { start: Date; end: Date } {
  return { start: fromDayKey(day).toJSDate(), end: fromDayKey(addDays(day, 1)).toJSDate() };
}

/** Minuti dalla mezzanotte (ora di Roma) di un istante. */
export function minuteOfDayOf(instant: Date): number {
  const dt = DateTime.fromJSDate(instant, { zone: TIME_ZONE });
  return dt.hour * 60 + dt.minute;
}

/** Colonne @db.Date: Prisma le legge/scrive come mezzanotte UTC. */
export function dayKeyToDbDate(day: DayKey): Date {
  fromDayKey(day);
  return new Date(`${day}T00:00:00.000Z`);
}

export function dbDateToDayKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

// ─────────────── Formattazione e lettura ───────────────

/** 570 → "09:30" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "9:30" / "09:30" → 570; null se non valido. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Ora di Roma di un istante: "09:30" */
export function formatTime(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: TIME_ZONE }).toFormat("HH:mm");
}

/** "lun 12 ott" */
export function formatDayShort(day: DayKey): string {
  return fromDayKey(day).setLocale("it").toFormat("ccc d LLL");
}

/** "lunedì 12 ottobre" */
export function formatDayLong(day: DayKey): string {
  return fromDayKey(day).setLocale("it").toFormat("cccc d LLLL");
}

export const WEEKDAY_NAMES = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
] as const;

export const WEEKDAY_SHORT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"] as const;
