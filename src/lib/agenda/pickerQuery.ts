/**
 * Stato delle pagine Nuovo / Sposta / Servizi nell'indirizzo (come /prenota): il tasto "indietro"
 * e i ricaricamenti non perdono le scelte. File senza dipendenze: lo usa anche il browser.
 */
export type PickerChoice = {
  client: string | null; // id cliente (solo "Nuovo")
  q: string; // ricerca cliente
  services: string[];
  keep: string[]; // voci di servizi non più in listino da tenere (solo "Servizi")
  month: string | null; // "YYYY-MM"
  day: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  noBuffer: boolean | null; // null = come l'appuntamento (o con pausa per i nuovi)
  outside: boolean; // "Fuori orario di lavoro"
};

/** `withServices`: scrive "s=" anche vuoto (Servizi: "nessuno scelto" è diverso da "come prima"). */
export function pickerQuery(p: Partial<PickerChoice>, withServices = false): string {
  const q = new URLSearchParams();
  if (p.client) q.set("cliente", p.client);
  if (p.q) q.set("q", p.q);
  if (p.services?.length || (withServices && p.services)) q.set("s", (p.services ?? []).join(","));
  if (p.keep?.length) q.set("v", p.keep.join(","));
  if (p.month) q.set("mese", p.month);
  if (p.day) q.set("giorno", p.day);
  if (p.time) q.set("ora", p.time);
  if (p.noBuffer !== null && p.noBuffer !== undefined) q.set("pausa", p.noBuffer ? "no" : "si");
  if (p.outside) q.set("fuori", "1");
  const text = q.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
  return text ? `?${text}` : "";
}
