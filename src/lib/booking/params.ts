import { BOOKING_LIMIT_MESSAGES } from "./abuseLimits";
import { isValidDayKey, minutesToTime, timeToMinutes, type DayKey } from "@/lib/time/rome";
import type { BookingQueryParts } from "./query";

export { bookingQuery } from "./query";

/**
 * Stato della prenotazione nell'indirizzo della pagina (/prenota?s=…&mese=…&giorno=…&ora=…),
 * così il tasto "indietro" e il ritorno dal riepilogo non perdono niente.
 */
export type BookingParams = BookingQueryParts & {
  day: DayKey | null;
  error: BookingErrorCode | null;
};

export const BOOKING_ERRORS = {
  ...BOOKING_LIMIT_MESSAGES,
  preso: "Orario appena occupato, scegline un altro.",
  "non-prenotabile": "Questo orario non è prenotabile. Scegline un altro.",
  servizi: "Qualcosa non torna nella prenotazione: controlla i servizi scelti e riprova.",
} as const;

export type BookingErrorCode = keyof typeof BOOKING_ERRORS;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseServiceIds(value: string): string[] {
  const ids = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\w-]{1,40}$/.test(s));
  return [...new Set(ids)].slice(0, 30); // il limite vero (10) lo controlla il server con un messaggio
}

/** "9:30" o "09:30" → "09:30"; null se non è un'ora valida. */
export function parseTime(value: string): string | null {
  const minutes = timeToMinutes(value);
  return minutes === null ? null : minutesToTime(minutes);
}

export function parseBookingParams(raw: RawParams): BookingParams {
  const month = first(raw.mese);
  const day = first(raw.giorno);
  const error = first(raw.errore);
  return {
    services: parseServiceIds(first(raw.s)),
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
    day: isValidDayKey(day) ? day : null,
    time: parseTime(first(raw.ora)),
    error: error in BOOKING_ERRORS ? (error as BookingErrorCode) : null,
  };
}
