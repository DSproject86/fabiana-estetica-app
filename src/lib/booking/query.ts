/** Indirizzo di /prenota con le scelte fatte (file senza dipendenze: lo usa anche il browser). */
export type BookingQueryParts = {
  services: string[];
  month: string | null; // "YYYY-MM"
  day: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  error: string | null;
};

export function bookingQuery(p: Partial<BookingQueryParts>): string {
  const q = new URLSearchParams();
  if (p.services?.length) q.set("s", p.services.join(","));
  if (p.month) q.set("mese", p.month);
  if (p.day) q.set("giorno", p.day);
  if (p.time) q.set("ora", p.time);
  if (p.error) q.set("errore", p.error);
  const text = q.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
  return text ? `?${text}` : "";
}
