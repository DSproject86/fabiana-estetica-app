import { timeToMinutes } from "@/lib/time/rome";
import { validateSlots, type Slot } from "./slots";
import type { ConflictItem } from "./queries";

export type OrariFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Appuntamenti toccati dalla modifica: si salva solo dopo conferma. */
  conflicts?: ConflictItem[];
};

/** Legge le fasce da campi ripetuti "start"/"end" (ignorando le righe del tutto vuote). */
export function slotsFromForm(formData: FormData): { slots: Slot[] } | { error: string } {
  const starts = formData.getAll("start").map(String);
  const ends = formData.getAll("end").map(String);
  const slots: Slot[] = [];
  for (let i = 0; i < Math.max(starts.length, ends.length); i++) {
    const s = (starts[i] ?? "").trim();
    const e = (ends[i] ?? "").trim();
    if (!s && !e) continue;
    const startMinute = timeToMinutes(s);
    const endMinute = timeToMinutes(e);
    if (startMinute === null || endMinute === null) {
      return { error: "Completa ogni fascia con orario di inizio e di fine." };
    }
    slots.push({ startMinute, endMinute });
  }
  const error = validateSlots(slots);
  return error ? { error } : { slots };
}

export function isConfirmed(formData: FormData): boolean {
  return formData.get("confirm") === "1";
}
