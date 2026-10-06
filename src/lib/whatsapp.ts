/**
 * Link WhatsApp "click to chat" (wa.me): si aprono sul telefono con il testo già scritto.
 * Il numero va senza "+" né spazi.
 */
export function whatsappChatLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

/** Condivisione senza destinatario: WhatsApp chiede a chi mandarlo. */
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
