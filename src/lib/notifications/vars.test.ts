import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import { appointmentVars, formatDateIt, formatDateTimeIt, sampleAppointment } from "./vars";

const business = { address: "Via Roma 1, Roma", whatsapp: null, replyTo: null, appUrl: "https://prenota.example.it" };

describe("date in italiano", () => {
  it("martedì 14 ottobre alle 10:30", () => {
    expect(formatDateTimeIt(new Date("2025-10-14T08:30:00Z"))).toBe("martedì 14 ottobre alle 10:30");
  });

  it("ora di Roma anche d'inverno e di notte in UTC", () => {
    expect(formatDateTimeIt(new Date("2026-12-31T23:30:00Z"))).toBe("venerdì 1 gennaio alle 00:30");
    expect(formatDateIt(instantAt("2026-03-29", 9 * 60))).toBe("domenica 29 marzo");
  });
});

describe("appointmentVars", () => {
  it("riempie tutti i segnaposto degli appuntamenti", () => {
    const vars = appointmentVars(
      {
        id: "a1",
        startsAt: instantAt("2026-10-14", 10 * 60 + 30),
        durationMin: 90,
        totalPriceCents: 6550,
        items: [{ name: "Pulizia viso" }, { name: "Manicure" }],
        client: { firstName: "Anna", lastName: "Verdi" },
      },
      business,
    );
    expect(vars).toEqual({
      nome: "Anna",
      cognome: "Verdi",
      data: "mercoledì 14 ottobre",
      ora: "10:30",
      servizi: "Pulizia viso, Manicure",
      durata: "1 h 30 min",
      totale: "65,50 €",
      indirizzo: "Via Roma 1, Roma",
      link: "https://prenota.example.it/appuntamenti",
    });
  });

  it("esempio per l'anteprima: dopodomani alle 10:30", () => {
    const sample = sampleAppointment(new Date("2026-10-06T20:00:00Z"));
    expect(formatDateTimeIt(sample.startsAt)).toBe("giovedì 8 ottobre alle 10:30");
  });
});
