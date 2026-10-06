import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import { EXTRA_KEY, buildMonthStats, compareTotals, splitProportionally, type StatsAppointment } from "./month";

const NOW = new Date("2027-06-01T10:00:00Z");

function done(startsAt: Date, amount: number, items: Partial<StatsAppointment["items"][number]>[] = []): StatsAppointment {
  return {
    startsAt,
    durationMin: 60,
    status: "CONFIRMED",
    doneAt: startsAt,
    amountCollectedCents: amount,
    items: items.map((i) => ({ serviceId: "s1", name: "Pulizia viso", priceCents: amount, clientPackageId: null, ...i })),
  };
}

const dayOf = (stats: ReturnType<typeof buildMonthStats>, day: string) => stats.days.find((d) => d.day === day)!;

describe("confini di mese (Europe/Rome)", () => {
  it("00:30 del 1° novembre a Roma (ancora 31 ottobre in UTC) conta a novembre", () => {
    const a = done(new Date("2026-10-31T23:30:00Z"), 5000); // 1/11 00:30 ora solare (UTC+1)
    expect(buildMonthStats("2026-10", [a], [], NOW).totalCents).toBe(0);
    const nov = buildMonthStats("2026-11", [a], [], NOW);
    expect(nov.totalCents).toBe(5000);
    expect(dayOf(nov, "2026-11-01").appointmentsCents).toBe(5000);
  });

  it("23:30 del 31 ottobre a Roma resta a ottobre", () => {
    const a = done(instantAt("2026-10-31", 23 * 60 + 30), 4000);
    expect(a.startsAt.toISOString()).toBe("2026-10-31T22:30:00.000Z");
    expect(dayOf(buildMonthStats("2026-10", [a], [], NOW), "2026-10-31").appointmentsCents).toBe(4000);
    expect(buildMonthStats("2026-11", [a], [], NOW).totalCents).toBe(0);
  });

  it("ora legale: 00:30 del 1° aprile 2027 (UTC+2) è il 31 marzo in UTC ma conta ad aprile", () => {
    const a = done(new Date("2027-03-31T22:30:00Z"), 3000);
    expect(buildMonthStats("2027-03", [a], [], NOW).totalCents).toBe(0);
    expect(dayOf(buildMonthStats("2027-04", [a], [], NOW), "2027-04-01").appointmentsCents).toBe(3000);
  });

  it("1° marzo 2027 alle 00:30 (UTC+1, ancora 28 febbraio in UTC) conta a marzo", () => {
    const a = done(new Date("2027-02-28T23:30:00Z"), 2000);
    expect(buildMonthStats("2027-02", [a], [], NOW).totalCents).toBe(0);
    expect(dayOf(buildMonthStats("2027-03", [a], [], NOW), "2027-03-01").appointmentsCents).toBe(2000);
  });
});

describe("cambio d'ora", () => {
  it("25 ottobre 2026 (giorno di 25 ore): appuntamenti a inizio e fine giornata nello stesso giorno", () => {
    const early = done(instantAt("2026-10-25", 1 * 60 + 30), 1000); // 01:30, ancora ora legale
    const late = done(instantAt("2026-10-25", 23 * 60 + 30), 2000); // 23:30, ora solare
    expect(early.startsAt.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(late.startsAt.toISOString()).toBe("2026-10-25T22:30:00.000Z");
    const stats = buildMonthStats("2026-10", [early, late], [], NOW);
    expect(dayOf(stats, "2026-10-25").appointmentsCents).toBe(3000);
    expect(dayOf(stats, "2026-10-24").appointmentsCents).toBe(0);
    expect(dayOf(stats, "2026-10-26").appointmentsCents).toBe(0);
    expect(stats.days).toHaveLength(31);
  });

  it("28 marzo 2027 (giorno di 23 ore): 00:30 e 23:30 nello stesso giorno", () => {
    const early = done(instantAt("2027-03-28", 30), 1000);
    const late = done(instantAt("2027-03-28", 23 * 60 + 30), 2000);
    expect(early.startsAt.toISOString()).toBe("2027-03-27T23:30:00.000Z");
    expect(late.startsAt.toISOString()).toBe("2027-03-28T21:30:00.000Z");
    const stats = buildMonthStats("2027-03", [early, late], [], NOW);
    expect(dayOf(stats, "2027-03-28").appointmentsCents).toBe(3000);
    expect(dayOf(stats, "2027-03-27").appointmentsCents).toBe(0);
  });
});

describe("fonti dell'incasso", () => {
  it("appuntamenti Fatti + pagamenti dei pacchetti (per paidOn), separati e sommati", () => {
    const stats = buildMonthStats(
      "2026-10",
      [done(instantAt("2026-10-12", 600), 4500)],
      [
        { paidOn: "2026-10-12", amountCents: 20000 },
        { paidOn: "2026-10-31", amountCents: 10000 },
        { paidOn: "2026-11-01", amountCents: 99900 }, // altro mese
        { paidOn: "2026-09-30", amountCents: 99900 },
      ],
      NOW,
    );
    expect(stats.appointmentsCents).toBe(4500);
    expect(stats.packagesCents).toBe(30000);
    expect(stats.totalCents).toBe(34500);
    expect(dayOf(stats, "2026-10-12")).toEqual({ day: "2026-10-12", appointmentsCents: 4500, packagesCents: 20000, totalCents: 24500 });
  });

  it("le sedute da pacchetto contano nelle volte ma valgono 0 €: niente doppio conteggio", () => {
    // Pulizia viso pagata (45 €) + massaggio scalato dal pacchetto: incassato 45 €.
    const a = done(instantAt("2026-10-12", 600), 4500, [
      { serviceId: "viso", name: "Pulizia viso", priceCents: 4500 },
      { serviceId: "mass", name: "Massaggio", priceCents: 5000, clientPackageId: "pk1" },
    ]);
    const stats = buildMonthStats("2026-10", [a], [{ paidOn: "2026-10-01", amountCents: 50000 }], NOW);
    expect(stats.totalCents).toBe(54500);
    const byKey = Object.fromEntries(stats.services.map((s) => [s.key, s]));
    expect(byKey.viso).toMatchObject({ count: 1, fromPackage: 0, revenueCents: 4500 });
    expect(byKey.mass).toMatchObject({ count: 1, fromPackage: 1, revenueCents: 0 });
  });

  it("sconto ed extra si ripartiscono in proporzione e la somma torna al centesimo", () => {
    const a = done(instantAt("2026-10-12", 600), 5000, [
      { serviceId: "a", name: "A", priceCents: 4500 },
      { serviceId: "b", name: "B", priceCents: 2000 },
    ]); // listino 65 €, incassato 50 €
    const stats = buildMonthStats("2026-10", [a], [], NOW);
    const total = stats.services.reduce((sum, s) => sum + s.revenueCents, 0);
    expect(total).toBe(5000);
    expect(stats.services.find((s) => s.key === "a")!.revenueCents).toBe(3462);
    expect(stats.services.find((s) => s.key === "b")!.revenueCents).toBe(1538);
  });

  it("incasso su un appuntamento solo a pacchetto finisce in 'extra'", () => {
    const a = done(instantAt("2026-10-12", 600), 500, [{ serviceId: "m", name: "Massaggio", priceCents: 5000, clientPackageId: "pk" }]);
    const stats = buildMonthStats("2026-10", [a], [], NOW);
    expect(stats.services.find((s) => s.key === EXTRA_KEY)?.revenueCents).toBe(500);
    expect(stats.appointmentsCents).toBe(500);
  });

  it("servizi eliminati dal listino si raggruppano per nome", () => {
    const a = done(instantAt("2026-10-12", 600), 1000, [{ serviceId: null, name: "Vecchio", priceCents: 1000 }]);
    const b = done(instantAt("2026-10-13", 600), 1000, [{ serviceId: null, name: "Vecchio", priceCents: 1000 }]);
    const stats = buildMonthStats("2026-10", [a, b], [], NOW);
    expect(stats.services).toEqual([{ key: "nome:Vecchio", name: "Vecchio", count: 2, fromPackage: 0, revenueCents: 2000 }]);
  });
});

describe("conteggi", () => {
  it("fatti, non presentate, annullati e passati non segnati; solo i Fatti incassano", () => {
    const at = (day: string) => instantAt(day, 600);
    const base = { durationMin: 60, doneAt: null, amountCollectedCents: null, items: [] };
    const stats = buildMonthStats(
      "2026-10",
      [
        done(at("2026-10-05"), 1000),
        { ...base, startsAt: at("2026-10-06"), status: "NO_SHOW" },
        { ...base, startsAt: at("2026-10-07"), status: "CANCELLED" },
        { ...base, startsAt: at("2026-10-08"), status: "CONFIRMED" }, // passato, da segnare
        { ...base, startsAt: at("2026-10-20"), status: "CONFIRMED" }, // futuro
      ],
      [],
      new Date("2026-10-15T12:00:00Z"),
    );
    expect(stats.counts).toEqual({ done: 1, noShow: 1, cancelled: 1, unmarked: 1 });
    expect(stats.totalCents).toBe(1000);
  });
});

describe("ripartizione e confronto", () => {
  it("splitProportionally: resti più grandi, somma esatta", () => {
    expect(splitProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitProportionally(0, [5, 5])).toEqual([0, 0]);
    expect(splitProportionally(100, [0, 0])).toEqual([0, 0]);
    expect(splitProportionally(7001, [4500, 2000, 999]).reduce((a, b) => a + b, 0)).toBe(7001);
  });

  it("confronto col mese precedente in € e %", () => {
    expect(compareTotals(12000, 10000)).toEqual({ diffCents: 2000, percent: 20 });
    expect(compareTotals(9000, 12000)).toEqual({ diffCents: -3000, percent: -25 });
    expect(compareTotals(5000, 0)).toEqual({ diffCents: 5000, percent: null });
    expect(compareTotals(10000, 30000).percent).toBe(-66.7);
  });
});
