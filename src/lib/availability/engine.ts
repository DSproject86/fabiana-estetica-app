/**
 * Motore delle disponibilità: funzioni pure, senza database (tutto in Europe/Rome).
 *
 * Per ogni fascia di lavoro gli inizi vanno dall'inizio della fascia ogni `gridMin` minuti.
 * Un inizio è valido se:
 *  a) [inizio, inizio+durata) sta tutto dentro la fascia (la pausa no: l'ultimo
 *     appuntamento può finire esattamente alla chiusura);
 *  b) [inizio, inizio+durata) non si sovrappone a nessun blocco;
 *  c) [inizio, inizio+durata+pausa) non si sovrappone a nessun appuntamento confermato
 *     (il loro endsAt include già la loro pausa): stessa regola del vincolo EXCLUDE '[)';
 *  d) inizio ≥ primo inizio ammesso (adesso + preavviso) e giorno ≤ ultimo giorno prenotabile.
 * Gli intervalli sono semiaperti: due intervalli che si toccano soltanto non si sovrappongono.
 */
import { overlaps, type BlockRow, type EffectiveDay } from "@/lib/schedule/effective";
import { instantAt, type DayKey } from "@/lib/time/rome";

const MINUTE = 60_000;

export type BusyAppointment = { startsAt: Date; endsAt: Date };

/** Limiti di tempo: null = nessun limite (prenotazioni inserite dall'admin). */
export type BookingLimits = {
  earliestStart: Date | null;
  lastDay: DayKey | null;
};

export type SlotQuery = {
  durationMin: number;
  bufferMin: number;
  gridMin: number;
  limits: BookingLimits;
};

/** Orari d'inizio validi in un giorno, in ordine. */
export function slotsForDay(
  day: Pick<EffectiveDay, "day" | "slots">,
  blocks: Pick<BlockRow, "startsAt" | "endsAt">[],
  appointments: BusyAppointment[],
  query: SlotQuery,
): Date[] {
  const { durationMin, bufferMin, gridMin, limits } = query;
  if (durationMin <= 0 || gridMin <= 0) return [];
  if (limits.lastDay && day.day > limits.lastDay) return [];

  const result: Date[] = [];
  for (const slot of day.slots) {
    const slotEnd = instantAt(day.day, slot.endMinute);
    for (let minute = slot.startMinute; minute < slot.endMinute; minute += gridMin) {
      const start = instantAt(day.day, minute);
      const treatmentEnd = new Date(start.getTime() + durationMin * MINUTE);
      if (treatmentEnd > slotEnd) break; // (a) i successivi finirebbero ancora più tardi
      if (limits.earliestStart && start < limits.earliestStart) continue; // (d)
      if (blocks.some((b) => overlaps(start, treatmentEnd, b.startsAt, b.endsAt))) continue; // (b)
      const occupiedEnd = new Date(treatmentEnd.getTime() + bufferMin * MINUTE);
      if (appointments.some((a) => overlaps(start, occupiedEnd, a.startsAt, a.endsAt))) continue; // (c)
      result.push(start);
    }
  }
  return result;
}

/** true se `startsAt` è uno degli orari validi di quel giorno. */
export function isSlotAvailable(
  startsAt: Date,
  day: Pick<EffectiveDay, "day" | "slots">,
  blocks: Pick<BlockRow, "startsAt" | "endsAt">[],
  appointments: BusyAppointment[],
  query: SlotQuery,
): boolean {
  return slotsForDay(day, blocks, appointments, query).some((s) => s.getTime() === startsAt.getTime());
}

/** Giorni (tra quelli dati) con almeno un orario libero. */
export function availableDays(
  days: Pick<EffectiveDay, "day" | "slots">[],
  blocks: Pick<BlockRow, "startsAt" | "endsAt">[],
  appointments: BusyAppointment[],
  query: SlotQuery,
): DayKey[] {
  return days.filter((d) => slotsForDay(d, blocks, appointments, query).length > 0).map((d) => d.day);
}
