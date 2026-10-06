import { formatPhone } from "@/lib/clients/phone";
import type { TemplateText } from "./defaults";
import { appointmentBox, renderEmail, type EmailContent } from "./emailLayout";
import { renderTemplate } from "./placeholders";
import {
  appointmentVars,
  formatDateTimeIt,
  loginCodeVars,
  myAppointmentsUrl,
  type AppointmentInfo,
  type BusinessInfo,
} from "./vars";

/** Cosa serve per scrivere ciascuna email. Modulo puro (invio, email di prova, anteprima). */
export type EmailInput =
  | { kind: "LOGIN_CODE"; client: { firstName: string; lastName: string }; code: string }
  | { kind: "BOOKING_CONFIRMED" | "REMINDER" | "APPOINTMENT_CANCELLED"; appointment: AppointmentInfo }
  | { kind: "APPOINTMENT_CHANGED"; appointment: AppointmentInfo; previousStartsAt?: Date | null };

const BOX_TITLE = {
  BOOKING_CONFIRMED: "Il tuo appuntamento",
  REMINDER: "Il tuo appuntamento di domani",
  APPOINTMENT_CHANGED: "Appuntamento aggiornato",
  APPOINTMENT_CANCELLED: "Appuntamento cancellato",
} as const;

export function composeEmail(input: EmailInput, template: TemplateText, business: BusinessInfo): EmailContent {
  if (input.kind === "LOGIN_CODE") {
    const vars = loginCodeVars(input.client, input.code, business.appUrl);
    return renderEmail({
      subject: renderTemplate(template.subject ?? "", vars),
      body: renderTemplate(template.body, vars),
      business,
    });
  }

  const vars = appointmentVars(input.appointment, business);
  const box = appointmentBox(input.appointment, {
    title: BOX_TITLE[input.kind],
    previousStartsAt: input.kind === "APPOINTMENT_CHANGED" ? (input.previousStartsAt ?? undefined) : undefined,
    cancelled: input.kind === "APPOINTMENT_CANCELLED",
  });
  return renderEmail({
    subject: renderTemplate(template.subject ?? "", vars),
    body: renderTemplate(template.body, vars),
    box,
    button: { label: "I miei appuntamenti", url: myAppointmentsUrl(business.appUrl) },
    business,
  });
}

export function composeWhatsapp(body: string, appointment: AppointmentInfo, business: BusinessInfo): string {
  return renderTemplate(body, appointmentVars(appointment, business));
}

/** Avviso agli admin per una prenotazione fatta da una cliente (testo fisso). */
export function composeAdminNewBooking(
  appointment: AppointmentInfo & { client: { phone: string; email: string | null } },
  business: BusinessInfo,
): EmailContent {
  const name = `${appointment.client.firstName} ${appointment.client.lastName}`;
  const box = appointmentBox(appointment, { title: name });
  box.rows.push({ label: "Cellulare", value: formatPhone(appointment.client.phone) });
  if (appointment.client.email) box.rows.push({ label: "Email", value: appointment.client.email });
  return renderEmail({
    subject: `Nuova prenotazione · ${name} · ${formatDateTimeIt(appointment.startsAt)}`,
    body: `${name} ha appena prenotato online per ${formatDateTimeIt(appointment.startsAt)}.`,
    box,
    button: { label: "Apri l'agenda", url: `${business.appUrl}/admin/agenda` },
    business,
  });
}
