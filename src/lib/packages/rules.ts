/**
 * Regole dei pacchetti (funzioni pure).
 *
 * Sedute usate = sedute fatte prima dell'app (`sessionsUsedBefore`) + voci di appuntamenti collegate al
 * pacchetto (`AppointmentItem.clientPackageId`). Il collegamento esiste solo sugli appuntamenti Fatti:
 * togliere la spunta o annullare lo toglie nella stessa transazione.
 * Pagato = somma dei pagamenti; residuo = prezzo − pagato (mai negativo: i pagamenti oltre il residuo
 * si rifiutano).
 */

export type PackageNumbers = {
  priceCents: number;
  totalSessions: number;
  sessionsUsedBefore: number;
  /** Voci di appuntamenti collegate al pacchetto. */
  sessionsInApp: number;
  paidCents: number;
};

export type PackageSummary = {
  usedSessions: number;
  remainingSessions: number;
  paidCents: number;
  dueCents: number;
  /** Sedute finite. */
  completed: boolean;
  /** Sedute finite ma ancora qualcosa da pagare. */
  completedWithDue: boolean;
};

export function summarizePackage(p: PackageNumbers): PackageSummary {
  const usedSessions = p.sessionsUsedBefore + p.sessionsInApp;
  const remainingSessions = Math.max(0, p.totalSessions - usedSessions);
  const dueCents = Math.max(0, p.priceCents - p.paidCents);
  const completed = remainingSessions === 0;
  return { usedSessions, remainingSessions, paidCents: p.paidCents, dueCents, completed, completedWithDue: completed && dueCents > 0 };
}

/** "3 di 5 rimaste" */
export function remainingLabel(remaining: number, total: number): string {
  return `${remaining} di ${total} ${remaining === 1 ? "rimasta" : "rimaste"}`;
}

// ─────────────── A cosa vale un pacchetto ───────────────

export type Coverage = { serviceId: string | null; categoryId: string | null };

/** La voce (servizio del listino, con la sua categoria) è coperta dal pacchetto? */
export function covers(pkg: Coverage, item: { serviceId: string | null; categoryId: string | null }): boolean {
  if (!item.serviceId) return false; // voce di un servizio eliminato dal listino
  if (pkg.serviceId) return pkg.serviceId === item.serviceId;
  if (pkg.categoryId) return pkg.categoryId === item.categoryId;
  return false;
}

/** Valore del menu "Valido per": "s:<id>" servizio, "c:<id>" categoria, "" nessuno. */
export function encodeCoverage(c: Coverage): string {
  if (c.serviceId) return `s:${c.serviceId}`;
  if (c.categoryId) return `c:${c.categoryId}`;
  return "";
}

export function decodeCoverage(value: string): Coverage | null {
  if (!value) return { serviceId: null, categoryId: null };
  const m = /^([sc]):([\w-]{1,64})$/.exec(value);
  if (!m) return null;
  return m[1] === "s" ? { serviceId: m[2], categoryId: null } : { serviceId: null, categoryId: m[2] };
}

// ─────────────── Scalare dal pacchetto alla spunta "Fatto" ───────────────

export type OfferPackage = Coverage & { id: string; name: string; totalSessions: number; remainingSessions: number };
export type OfferItem = { id: string; serviceId: string | null; categoryId: string | null; clientPackageId: string | null };

export type ItemOffer = {
  itemId: string;
  /** Pacchetti attivi della cliente che coprono la voce e hanno ancora sedute. */
  packages: OfferPackage[];
};

/**
 * Pacchetti proponibili per ogni voce. `packages` sono i pacchetti attivi della cliente con le sedute
 * rimaste calcolate SENZA le voci di questo appuntamento (così una voce già collegata continua a vedere
 * il suo pacchetto anche se era l'ultima seduta).
 */
export function itemOffers(items: OfferItem[], packages: OfferPackage[]): ItemOffer[] {
  return items
    .map((item) => ({
      itemId: item.id,
      packages: packages.filter((p) => covers(p, item) && (p.remainingSessions > 0 || p.id === item.clientPackageId)),
    }))
    .filter((o) => o.packages.length > 0);
}

/**
 * Collegamenti automatici alla spunta "Fatto": una voce si scala da sola solo se c'è UN SOLO pacchetto
 * attivo che la copre (con sedute rimaste). Se più voci dello stesso appuntamento puntano allo stesso
 * pacchetto, si scalano finché ci sono sedute.
 */
export function defaultLinks(items: OfferItem[], packages: OfferPackage[]): Map<string, string> {
  const left = new Map(packages.map((p) => [p.id, p.remainingSessions]));
  const links = new Map<string, string>();
  for (const item of items) {
    const eligible = packages.filter((p) => covers(p, item) && p.remainingSessions > 0);
    if (eligible.length !== 1) continue;
    const pkg = eligible[0];
    const available = left.get(pkg.id) ?? 0;
    if (available <= 0) continue;
    left.set(pkg.id, available - 1);
    links.set(item.id, pkg.id);
  }
  return links;
}

/**
 * Importo incassato dopo aver collegato/scollegato una voce: se l'admin non l'aveva cambiato (era uguale
 * al precompilato) diventa il nuovo precompilato; se l'aveva cambiato (sconto, extra) si sposta della
 * differenza, senza scendere sotto zero.
 */
export function amountAfterPackageChange(current: number | null, previousPrefill: number, nextPrefill: number): number {
  if (current === null || current === previousPrefill) return nextPrefill;
  return Math.max(0, current + (nextPrefill - previousPrefill));
}

export type PackageChoice = {
  itemId: string;
  linkedPackageId: string | null;
  /** Pacchetti proponibili, con le sedute rimaste se questa voce NON fosse scalata. */
  options: { id: string; name: string; totalSessions: number; remainingWithoutThis: number }[];
};

/**
 * Scelte "Scala dal pacchetto" per le voci di un appuntamento Fatto. `packages` ha le sedute rimaste
 * calcolate senza tutto l'appuntamento: qui si tolgono quelle usate dalle sue altre voci.
 */
export function packageChoices(items: OfferItem[], packages: OfferPackage[]): PackageChoice[] {
  return items.flatMap((item) => {
    const options = packages
      .filter((p) => covers(p, item))
      .map((p) => ({
        id: p.id,
        name: p.name,
        totalSessions: p.totalSessions,
        remainingWithoutThis:
          p.remainingSessions - items.filter((o) => o.id !== item.id && o.clientPackageId === p.id).length,
      }))
      .filter((p) => p.remainingWithoutThis > 0 || p.id === item.clientPackageId);
    return options.length ? [{ itemId: item.id, linkedPackageId: item.clientPackageId, options }] : [];
  });
}
