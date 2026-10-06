import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { addDays, dayKeyOf, formatDayLong, formatTime, instantAt } from "@/lib/time/rome";
import type { TemplateVars } from "./placeholders";

/** Quello che serve di un appuntamento per scrivere email, WhatsApp e .ics. */
export type AppointmentInfo = {
  id: string;
  startsAt: Date;
  durationMin: number; // senza pausa
  totalPriceCents: number;
  items: { name: string }[];
  client: { firstName: string; lastName: string };
};

export type BusinessInfo = {
  address: string | null;
  whatsapp: string | null; // +39…
  replyTo: string | null;
  appUrl: string; // senza "/" finale
};

/** "martedì 14 ottobre" */
export function formatDateIt(instant: Date): string {
  return formatDayLong(dayKeyOf(instant));
}

/** "martedì 14 ottobre alle 10:30" */
export function formatDateTimeIt(instant: Date): string {
  return `${formatDateIt(instant)} alle ${formatTime(instant)}`;
}

export const myAppointmentsUrl = (appUrl: string) => `${appUrl}/appuntamenti`;

export function appointmentVars(appointment: AppointmentInfo, business: BusinessInfo): TemplateVars {
  return {
    nome: appointment.client.firstName,
    cognome: appointment.client.lastName,
    data: formatDateIt(appointment.startsAt),
    ora: formatTime(appointment.startsAt),
    servizi: appointment.items.map((i) => i.name).join(", "),
    durata: formatDuration(appointment.durationMin),
    totale: formatEuro(appointment.totalPriceCents),
    indirizzo: business.address ?? "",
    link: myAppointmentsUrl(business.appUrl),
  };
}

export function loginCodeVars(client: { firstName: string; lastName: string }, code: string, appUrl: string): TemplateVars {
  return { nome: client.firstName, cognome: client.lastName, codice: code, link: myAppointmentsUrl(appUrl) };
}

/** Dati di esempio per anteprima ed email di prova: dopodomani alle 10:30. */
export function sampleAppointment(now = new Date()): AppointmentInfo {
  return {
    id: "esempio",
    startsAt: instantAt(addDays(dayKeyOf(now), 2), 10 * 60 + 30),
    durationMin: 90,
    totalPriceCents: 6500,
    items: [{ name: "Pulizia viso" }, { name: "Manicure" }],
    client: { firstName: "Giulia", lastName: "Bianchi" },
  };
}

export const SAMPLE_CODE = "482913";
