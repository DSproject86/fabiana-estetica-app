import "server-only";
import { composeAdminNewBooking, composeEmail, type EmailInput } from "./compose";
import { loadBusinessInfo, loadTemplate } from "./context";
import { deliverEmail, type DeliverResult } from "./deliver";
import { buildIcs } from "./ics";
import { SAMPLE_CODE, sampleAppointment } from "./vars";
import type { TemplateKind } from "./placeholders";

export type TestEmailKind = TemplateKind | "ADMIN_NEW_BOOKING";

export const TEST_EMAIL_KINDS: TestEmailKind[] = [
  "BOOKING_CONFIRMED",
  "REMINDER",
  "APPOINTMENT_CHANGED",
  "APPOINTMENT_CANCELLED",
  "LOGIN_CODE",
  "ADMIN_NEW_BOOKING",
];

/** Email di prova con i dati di esempio e il testo salvato, all'indirizzo dell'admin. */
export async function sendTestEmail(kind: TestEmailKind, to: string, now = new Date()): Promise<DeliverResult> {
  const business = await loadBusinessInfo();
  const appointment = sampleAppointment(now);

  let content;
  let withIcs = false;
  if (kind === "ADMIN_NEW_BOOKING") {
    content = composeAdminNewBooking(
      { ...appointment, client: { ...appointment.client, phone: "+393331234567", email: "giulia@example.com" } },
      business,
    );
  } else {
    const template = await loadTemplate(kind, "EMAIL");
    const input: EmailInput =
      kind === "LOGIN_CODE"
        ? { kind, client: appointment.client, code: SAMPLE_CODE }
        : kind === "APPOINTMENT_CHANGED"
          ? { kind, appointment, previousStartsAt: new Date(appointment.startsAt.getTime() - 86_400_000) }
          : { kind, appointment };
    content = composeEmail(input, template, business);
    withIcs = kind === "BOOKING_CONFIRMED" || kind === "APPOINTMENT_CHANGED";
  }

  return deliverEmail({
    kind,
    isTest: true,
    message: {
      to,
      ...content,
      subject: `[Prova] ${content.subject}`,
      ...(withIcs
        ? {
            attachments: [
              {
                filename: "appuntamento.ics",
                content: buildIcs({ ...appointment, id: `prova-${now.getTime()}` }, business, { now }),
                contentType: "text/calendar; charset=utf-8; method=PUBLISH",
              },
            ],
          }
        : {}),
    },
  });
}
