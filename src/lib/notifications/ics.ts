import { brand } from "@/config/brand";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { myAppointmentsUrl, type AppointmentInfo, type BusinessInfo } from "./vars";

/**
 * File .ics (iCalendar, RFC 5545) da allegare alle email.
 * - Orari in UTC ("Z"): nessun problema col cambio d'ora, ogni calendario li mostra nell'ora locale.
 * - Fine = inizio + durata dei servizi, senza la pausa.
 * - UID fisso per appuntamento e SEQUENCE crescente: aprendo l'allegato di una modifica,
 *   il calendario aggiorna l'evento invece di crearne un secondo.
 */

const SEQUENCE_EPOCH = Date.UTC(2026, 0, 1);

/** Numero di versione crescente nel tempo (secondi dal 2026: sta in un intero a 32 bit per decenni). */
export function icsSequence(now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - SEQUENCE_EPOCH) / 1000));
}

/** 2026-10-14T08:30:00Z → "20261014T083000Z" */
export function icsDate(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Testo di una proprietà: \ ; , e a capo vanno protetti. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Righe di al massimo 75 byte (UTF-8), continuate con uno spazio, senza spezzare i caratteri accentati. */
export function icsFold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // le righe di continuazione iniziano con uno spazio
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function uidDomain(appUrl: string): string {
  try {
    return new URL(appUrl).hostname || "localhost";
  } catch {
    return "localhost";
  }
}

export function buildIcs(
  appointment: AppointmentInfo,
  business: BusinessInfo,
  { now, sequence = icsSequence(now) }: { now: Date; sequence?: number },
): string {
  const services = appointment.items.map((i) => i.name).join(", ");
  const end = new Date(appointment.startsAt.getTime() + appointment.durationMin * 60_000);
  const link = myAppointmentsUrl(business.appUrl);
  const description = [
    services,
    `Durata: ${formatDuration(appointment.durationMin)}`,
    `Totale: ${formatEuro(appointment.totalPriceCents)}`,
    `I miei appuntamenti: ${link}`,
  ].join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsEscape(brand.fullName)}//Prenotazioni//IT`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@${uidDomain(business.appUrl)}`,
    `DTSTAMP:${icsDate(now)}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${icsDate(appointment.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(`${brand.fullName} – ${services}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    ...(business.address ? [`LOCATION:${icsEscape(business.address)}`] : []),
    `URL:${link}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
