import { describe, expect, it } from "vitest";
import { bookingQuery, parseBookingParams } from "./params";

describe("parametri della prenotazione", () => {
  it("legge i parametri validi", () => {
    expect(
      parseBookingParams({ s: "a1,b2,a1", mese: "2026-11", giorno: "2026-11-03", ora: "9:30", errore: "preso" }),
    ).toEqual({ services: ["a1", "b2"], month: "2026-11", day: "2026-11-03", time: "09:30", error: "preso" });
  });

  it("ignora quelli sbagliati senza errori", () => {
    expect(
      parseBookingParams({ s: "ok,<script>,", mese: "2026-13", giorno: "2026-02-30", ora: "25:00", errore: "boh" }),
    ).toEqual({ services: ["ok"], month: null, day: null, time: null, error: null });
    expect(parseBookingParams({})).toEqual({ services: [], month: null, day: null, time: null, error: null });
  });

  it("costruisce un indirizzo leggibile", () => {
    expect(bookingQuery({ services: ["a", "b"], day: "2026-11-03", time: "09:30" })).toBe("?s=a,b&giorno=2026-11-03&ora=09:30");
    expect(bookingQuery({})).toBe("");
  });
});
