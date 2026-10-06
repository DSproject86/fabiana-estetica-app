/** Arrotonda per eccesso al multiplo di `step` (65, 30 → 90). */
export function roundUpTo(minutes: number, step: number): number {
  if (step <= 1) return minutes;
  return Math.ceil(minutes / step) * step;
}

export type BookingDuration = {
  /** Somma reale delle durate dei servizi. */
  rawMin: number;
  /** Durata usata per il calendario: somma arrotondata per eccesso. */
  durationMin: number;
  /** Pausa dopo il trattamento. */
  bufferMin: number;
};

export function bookingDuration(
  serviceDurations: number[],
  roundingMin: number,
  bufferMin: number,
): BookingDuration {
  const rawMin = serviceDurations.reduce((sum, d) => sum + d, 0);
  return { rawMin, durationMin: roundUpTo(rawMin, roundingMin), bufferMin };
}
