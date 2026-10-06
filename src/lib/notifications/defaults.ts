import type { Channel } from "@prisma/client";
import type { TemplateKind } from "./placeholders";

/**
 * Testi predefiniti dei messaggi. Li usano il seed, "Ripristina testo predefinito" e,
 * se un template mancasse nel database, l'invio.
 *
 * Nelle email i dettagli (data, ora, servizi, durata, totale) stanno già nel riquadro
 * automatico sotto il testo, quindi qui non vanno ripetuti tutti.
 */

export type TemplateText = { subject: string | null; body: string };
export type TemplateKey = `${TemplateKind}:${Channel}`;

export const templateKey = (kind: TemplateKind, channel: Channel): TemplateKey => `${kind}:${channel}`;

export const DEFAULT_TEMPLATES: Record<TemplateKey, TemplateText | undefined> = {
  "LOGIN_CODE:EMAIL": {
    subject: "Il tuo codice di accesso: {codice}",
    body: "Ciao {nome},\n\nil tuo codice per accedere è: {codice}\n\nVale 10 minuti. Se non l'hai richiesto tu, ignora questa email.\n\nFabiana",
  },
  "BOOKING_CONFIRMED:EMAIL": {
    subject: "Appuntamento confermato · {data} alle {ora}",
    body: "Ciao {nome},\n\ngrazie per aver prenotato! Il tuo appuntamento è confermato: qui sotto trovi i dettagli e, in allegato, l'evento da aggiungere al calendario.\n\nSe hai un imprevisto, rispondi a questa email o scrivimi su WhatsApp.\n\nA presto!\nFabiana",
  },
  "REMINDER:EMAIL": {
    subject: "Promemoria: domani alle {ora}",
    body: "Ciao {nome},\n\nti ricordo l'appuntamento di domani, {data} alle {ora}.\n\nSe hai un imprevisto, scrivimi appena puoi.\n\nA domani!\nFabiana",
  },
  "APPOINTMENT_CHANGED:EMAIL": {
    subject: "Appuntamento modificato · {data} alle {ora}",
    body: "Ciao {nome},\n\nil tuo appuntamento è stato modificato: qui sotto trovi i dettagli aggiornati e, in allegato, l'evento aggiornato per il calendario.\n\nPer qualsiasi dubbio scrivimi.\n\nFabiana",
  },
  "APPOINTMENT_CANCELLED:EMAIL": {
    subject: "Appuntamento cancellato · {data}",
    body: "Ciao {nome},\n\nl'appuntamento di {data} alle {ora} è stato cancellato.\n\nSe vuoi fissarne un altro, puoi prenotare dall'app quando vuoi.\n\nFabiana",
  },
  "LOGIN_CODE:WHATSAPP": undefined, // il codice viaggia solo per email
  "BOOKING_CONFIRMED:WHATSAPP": {
    subject: null,
    body: "Ciao {nome}! Ti confermo l'appuntamento di {data} alle {ora} ({servizi}). Totale {totale}. A presto! Fabiana",
  },
  "REMINDER:WHATSAPP": {
    subject: null,
    body: "Ciao {nome}! Ti ricordo l'appuntamento di domani, {data} alle {ora} ({servizi}). Se hai un imprevisto scrivimi. A domani! Fabiana",
  },
  "APPOINTMENT_CHANGED:WHATSAPP": {
    subject: null,
    body: "Ciao {nome}! Il tuo appuntamento è stato spostato a {data} alle {ora} ({servizi}). Fammi sapere se va bene. Fabiana",
  },
  "APPOINTMENT_CANCELLED:WHATSAPP": {
    subject: null,
    body: "Ciao {nome}, l'appuntamento di {data} alle {ora} è stato cancellato. Scrivimi se vuoi fissarne un altro. Fabiana",
  },
};

export type TemplateMeta = { kind: TemplateKind; channel: Channel; slug: string; label: string; hint: string };

/** Ordine, indirizzo della pagina e nomi mostrati in Impostazioni → Messaggi. */
export const TEMPLATE_LIST: TemplateMeta[] = [
  { kind: "BOOKING_CONFIRMED", channel: "EMAIL", slug: "conferma-email", label: "Conferma prenotazione", hint: "Parte subito dopo una prenotazione, con l'evento per il calendario." },
  { kind: "REMINDER", channel: "EMAIL", slug: "promemoria-email", label: "Promemoria del giorno prima", hint: "Parte il giorno prima, all'ora del promemoria." },
  { kind: "APPOINTMENT_CHANGED", channel: "EMAIL", slug: "modifica-email", label: "Appuntamento modificato", hint: "Quando sposti o modifichi un appuntamento, con l'evento aggiornato." },
  { kind: "APPOINTMENT_CANCELLED", channel: "EMAIL", slug: "cancellazione-email", label: "Appuntamento cancellato", hint: "Quando cancelli un appuntamento." },
  { kind: "LOGIN_CODE", channel: "EMAIL", slug: "codice-email", label: "Codice di accesso", hint: "Il codice di 6 cifre per entrare nell'app. Deve contenere {codice}." },
  { kind: "BOOKING_CONFIRMED", channel: "WHATSAPP", slug: "conferma-whatsapp", label: "Conferma", hint: "Pulsante WhatsApp “Conferma” in agenda." },
  { kind: "REMINDER", channel: "WHATSAPP", slug: "promemoria-whatsapp", label: "Promemoria", hint: "Pulsante WhatsApp “Promemoria” in agenda e in “Promemoria di domani”." },
  { kind: "APPOINTMENT_CHANGED", channel: "WHATSAPP", slug: "modifica-whatsapp", label: "Appuntamento spostato", hint: "Pulsante WhatsApp dopo una modifica (agenda completa, step 7)." },
  { kind: "APPOINTMENT_CANCELLED", channel: "WHATSAPP", slug: "cancellazione-whatsapp", label: "Appuntamento cancellato", hint: "Pulsante WhatsApp dopo una cancellazione (agenda completa, step 7)." },
];

export const templateBySlug = (slug: string) => TEMPLATE_LIST.find((t) => t.slug === slug) ?? null;

/** Nomi dei tipi di messaggio nel registro invii e nelle email di prova. */
export const MESSAGE_KIND_LABEL: Record<TemplateKind | "ADMIN_NEW_BOOKING", string> = {
  LOGIN_CODE: "Codice di accesso",
  BOOKING_CONFIRMED: "Conferma prenotazione",
  REMINDER: "Promemoria",
  APPOINTMENT_CHANGED: "Appuntamento modificato",
  APPOINTMENT_CANCELLED: "Appuntamento cancellato",
  ADMIN_NEW_BOOKING: "Avviso nuova prenotazione (admin)",
};

/**
 * Testi predefiniti delle versioni precedenti. Il seed aggiorna ai testi nuovi solo i template
 * ancora identici a uno di questi (cioè mai modificati dall'admin).
 */
export const PREVIOUS_DEFAULTS: Partial<Record<TemplateKey, TemplateText[]>> = {
  // Step 1–5
  "BOOKING_CONFIRMED:EMAIL": [
    {
      subject: "Appuntamento confermato · {data} alle {ora}",
      body: "Ciao {nome},\n\nil tuo appuntamento è confermato:\n\n{data} alle {ora}\n{servizi}\nTotale: {totale}\n\nA presto!\nFabiana",
    },
  ],
  "REMINDER:EMAIL": [
    {
      subject: "Promemoria: domani alle {ora}",
      body: "Ciao {nome},\n\nti ricordo l'appuntamento di domani, {data} alle {ora}:\n{servizi}\n\nSe hai un imprevisto, scrivimi appena puoi.\n\nA domani!\nFabiana",
    },
  ],
  "APPOINTMENT_CHANGED:EMAIL": [
    {
      subject: "Appuntamento modificato · {data} alle {ora}",
      body: "Ciao {nome},\n\nil tuo appuntamento è stato spostato a:\n\n{data} alle {ora}\n{servizi}\n\nPer qualsiasi dubbio scrivimi.\n\nFabiana",
    },
  ],
  "APPOINTMENT_CANCELLED:EMAIL": [
    {
      subject: "Appuntamento cancellato · {data}",
      body: "Ciao {nome},\n\nl'appuntamento di {data} alle {ora} è stato cancellato.\n\nSe vuoi fissarne un altro, puoi prenotare dall'app.\n\nFabiana",
    },
  ],
  "BOOKING_CONFIRMED:WHATSAPP": [
    { subject: null, body: "Ciao {nome}! Ti confermo l'appuntamento di {data} alle {ora} ({servizi}). A presto! Fabiana" },
  ],
  "REMINDER:WHATSAPP": [
    { subject: null, body: "Ciao {nome}! Ti ricordo l'appuntamento di domani, {data} alle {ora}. A domani! Fabiana" },
  ],
  "APPOINTMENT_CHANGED:WHATSAPP": [
    { subject: null, body: "Ciao {nome}! Il tuo appuntamento è stato spostato a {data} alle {ora}. Fammi sapere se va bene. Fabiana" },
  ],
};

const normalize = (text: string | null) => (text ?? "").replace(/\r\n/g, "\n");
const sameText = (a: TemplateText, b: TemplateText) =>
  normalize(a.subject) === normalize(b.subject) && normalize(a.body) === normalize(b.body);

/**
 * Cosa fare col template salvato quando cambiano i testi predefiniti:
 * "update" se è identico a un predefinito precedente, altrimenti "keep" (già nuovo o modificato).
 */
export function seedTemplateAction(key: TemplateKey, stored: TemplateText): "update" | "keep" {
  const current = DEFAULT_TEMPLATES[key];
  if (!current || sameText(stored, current)) return "keep";
  return (PREVIOUS_DEFAULTS[key] ?? []).some((old) => sameText(stored, old)) ? "update" : "keep";
}
