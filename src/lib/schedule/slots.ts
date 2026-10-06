import { minutesToTime } from "@/lib/time/rome";

/** Fascia oraria in minuti dalla mezzanotte, ora di Roma. Fine esclusa. */
export type Slot = { startMinute: number; endMinute: number };

export const MAX_SLOTS_PER_DAY = 6;
export const SLOT_STEP_MINUTES = 5;

export function sortSlots<T extends Slot>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.startMinute - b.startMinute);
}

/** Controlla un insieme di fasce dello stesso giorno. Restituisce il primo errore oppure null. */
export function validateSlots(slots: Slot[]): string | null {
  if (slots.length > MAX_SLOTS_PER_DAY) {
    return `Al massimo ${MAX_SLOTS_PER_DAY} fasce per giorno.`;
  }
  for (const s of slots) {
    if (s.startMinute < 0 || s.endMinute > 1440) return "Orario fuori dalla giornata.";
    if (s.startMinute % SLOT_STEP_MINUTES || s.endMinute % SLOT_STEP_MINUTES) {
      return `Usa orari a passi di ${SLOT_STEP_MINUTES} minuti (es. 9:00, 9:05, 9:10…).`;
    }
    if (s.endMinute <= s.startMinute) {
      return `La fascia ${minutesToTime(s.startMinute)}–${minutesToTime(s.endMinute)} finisce prima di iniziare.`;
    }
  }
  const sorted = sortSlots(slots);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.startMinute < prev.endMinute) {
      return `Le fasce ${formatSlot(prev)} e ${formatSlot(cur)} si sovrappongono.`;
    }
  }
  return null;
}

export function formatSlot(slot: Slot): string {
  return `${minutesToTime(slot.startMinute)}–${minutesToTime(slot.endMinute)}`;
}

export function formatSlots(slots: Slot[]): string {
  return sortSlots(slots).map(formatSlot).join(", ");
}
