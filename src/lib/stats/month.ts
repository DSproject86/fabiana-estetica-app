import { monthRange } from "@/lib/booking/calendar";
import { addDays, dayKeyOf, type DayKey } from "@/lib/time/rome";

/**
 * Statistiche di un mese (funzioni pure, tutto in Europe/Rome).
 *
 * Fonti dell'incasso, mai sommate due volte:
 *  - appuntamenti "Fatto": `amountCollectedCents`, nel giorno a Roma di `startsAt`
 *    (l'importo esclude già le voci scalate da un pacchetto);
 *  - pagamenti dei pacchetti: `PackagePayment.amountCents`, nel giorno `paidOn`.
 */

export type StatsItem = { serviceId: string | null; name: string; priceCents: number; clientPackageId: string | null };

export type StatsAppointment = {
  startsAt: Date;
  durationMin: number;
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW";
  doneAt: Date | null;
  amountCollectedCents: number | null;
  items: StatsItem[];
};

export type StatsPayment = { paidOn: DayKey; amountCents: number };

export type DayStats = { day: DayKey; appointmentsCents: number; packagesCents: number; totalCents: number };

export type ServiceStats = {
  key: string;
  name: string;
  /** Volte in cui è stato fatto (comprese le sedute da pacchetto). */
  count: number;
  /** Di cui scalate da un pacchetto (valgono 0 € qui: i soldi sono nei pagamenti del pacchetto). */
  fromPackage: number;
  revenueCents: number;
};

export type MonthStats = {
  month: string;
  days: DayStats[];
  appointmentsCents: number;
  packagesCents: number;
  totalCents: number;
  counts: { done: number; noShow: number; cancelled: number; unmarked: number };
  services: ServiceStats[];
};

export const EXTRA_KEY = "__extra";
export const EXTRA_LABEL = "Extra non legati a un servizio";

/**
 * Divide `amount` in parti proporzionali ai pesi, in centesimi interi che sommano esattamente
 * ad `amount` (metodo dei resti più grandi; a parità vince la voce che viene prima).
 */
export function splitProportionally(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (amount * w) / total);
  const parts = exact.map(Math.floor);
  let rest = amount - parts.reduce((sum, p) => sum + p, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) parts[order[k].i] += 1;
  return parts;
}

const isDone = (a: StatsAppointment) => a.status === "CONFIRMED" && a.doneAt !== null;

/** Giorno di calendario a Roma in cui si conta un appuntamento. */
export const statsDayOf = (a: { startsAt: Date }): DayKey => dayKeyOf(a.startsAt);

export function buildMonthStats(
  month: string,
  appointments: StatsAppointment[],
  payments: StatsPayment[],
  now = new Date(),
): MonthStats {
  const { first, last } = monthRange(month);
  const inMonth = (day: DayKey) => day >= first && day <= last;

  const byDay = new Map<DayKey, DayStats>();
  for (let day = first; day <= last; day = addDays(day, 1)) {
    byDay.set(day, { day, appointmentsCents: 0, packagesCents: 0, totalCents: 0 });
  }

  const counts = { done: 0, noShow: 0, cancelled: 0, unmarked: 0 };
  const services = new Map<string, ServiceStats>();
  const service = (key: string, name: string) => {
    let row = services.get(key);
    if (!row) services.set(key, (row = { key, name, count: 0, fromPackage: 0, revenueCents: 0 }));
    return row;
  };

  for (const a of appointments) {
    const day = statsDayOf(a);
    if (!inMonth(day)) continue;
    if (a.status === "CANCELLED") counts.cancelled++;
    else if (a.status === "NO_SHOW") counts.noShow++;
    else if (!isDone(a)) {
      if (a.startsAt.getTime() + a.durationMin * 60_000 <= now.getTime()) counts.unmarked++;
      continue;
    }
    if (!isDone(a)) continue;

    counts.done++;
    const amount = a.amountCollectedCents ?? 0;
    const row = byDay.get(day)!;
    row.appointmentsCents += amount;

    // Ripartizione dell'incassato tra le voci pagate in proporzione al prezzo di listino.
    const paid = a.items.filter((i) => !i.clientPackageId);
    const shares = splitProportionally(amount, paid.map((i) => i.priceCents));
    let assigned = 0;
    for (const item of a.items) {
      const s = service(item.serviceId ?? `nome:${item.name}`, item.name);
      s.count++;
      if (item.clientPackageId) s.fromPackage++;
    }
    paid.forEach((item, i) => {
      service(item.serviceId ?? `nome:${item.name}`, item.name).revenueCents += shares[i];
      assigned += shares[i];
    });
    if (amount - assigned > 0) service(EXTRA_KEY, EXTRA_LABEL).revenueCents += amount - assigned;
  }

  for (const p of payments) {
    if (!inMonth(p.paidOn)) continue;
    byDay.get(p.paidOn)!.packagesCents += p.amountCents;
  }

  const days = [...byDay.values()].map((d) => ({ ...d, totalCents: d.appointmentsCents + d.packagesCents }));
  const appointmentsCents = days.reduce((sum, d) => sum + d.appointmentsCents, 0);
  const packagesCents = days.reduce((sum, d) => sum + d.packagesCents, 0);

  return {
    month,
    days,
    appointmentsCents,
    packagesCents,
    totalCents: appointmentsCents + packagesCents,
    counts,
    services: [...services.values()].sort(
      (a, b) => b.revenueCents - a.revenueCents || b.count - a.count || a.name.localeCompare(b.name, "it"),
    ),
  };
}

/** Confronto col mese precedente: differenza in euro e in percentuale (null se il mese prima era a zero). */
export function compareTotals(current: number, previous: number): { diffCents: number; percent: number | null } {
  return {
    diffCents: current - previous,
    percent: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
  };
}
