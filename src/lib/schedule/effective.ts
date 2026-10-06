import { dayBounds, dayKeyOf, instantAt, weekdayOf, type DayKey } from "@/lib/time/rome";
import { sortSlots, type Slot } from "./slots";

export type WeeklySlotRow = Slot & { weekday: number };
export type OverrideRow = { id: string; day: DayKey; closed: boolean; note: string | null; slots: Slot[] };
export type BlockRow = { id: string; startsAt: Date; endsAt: Date; reason: string | null };

export type EffectiveDay = {
  day: DayKey;
  /** Da dove viene l'orario: settimana tipo o eccezione su questa data. */
  source: "weekly" | "exception";
  exception: { id: string; note: string | null } | null;
  /** Fasce di lavoro (ora di Roma); vuoto = chiuso. */
  slots: Slot[];
  /** Le stesse fasce come istanti. */
  intervals: { start: Date; end: Date }[];
  /** Blocchi che toccano questo giorno. */
  blocks: BlockRow[];
};

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Fasce che valgono in un certo giorno: eccezione se c'è, altrimenti settimana tipo. */
export function slotsForDay(
  day: DayKey,
  weekly: WeeklySlotRow[],
  override: OverrideRow | undefined,
): { source: "weekly" | "exception"; slots: Slot[] } {
  if (override) {
    return { source: "exception", slots: override.closed ? [] : sortSlots(override.slots) };
  }
  const weekday = weekdayOf(day);
  return {
    source: "weekly",
    slots: sortSlots(weekly.filter((w) => w.weekday === weekday)).map(({ startMinute, endMinute }) => ({
      startMinute,
      endMinute,
    })),
  };
}

/** Orario effettivo di un giorno: settimana tipo + eccezione + blocchi. */
export function effectiveDay(
  day: DayKey,
  weekly: WeeklySlotRow[],
  overrides: OverrideRow[],
  blocks: BlockRow[],
): EffectiveDay {
  const override = overrides.find((o) => o.day === day);
  const { source, slots } = slotsForDay(day, weekly, override);
  const { start, end } = dayBounds(day);
  return {
    day,
    source,
    exception: override ? { id: override.id, note: override.note } : null,
    slots,
    intervals: slots.map((s) => ({ start: instantAt(day, s.startMinute), end: instantAt(day, s.endMinute) })),
    blocks: blocks
      .filter((b) => overlaps(b.startsAt, b.endsAt, start, end))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
  };
}

// ─────────────── Conflitti con appuntamenti già presi ───────────────

export type AppointmentForCheck = {
  id: string;
  startsAt: Date;
  /** Durata del trattamento (già arrotondata), senza pausa. */
  durationMin: number;
};

/** Fine del trattamento senza la pausa: è quella che deve stare dentro l'orario di lavoro. */
export function treatmentEnd(a: AppointmentForCheck): Date {
  return new Date(a.startsAt.getTime() + a.durationMin * 60_000);
}

/** true se il trattamento sta per intero dentro una delle fasce del suo giorno. */
export function fitsInSlots(a: AppointmentForCheck, slots: Slot[]): boolean {
  const day = dayKeyOf(a.startsAt);
  const end = treatmentEnd(a);
  return slots.some((s) => a.startsAt >= instantAt(day, s.startMinute) && end <= instantAt(day, s.endMinute));
}

/** Appuntamenti che resterebbero fuori orario se quel giorno valessero queste fasce. */
export function appointmentsOutsideSlots<T extends AppointmentForCheck>(appointments: T[], slots: Slot[]): T[] {
  return appointments.filter((a) => !fitsInSlots(a, slots));
}

/** Appuntamenti il cui trattamento si sovrappone a un blocco. */
export function appointmentsInBlock<T extends AppointmentForCheck>(
  appointments: T[],
  block: { startsAt: Date; endsAt: Date },
): T[] {
  return appointments.filter((a) => overlaps(a.startsAt, treatmentEnd(a), block.startsAt, block.endsAt));
}
