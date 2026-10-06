import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import { buildIcs, icsDate, icsEscape, icsFold, icsSequence } from "./ics";
import type { AppointmentInfo } from "./vars";

const business = { address: "Via Roma 1, 00100 Roma", whatsapp: null, replyTo: null, appUrl: "https://prenota.fabianaestetica.it" };
const NOW = new Date("2026-10-06T10:00:00Z");

const appointment = (day: string, minutes: number, durationMin = 90): AppointmentInfo => ({
  id: "cmabc123",
  startsAt: instantAt(day, minutes),
  durationMin,
  totalPriceCents: 6500,
  items: [{ name: "Pulizia viso" }, { name: "Manicure; semipermanente" }],
  client: { firstName: "Anna", lastName: "Verdi" },
});

const prop = (ics: string, name: string) =>
  ics
    .replace(/\r\n /g, "") // righe di continuazione
    .split("\r\n")
    .find((line) => line.startsWith(`${name}:`))
    ?.slice(name.length + 1);

describe("file .ics", () => {
  it("orari in UTC, fine = inizio + durata senza pausa", () => {
    const ics = buildIcs(appointment("2026-10-14", 10 * 60 + 30), business, { now: NOW });
    expect(prop(ics, "DTSTART")).toBe("20261014T083000Z"); // 10:30 ora legale = 08:30 UTC
    expect(prop(ics, "DTEND")).toBe("20261014T100000Z"); // + 90 minuti, la pausa non c'è
    expect(prop(ics, "UID")).toBe("cmabc123@prenota.fabianaestetica.it");
    expect(prop(ics, "DTSTAMP")).toBe("20261006T100000Z");
    expect(prop(ics, "LOCATION")).toBe("Via Roma 1\\, 00100 Roma");
    expect(prop(ics, "METHOD")).toBe("PUBLISH");
    expect(prop(ics, "SUMMARY")).toBe("Fabiana L. · Estetica – Pulizia viso\\, Manicure\\; semipermanente");
  });

  it("cambio d'ora: stessa ora di Roma, UTC diverso prima e dopo il 25 ottobre", () => {
    const before = buildIcs(appointment("2026-10-24", 10 * 60), business, { now: NOW });
    const after = buildIcs(appointment("2026-10-26", 10 * 60), business, { now: NOW });
    expect(prop(before, "DTSTART")).toBe("20261024T080000Z"); // UTC+2
    expect(prop(after, "DTSTART")).toBe("20261026T090000Z"); // UTC+1
    // Il giorno del cambio (25 ottobre, 25 ore) la fine si calcola in minuti reali.
    const sameDay = buildIcs(appointment("2026-10-25", 10 * 60, 60), business, { now: NOW });
    expect(prop(sameDay, "DTSTART")).toBe("20261025T090000Z");
    expect(prop(sameDay, "DTEND")).toBe("20261025T100000Z");
    // Marzo: dal 29/3 si passa a UTC+2.
    expect(prop(buildIcs(appointment("2026-03-28", 9 * 60), business, { now: NOW }), "DTSTART")).toBe("20260328T080000Z");
    expect(prop(buildIcs(appointment("2026-03-30", 9 * 60), business, { now: NOW }), "DTSTART")).toBe("20260330T070000Z");
  });

  it("senza indirizzo niente LOCATION; righe con CRLF", () => {
    const ics = buildIcs(appointment("2026-10-14", 600), { ...business, address: null }, { now: NOW });
    expect(prop(ics, "LOCATION")).toBeUndefined();
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });

  it("SEQUENCE cresce col tempo: la modifica aggiorna l'evento invece di duplicarlo", () => {
    const a = appointment("2026-10-14", 600);
    const first = Number(prop(buildIcs(a, business, { now: NOW }), "SEQUENCE"));
    const later = Number(prop(buildIcs(a, business, { now: new Date(NOW.getTime() + 60_000) }), "SEQUENCE"));
    expect(later).toBeGreaterThan(first);
    expect(icsSequence(new Date("2060-01-01T00:00:00Z"))).toBeLessThan(2 ** 31);
  });
});

describe("dettagli del formato", () => {
  it("icsDate e icsEscape", () => {
    expect(icsDate(new Date("2026-01-02T03:04:05.678Z"))).toBe("20260102T030405Z");
    expect(icsEscape("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("righe al massimo di 75 byte senza spezzare le lettere accentate", () => {
    const line = `DESCRIPTION:${"è".repeat(100)}`;
    const folded = icsFold(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});
