import "server-only";
import { whatsappChatLink } from "@/lib/whatsapp";
import { composeWhatsapp } from "./compose";
import { loadBusinessInfo, loadTemplate } from "./context";
import type { AppointmentInfo } from "./vars";

export type WhatsappKind = "BOOKING_CONFIRMED" | "REMINDER";

/**
 * Prepara i link wa.me con i testi dei template WHATSAPP (caricati una volta per pagina).
 * L'invio resta manuale: il link apre WhatsApp col testo già scritto.
 */
export async function loadWhatsappLinkBuilder() {
  const [business, confirm, reminder] = await Promise.all([
    loadBusinessInfo(),
    loadTemplate("BOOKING_CONFIRMED", "WHATSAPP"),
    loadTemplate("REMINDER", "WHATSAPP"),
  ]);
  const bodies: Record<WhatsappKind, string> = { BOOKING_CONFIRMED: confirm.body, REMINDER: reminder.body };
  return (kind: WhatsappKind, appointment: AppointmentInfo & { client: { phone: string } }) =>
    whatsappChatLink(appointment.client.phone, composeWhatsapp(bodies[kind], appointment, business));
}
