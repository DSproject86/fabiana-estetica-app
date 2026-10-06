/**
 * Limiti anti-abuso delle prenotazioni online (solo clienti; l'admin non ha limiti).
 * - al massimo 4 prenotazioni fatte nelle ultime 24 ore (anche se poi annullate);
 * - al massimo 6 appuntamenti confermati in programma.
 */
export const MAX_ONLINE_BOOKINGS_PER_DAY = 4;
export const MAX_FUTURE_APPOINTMENTS = 6;

export type BookingLimitCode = "limite-giorno" | "limite-futuri";

export const BOOKING_LIMIT_MESSAGES: Record<BookingLimitCode, string> = {
  "limite-giorno": `Hai già fatto ${MAX_ONLINE_BOOKINGS_PER_DAY} prenotazioni nelle ultime 24 ore. Per altri appuntamenti scrivi a Fabiana.`,
  "limite-futuri": `Hai già ${MAX_FUTURE_APPOINTMENTS} appuntamenti in programma. Per prenotarne altri scrivi a Fabiana.`,
};

export function bookingLimitProblem(counts: { recentBookings: number; futureAppointments: number }): BookingLimitCode | null {
  if (counts.futureAppointments >= MAX_FUTURE_APPOINTMENTS) return "limite-futuri";
  if (counts.recentBookings >= MAX_ONLINE_BOOKINGS_PER_DAY) return "limite-giorno";
  return null;
}
