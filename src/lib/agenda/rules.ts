import { addMonthsToMonth, monthOf, monthRange } from "@/lib/booking/calendar";
import { dayKeyOf, todayKey, type DayKey } from "@/lib/time/rome";

/**
 * Regole dell'agenda admin (funzioni pure, tutto in Europe/Rome).
 * Stati di un appuntamento:
 *  - confermato: CONFIRMED senza doneAt
 *  - fatto: CONFIRMED con doneAt (e importo incassato)
 *  - non presentata: NO_SHOW (non occupa il calendario)
 *  - annullato: CANCELLED
 */

export type AgendaStatus = "CONFIRMED" | "CANCELLED" | "NO_SHOW";
export type AgendaState = "confirmed" | "done" | "noShow" | "cancelled";

export function agendaState(a: { status: AgendaStatus; doneAt: Date | null }): AgendaState {
  if (a.status === "CANCELLED") return "cancelled";
  if (a.status === "NO_SHOW") return "noShow";
  return a.doneAt ? "done" : "confirmed";
}

/** Fine del trattamento, senza la pausa. */
export function treatmentEndOf(a: { startsAt: Date; durationMin: number }): Date {
  return new Date(a.startsAt.getTime() + a.durationMin * 60_000);
}

/**
 * Importo da precompilare alla spunta "Fatto": il totale delle voci NON scalate da un pacchetto
 * (quei soldi sono già nei pagamenti del pacchetto, contarli qui sarebbe un doppio conteggio).
 */
export function collectableCents(items: { priceCents: number; clientPackageId: string | null }[]): number {
  return items.reduce((sum, i) => sum + (i.clientPackageId ? 0 : i.priceCents), 0);
}

/** "Fatto" e "Non presentata" si possono segnare dal giorno dell'appuntamento in poi. */
export function canMarkOutcome(a: { startsAt: Date }, now = new Date()): boolean {
  return dayKeyOf(a.startsAt) <= todayKey(now);
}

/** Sposta, Servizi e Annulla: solo appuntamenti confermati e non ancora Fatti. */
export function canEdit(a: { status: AgendaStatus; doneAt: Date | null }): boolean {
  return agendaState(a) === "confirmed";
}

/**
 * Annulla: confermati, anche se già Fatti (in quel caso con conferma esplicita: l'incasso
 * viene tolto). Le "non presentata" prima si ripristinano.
 */
export function canCancel(a: { status: AgendaStatus }): boolean {
  return a.status === "CONFIRMED";
}

/** Passato e non segnato: confermato, trattamento già finito, né Fatto né Non presentata. */
export function isUnmarkedPast(
  a: { status: AgendaStatus; doneAt: Date | null; startsAt: Date; durationMin: number },
  now = new Date(),
): boolean {
  return agendaState(a) === "confirmed" && treatmentEndOf(a) <= now;
}

/** Interruttore "Avvisa per email": acceso di default solo per appuntamenti futuri di clienti con email. */
export function notifyByDefault(startsAt: Date, email: string | null, now = new Date()): boolean {
  return !!email && startsAt > now;
}

/**
 * Giorni da mostrare in agenda per un mese "YYYY-MM": il mese corrente parte da oggi
 * (salvo `showPast`), gli altri mesi si vedono interi.
 */
export function agendaRange(month: string, today: DayKey, showPast = false): { from: DayKey; to: DayKey; partial: boolean } {
  const { first, last } = monthRange(month);
  const partial = !showPast && month === monthOf(today) && today > first;
  return { from: partial ? today : first, to: last, partial };
}

export const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** Mese richiesto, se valido e non assurdo (± 5 anni da oggi); altrimenti il mese corrente. */
export function parseMonth(value: string | undefined, today: DayKey): string {
  const current = monthOf(today);
  if (!value || !isValidMonth(value)) return current;
  if (value < addMonthsToMonth(current, -60) || value > addMonthsToMonth(current, 60)) return current;
  return value;
}

// ─────────────── Modifica servizi ───────────────

export type ItemSnapshot = {
  id: string;
  serviceId: string | null;
  name: string;
  durationMin: number;
  priceCents: number;
  clientPackageId: string | null;
};

export type NewItem = Omit<ItemSnapshot, "id"> & { sortOrder: number };

/**
 * Nuove voci dopo "Modifica servizi":
 * - le voci già presenti restano com'erano (prezzo, durata e pacchetto originali) se il loro servizio
 *   è ancora scelto, oppure, per i servizi eliminati dal listino, se la voce è in `keepItemIds`;
 * - i servizi aggiunti prendono nome, durata e prezzo attuali del listino.
 * L'ordine è: voci tenute senza servizio, poi i servizi nell'ordine scelto.
 */
export function mergeItems(
  existing: ItemSnapshot[],
  services: { id: string; name: string; durationMin: number; priceCents: number }[],
  keepItemIds: string[] = [],
): NewItem[] {
  const keepOrphans = existing.filter((i) => !i.serviceId && keepItemIds.includes(i.id));
  const byService = new Map<string, ItemSnapshot>();
  for (const i of existing) if (i.serviceId && !byService.has(i.serviceId)) byService.set(i.serviceId, i);

  const copy = (i: ItemSnapshot) => ({
    serviceId: i.serviceId,
    name: i.name,
    durationMin: i.durationMin,
    priceCents: i.priceCents,
    clientPackageId: i.clientPackageId,
  });
  const rows: Omit<NewItem, "sortOrder">[] = [
    ...keepOrphans.map(copy),
    ...services.map((s) => {
      const kept = byService.get(s.id);
      return kept
        ? copy(kept)
        : { serviceId: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, clientPackageId: null };
    }),
  ];
  return rows.map((r, sortOrder) => ({ ...r, sortOrder }));
}
