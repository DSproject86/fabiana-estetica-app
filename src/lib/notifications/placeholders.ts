import type { Channel, MessageKind } from "@prisma/client";

/**
 * Segnaposto dei testi modificabili. Modulo puro: lo usano server (invio, salvataggio)
 * e browser (pulsanti dei segnaposto e anteprima).
 */

export type TemplateKind = Exclude<MessageKind, "ADMIN_NEW_BOOKING">;

export const PLACEHOLDERS = {
  nome: "Nome della cliente",
  cognome: "Cognome della cliente",
  data: "Giorno (es. martedì 14 ottobre)",
  ora: "Ora (es. 10:30)",
  servizi: "Servizi prenotati",
  durata: "Durata (senza pausa)",
  totale: "Totale",
  indirizzo: "Indirizzo dello studio",
  link: "Link a “I miei appuntamenti”",
  codice: "Codice di accesso",
} as const;

export type Placeholder = keyof typeof PLACEHOLDERS;
export type TemplateVars = Partial<Record<Placeholder, string>>;

const APPOINTMENT: Placeholder[] = ["nome", "cognome", "data", "ora", "servizi", "durata", "totale", "indirizzo", "link"];

/** Segnaposto ammessi per tipo di messaggio (uguali per email e WhatsApp). */
export function allowedPlaceholders(kind: TemplateKind): Placeholder[] {
  return kind === "LOGIN_CODE" ? ["nome", "cognome", "codice", "link"] : APPOINTMENT;
}

const TOKEN_RE = /\{([^{}\s]*)\}/g;

/** Segnaposto scritti nel testo che non vanno bene per quel messaggio (es. {codice} in un promemoria, {nme}). */
export function invalidPlaceholders(text: string, kind: TemplateKind): string[] {
  const allowed = new Set<string>(allowedPlaceholders(kind));
  const wrong = new Set<string>();
  for (const [, key] of text.matchAll(TOKEN_RE)) if (!allowed.has(key)) wrong.add(`{${key}}`);
  return [...wrong];
}

export const SUBJECT_MAX = 150;
export const BODY_MAX = { EMAIL: 3000, WHATSAPP: 1000 } as const;

export type TemplateInput = { kind: TemplateKind; channel: Channel; subject: string | null; body: string };

/** Controlli prima del salvataggio. Restituisce il messaggio d'errore oppure null. */
export function validateTemplate({ kind, channel, subject, body }: TemplateInput): string | null {
  if (channel === "EMAIL") {
    if (!subject?.trim()) return "Scrivi l'oggetto dell'email.";
    if (subject.length > SUBJECT_MAX) return `L'oggetto può avere al massimo ${SUBJECT_MAX} caratteri.`;
    if (/[\r\n]/.test(subject)) return "L'oggetto deve stare su una riga.";
  }
  if (!body.trim()) return "Il testo non può essere vuoto.";
  if (body.length > BODY_MAX[channel]) return `Il testo può avere al massimo ${BODY_MAX[channel]} caratteri.`;

  const wrong = [...new Set([...invalidPlaceholders(subject ?? "", kind), ...invalidPlaceholders(body, kind)])];
  if (wrong.length) {
    const list = wrong.join(" ");
    return wrong.length === 1
      ? `Il segnaposto ${list} non esiste o non si può usare in questo messaggio.`
      : `I segnaposto ${list} non esistono o non si possono usare in questo messaggio.`;
  }
  if (kind === "LOGIN_CODE" && !body.includes("{codice}")) return "Il testo del codice di accesso deve contenere {codice}.";
  return null;
}

/** Sostituisce i segnaposto noti (quelli sconosciuti restano come sono). */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key as Placeholder] ?? match) : match,
  );
}
