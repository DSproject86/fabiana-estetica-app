import { describe, expect, it } from "vitest";
import {
  amountAfterPackageChange,
  covers,
  decodeCoverage,
  defaultLinks,
  encodeCoverage,
  itemOffers,
  packageChoices,
  remainingLabel,
  summarizePackage,
  type OfferPackage,
} from "./rules";

describe("summarizePackage", () => {
  it("Mario Rossi: 150 €, acconto 50 € → residuo 100 €", () => {
    const s = summarizePackage({ priceCents: 15000, totalSessions: 5, sessionsUsedBefore: 0, sessionsInApp: 0, paidCents: 5000 });
    expect(s).toMatchObject({ paidCents: 5000, dueCents: 10000, remainingSessions: 5, completed: false, completedWithDue: false });
  });

  it("conta le sedute fatte prima dell'app e quelle scalate nell'app", () => {
    const s = summarizePackage({ priceCents: 40000, totalSessions: 10, sessionsUsedBefore: 3, sessionsInApp: 2, paidCents: 40000 });
    expect(s).toMatchObject({ usedSessions: 5, remainingSessions: 5, dueCents: 0 });
  });

  it("sedute finite con residuo: completato ma da pagare", () => {
    const s = summarizePackage({ priceCents: 15000, totalSessions: 5, sessionsUsedBefore: 2, sessionsInApp: 3, paidCents: 10000 });
    expect(s).toMatchObject({ remainingSessions: 0, completed: true, completedWithDue: true, dueCents: 5000 });
  });

  it("mai valori negativi", () => {
    const s = summarizePackage({ priceCents: 100, totalSessions: 1, sessionsUsedBefore: 1, sessionsInApp: 1, paidCents: 200 });
    expect(s.remainingSessions).toBe(0);
    expect(s.dueCents).toBe(0);
  });

  it("etichetta delle sedute", () => {
    expect(remainingLabel(3, 5)).toBe("3 di 5 rimaste");
    expect(remainingLabel(1, 5)).toBe("1 di 5 rimasta");
  });
});

describe("copertura (servizio o categoria)", () => {
  const massaggio = { serviceId: "mass", categoryId: "corpo" };
  it("servizio: solo lo stesso servizio", () => {
    expect(covers({ serviceId: "mass", categoryId: null }, massaggio)).toBe(true);
    expect(covers({ serviceId: "viso", categoryId: null }, massaggio)).toBe(false);
  });
  it("categoria: tutti i servizi della categoria", () => {
    expect(covers({ serviceId: null, categoryId: "corpo" }, massaggio)).toBe(true);
    expect(covers({ serviceId: null, categoryId: "viso" }, massaggio)).toBe(false);
  });
  it("pacchetto non collegato o voce senza servizio: mai", () => {
    expect(covers({ serviceId: null, categoryId: null }, massaggio)).toBe(false);
    expect(covers({ serviceId: null, categoryId: "corpo" }, { serviceId: null, categoryId: null })).toBe(false);
  });
  it("valori del menu", () => {
    expect(encodeCoverage({ serviceId: "a1", categoryId: null })).toBe("s:a1");
    expect(encodeCoverage({ serviceId: null, categoryId: "c1" })).toBe("c:c1");
    expect(decodeCoverage("c:c1")).toEqual({ serviceId: null, categoryId: "c1" });
    expect(decodeCoverage("")).toEqual({ serviceId: null, categoryId: null });
    expect(decodeCoverage("x:1")).toBeNull();
    expect(decodeCoverage("s:")).toBeNull();
  });
});

describe("scala dal pacchetto", () => {
  const pkg = (id: string, over: Partial<OfferPackage> = {}): OfferPackage => ({
    id,
    name: id,
    serviceId: null,
    categoryId: "corpo",
    totalSessions: 5,
    remainingSessions: 3,
    ...over,
  });
  const item = (id: string, serviceId = "mass", categoryId = "corpo") => ({ id, serviceId, categoryId, clientPackageId: null });

  it("un solo pacchetto che copre la voce: scalata in automatico", () => {
    expect(defaultLinks([item("i1")], [pkg("p1")])).toEqual(new Map([["i1", "p1"]]));
  });

  it("più pacchetti possibili: nessuna scelta automatica, ma si propongono tutti", () => {
    const packages = [pkg("p1"), pkg("p2", { categoryId: null, serviceId: "mass" })];
    expect(defaultLinks([item("i1")], packages).size).toBe(0);
    expect(itemOffers([item("i1")], packages)[0].packages.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("nessun pacchetto o sedute finite: niente", () => {
    expect(defaultLinks([item("i1")], []).size).toBe(0);
    expect(defaultLinks([item("i1")], [pkg("p1", { remainingSessions: 0 })]).size).toBe(0);
    expect(itemOffers([item("i1")], [pkg("p1", { remainingSessions: 0 })])).toEqual([]);
  });

  it("i pacchetti esauriti non contano per decidere se è l'unico", () => {
    const packages = [pkg("vecchio", { remainingSessions: 0 }), pkg("nuovo")];
    expect(defaultLinks([item("i1")], packages)).toEqual(new Map([["i1", "nuovo"]]));
  });

  it("due voci e una sola seduta rimasta: se ne scala una", () => {
    const links = defaultLinks([item("i1"), item("i2")], [pkg("p1", { remainingSessions: 1 })]);
    expect([...links.keys()]).toEqual(["i1"]);
  });

  it("voci non coperte restano fuori", () => {
    expect(defaultLinks([item("i1", "viso", "viso")], [pkg("p1")]).size).toBe(0);
  });

  it("una voce già collegata vede il suo pacchetto anche a sedute finite", () => {
    const offers = itemOffers([{ ...item("i1"), clientPackageId: "p1" }], [pkg("p1", { remainingSessions: 0 })]);
    expect(offers[0].packages[0].id).toBe("p1");
  });
});

describe("importo dopo scala/togli", () => {
  it("importo non toccato: diventa il nuovo precompilato", () => {
    expect(amountAfterPackageChange(9500, 9500, 4500)).toBe(4500);
    expect(amountAfterPackageChange(4500, 4500, 9500)).toBe(9500);
  });
  it("importo corretto a mano: si sposta della differenza, mai sotto zero", () => {
    expect(amountAfterPackageChange(9000, 9500, 4500)).toBe(4000);
    expect(amountAfterPackageChange(1000, 9500, 4500)).toBe(0);
  });
});

describe("scelte nella card dell'agenda", () => {
  const pkg = (id: string, remainingSessions: number): OfferPackage => ({ id, name: id, serviceId: null, categoryId: "corpo", totalSessions: 5, remainingSessions });
  const item = (id: string, clientPackageId: string | null = null) => ({ id, serviceId: "mass", categoryId: "corpo", clientPackageId });

  it("toglie le sedute usate dalle altre voci dello stesso appuntamento", () => {
    const choices = packageChoices([item("i1", "p1"), item("i2")], [pkg("p1", 2)]);
    expect(choices).toEqual([
      { itemId: "i1", linkedPackageId: "p1", options: [{ id: "p1", name: "p1", totalSessions: 5, remainingWithoutThis: 2 }] },
      { itemId: "i2", linkedPackageId: null, options: [{ id: "p1", name: "p1", totalSessions: 5, remainingWithoutThis: 1 }] },
    ]);
  });

  it("ultima seduta presa da un'altra voce: questa non la vede più", () => {
    const choices = packageChoices([item("i1", "p1"), item("i2")], [pkg("p1", 1)]);
    expect(choices.map((c) => c.itemId)).toEqual(["i1"]);
  });
});
