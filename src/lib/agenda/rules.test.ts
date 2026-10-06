import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import { pickerQuery } from "./pickerQuery";
import { parsePickerParams } from "./params";
import {
  agendaRange,
  agendaState,
  canCancel,
  canEdit,
  canMarkOutcome,
  collectableCents,
  isUnmarkedPast,
  mergeItems,
  notifyByDefault,
  parseMonth,
} from "./rules";

describe("stati e permessi", () => {
  it("stato dell'appuntamento", () => {
    expect(agendaState({ status: "CONFIRMED", doneAt: null })).toBe("confirmed");
    expect(agendaState({ status: "CONFIRMED", doneAt: new Date() })).toBe("done");
    expect(agendaState({ status: "NO_SHOW", doneAt: null })).toBe("noShow");
    expect(agendaState({ status: "CANCELLED", doneAt: null })).toBe("cancelled");
    expect(canEdit({ status: "CONFIRMED", doneAt: new Date() })).toBe(false);
    expect(canEdit({ status: "CONFIRMED", doneAt: null })).toBe(true);
    // Annulla anche sui Fatti (con conferma), non sulle Non presentata o già annullati.
    expect(canCancel({ status: "CONFIRMED" })).toBe(true);
    expect(canCancel({ status: "NO_SHOW" })).toBe(false);
    expect(canCancel({ status: "CANCELLED" })).toBe(false);
  });

  it("Fatto / Non presentata dal giorno dell'appuntamento (a Roma), anche prima dell'ora", () => {
    const appt = { startsAt: instantAt("2026-10-12", 18 * 60) };
    expect(canMarkOutcome(appt, new Date("2026-10-11T21:59:00Z"))).toBe(false); // 11/10 23:59 a Roma
    expect(canMarkOutcome(appt, new Date("2026-10-11T22:00:00Z"))).toBe(true); // 12/10 00:00 a Roma
  });

  it("passato non segnato: trattamento finito (senza pausa), né Fatto né Non presentata", () => {
    const a = { status: "CONFIRMED" as const, doneAt: null, startsAt: instantAt("2026-10-12", 600), durationMin: 60 };
    expect(isUnmarkedPast(a, instantAt("2026-10-12", 659))).toBe(false);
    expect(isUnmarkedPast(a, instantAt("2026-10-12", 660))).toBe(true);
    expect(isUnmarkedPast({ ...a, doneAt: new Date() }, instantAt("2026-10-13", 0))).toBe(false);
    expect(isUnmarkedPast({ ...a, status: "NO_SHOW" }, instantAt("2026-10-13", 0))).toBe(false);
  });

  it("email di default solo per appuntamenti futuri con email", () => {
    const now = new Date("2026-10-06T08:00:00Z");
    expect(notifyByDefault(new Date("2026-10-07T08:00:00Z"), "a@b.it", now)).toBe(true);
    expect(notifyByDefault(new Date("2026-10-05T08:00:00Z"), "a@b.it", now)).toBe(false);
    expect(notifyByDefault(new Date("2026-10-07T08:00:00Z"), null, now)).toBe(false);
  });
});

describe("importo precompilato", () => {
  it("esclude le voci scalate da un pacchetto", () => {
    expect(
      collectableCents([
        { priceCents: 4500, clientPackageId: null },
        { priceCents: 5000, clientPackageId: "pk" },
        { priceCents: 2000, clientPackageId: null },
      ]),
    ).toBe(6500);
    expect(collectableCents([{ priceCents: 5000, clientPackageId: "pk" }])).toBe(0);
  });
});

describe("mesi dell'agenda", () => {
  it("il mese corrente parte da oggi, gli altri sono interi", () => {
    expect(agendaRange("2026-10", "2026-10-06")).toEqual({ from: "2026-10-06", to: "2026-10-31", partial: true });
    expect(agendaRange("2026-10", "2026-10-06", true)).toEqual({ from: "2026-10-01", to: "2026-10-31", partial: false });
    expect(agendaRange("2026-10", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-31", partial: false });
    expect(agendaRange("2026-11", "2026-10-06")).toEqual({ from: "2026-11-01", to: "2026-11-30", partial: false });
    expect(agendaRange("2027-02", "2026-10-06").to).toBe("2027-02-28");
  });

  it("mese dall'indirizzo: valido e non assurdo, altrimenti il corrente", () => {
    expect(parseMonth("2026-12", "2026-10-06")).toBe("2026-12");
    expect(parseMonth("2026-13", "2026-10-06")).toBe("2026-10");
    expect(parseMonth("1999-01", "2026-10-06")).toBe("2026-10");
    expect(parseMonth(undefined, "2026-10-06")).toBe("2026-10");
  });
});

describe("modifica servizi", () => {
  const existing = [
    { id: "i1", serviceId: "viso", name: "Pulizia viso", durationMin: 50, priceCents: 4000, clientPackageId: null },
    { id: "i2", serviceId: "mass", name: "Massaggio", durationMin: 60, priceCents: 5000, clientPackageId: "pk1" },
    { id: "i3", serviceId: null, name: "Vecchio servizio", durationMin: 20, priceCents: 1500, clientPackageId: null },
  ];
  const listino = {
    viso: { id: "viso", name: "Pulizia viso (nuovo nome)", durationMin: 60, priceCents: 4500 },
    mass: { id: "mass", name: "Massaggio", durationMin: 60, priceCents: 5500 },
    peel: { id: "peel", name: "Peeling", durationMin: 15, priceCents: 2000 },
  };

  it("le voci tenute restano com'erano (prezzo e pacchetto), le nuove prendono il listino", () => {
    const items = mergeItems(existing, [listino.mass, listino.peel], ["i3"]);
    expect(items).toEqual([
      { serviceId: null, name: "Vecchio servizio", durationMin: 20, priceCents: 1500, clientPackageId: null, sortOrder: 0 },
      { serviceId: "mass", name: "Massaggio", durationMin: 60, priceCents: 5000, clientPackageId: "pk1", sortOrder: 1 },
      { serviceId: "peel", name: "Peeling", durationMin: 15, priceCents: 2000, clientPackageId: null, sortOrder: 2 },
    ]);
  });

  it("le voci di servizi eliminati si tolgono se non sono in keep", () => {
    expect(mergeItems(existing, [listino.viso]).map((i) => [i.name, i.priceCents])).toEqual([["Pulizia viso", 4000]]);
    expect(mergeItems(existing, [])).toEqual([]);
  });
});

describe("indirizzo delle pagine Nuovo / Sposta / Servizi", () => {
  it("andata e ritorno", () => {
    const query = pickerQuery({
      client: "c1",
      services: ["a", "b"],
      keep: ["i3"],
      month: "2026-11",
      day: "2026-11-03",
      time: "09:30",
      noBuffer: true,
      outside: true,
    });
    expect(query).toBe("?cliente=c1&s=a,b&v=i3&mese=2026-11&giorno=2026-11-03&ora=09:30&pausa=no&fuori=1");
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));
    expect(parsePickerParams(params)).toEqual({
      client: "c1",
      q: "",
      services: ["a", "b"],
      keep: ["i3"],
      month: "2026-11",
      day: "2026-11-03",
      time: "09:30",
      noBuffer: true,
      outside: true,
    });
  });

  it("valori sbagliati ignorati; 's=' vuoto solo se richiesto", () => {
    expect(parsePickerParams({ cliente: "<x>", mese: "2026-13", giorno: "2026-02-30", ora: "25:00", pausa: "boh" })).toMatchObject({
      client: null,
      month: null,
      day: null,
      time: null,
      noBuffer: null,
      outside: false,
    });
    expect(pickerQuery({ services: [] })).toBe("");
    expect(pickerQuery({ services: [] }, true)).toBe("?s=");
  });
});
