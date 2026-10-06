import "server-only";
import { whatsappChatLink } from "@/lib/whatsapp";
import { composeWhatsapp } from "./compose";
import { loadBusinessInfo, loadTemplate } from "./context";
import type { AppointmentInfo } from "./vars";

export type WhatsappKind = "BOOKING_CONFIRMED" | "REMINDER" | "APPOINTMENT_CHANGED" | "APPOINTMENT_CANCELLED";

/**
 * Prepara i link wa.me con i testi dei template WHATSAPP (caricati una volta per pagina).
 * L'invio resta manuale: il link apre WhatsApp col testo già scritto.
 */
export async function loadWhatsappLinkBuilder() {
  const [business, confirm, reminder, changed, cancelled] = await Promise.all([
    loadBusinessInfo(),
    loadTemplate("BOOKING_CONFIRMED", "WHATSAPP"),
    loadTemplate("REMINDER", "WHATSAPP"),
    loadTemplate("APPOINTMENT_CHANGED", "WHATSAPP"),
    loadTemplate("APPOINTMENT_CANCELLED", "WHATSAPP"),
  ]);
  const bodies: Record<WhatsappKind, string> = {
    BOOKING_CONFIRMED: confirm.body,
    REMINDER: reminder.body,
    APPOINTMENT_CHANGED: changed.body,
    APPOINTMENT_CANCELLED: cancelled.body,
  };
  return (kind: WhatsappKind, appointment: AppointmentInfo & { client: { phone: string } }) =>
    whatsappChatLink(appointment.client.phone, composeWhatsapp(bodies[kind], appointment, business));
}
