import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import {
  appointmentsInBlock,
  appointmentsOutsideSlots,
  effectiveDay,
  type AppointmentForCheck,
  type WeeklySlotRow,
} from "./effective";
import { validateSlots } from "./slots";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("validateSlots", () => {
  it("accetta fasce corrette, anche non in ordine", () => {
    expect(validateSlots([{ startMinute: h(15), endMinute: h(19, 30) }, { startMinute: h(9), endMinute: h(13) }])).toBeNull();
    expect(validateSlots([])).toBeNull();
  });

  it("accetta fasce che si toccano", () => {
    expect(validateSlots([{ startMinute: h(9), endMinute: h(13) }, { startMinute: h(13), endMinute: h(14) }])).toBeNull();
  });

  it("rifiuta sovrapposizioni", () => {
    expect(validateSlots([{ startMinute: h(9), endMinute: h(13) }, { startMinute: h(12), endMinute: h(15) }])).toMatch(/sovrappongono/);
  });

  it("rifiuta fine prima dell'inizio, passi non da 5 minuti, troppe fasce", () => {
    expect(validateSlots([{ startMinute: h(13), endMinute: h(9) }])).toMatch(/finisce prima/);
    expect(validateSlots([{ startMinute: h(9, 3), endMinute: h(13) }])).toMatch(/passi di 5/);
    const many = Array.from({ length: 7 }, (_, i) => ({ startMinute: h(8 + i), endMinute: h(8 + i, 30) }));
    expect(validateSlots(many)).toMatch(/Al massimo/);
  });
});

const weekly: WeeklySlotRow[] = [
  // lunedì 9–13 e 15–19:30, domenica chiuso
  { weekday: 1, startMinute: h(15), endMinute: h(19, 30) },
  { weekday: 1, startMinute: h(9), endMinute: h(13) },
  { weekday: 6, startMinute: h(9), endMinute: h(13) },
];

describe("effectiveDay", () => {
  it("usa la settimana tipo, con le fasce in ordine", () => {
    const d = effectiveDay("2026-10-12", weekly, [], []); // lunedì
    expect(d.source).toBe("weekly");
    expect(d.slots).toEqual([
      { startMinute: h(9), endMinute: h(13) },
      { startMinute: h(15), endMinute: h(19, 30) },
    ]);
    expect(d.intervals[0].start.toISOString()).toBe("2026-10-12T07:00:00.000Z");
  });

  it("un giorno senza fasce è chiuso", () => {
    expect(effectiveDay("2026-10-11", weekly, [], []).slots).toEqual([]); // domenica
  });

  it("l'eccezione sostituisce la settimana tipo", () => {
    const overrides = [
      { id: "x", day: "2026-10-12", closed: false, note: "pomeriggio libero", slots: [{ startMinute: h(10), endMinute: h(12) }] },
      { id: "y", day: "2026-10-17", closed: true, note: "ferie", slots: [{ startMinute: h(9), endMinute: h(13) }] },
    ];
    expect(effectiveDay("2026-10-12", weekly, overrides, []).slots).toEqual([{ startMinute: h(10), endMinute: h(12) }]);
    const closed = effectiveDay("2026-10-17", weekly, overrides, []);
    expect(closed.source).toBe("exception");
    expect(closed.slots).toEqual([]); // "chiuso" vince anche se ci sono fasce salvate
    expect(closed.exception?.note).toBe("ferie");
  });

  it("raccoglie solo i blocchi che toccano il giorno", () => {
    const blocks = [
      { id: "b1", startsAt: instantAt("2026-10-12", h(11)), endsAt: instantAt("2026-10-12", h(12)), reason: null },
      { id: "b2", startsAt: instantAt("2026-10-13", h(11)), endsAt: instantAt("2026-10-13", h(12)), reason: null },
    ];
    expect(effectiveDay("2026-10-12", weekly, [], blocks).blocks.map((b) => b.id)).toEqual(["b1"]);
  });

  it("nel giorno del cambio d'ora le fasce restano in ora italiana", () => {
    const sundayWeekly: WeeklySlotRow[] = [{ weekday: 7, startMinute: h(9), endMinute: h(13) }];
    const d = effectiveDay("2026-10-25", sundayWeekly, [], []);
    expect(d.intervals[0].start.toISOString()).toBe("2026-10-25T08:00:00.000Z"); // già ora solare (UTC+1)
    expect(d.intervals[0].end.getTime() - d.intervals[0].start.getTime()).toBe(4 * 3_600_000);
  });
});

describe("conflitti con appuntamenti già presi", () => {
  const appt = (id: string, day: string, start: number, durationMin: number): AppointmentForCheck => ({
    id,
    startsAt: instantAt(day, start),
    durationMin,
  });
  const day = "2026-10-12";
  const appointments = [
    appt("mattina", day, h(9), 60), // 9–10
    appt("fine-mattina", day, h(12), 60), // 12–13: finisce esattamente alla chiusura
    appt("pomeriggio", day, h(16), 90), // 16–17:30
  ];

  it("nessun conflitto se tutto sta nelle fasce (la fine può coincidere con la chiusura)", () => {
    const slots = [{ startMinute: h(9), endMinute: h(13) }, { startMinute: h(15), endMinute: h(19, 30) }];
    expect(appointmentsOutsideSlots(appointments, slots)).toEqual([]);
  });

  it("eccezione 'chiuso tutto il giorno': tutti in conflitto", () => {
    expect(appointmentsOutsideSlots(appointments, []).map((a) => a.id)).toEqual(["mattina", "fine-mattina", "pomeriggio"]);
  });

  it("eccezione con orario ridotto: solo chi esce dalle fasce", () => {
    const slots = [{ startMinute: h(9), endMinute: h(12, 30) }, { startMinute: h(15), endMinute: h(17) }];
    expect(appointmentsOutsideSlots(appointments, slots).map((a) => a.id)).toEqual(["fine-mattina", "pomeriggio"]);
  });

  it("un appuntamento a cavallo di due fasce non sta in nessuna", () => {
    const slots = [{ startMinute: h(9), endMinute: h(10) }, { startMinute: h(10), endMinute: h(13) }];
    expect(appointmentsOutsideSlots([appt("a", day, h(9, 30), 60)], slots).map((a) => a.id)).toEqual(["a"]);
  });

  it("blocco: conflitto solo se si sovrappone al trattamento (i bordi che si toccano vanno bene)", () => {
    const block = { startsAt: instantAt(day, h(10)), endsAt: instantAt(day, h(12)) };
    expect(appointmentsInBlock(appointments, block)).toEqual([]);
    const block2 = { startsAt: instantAt(day, h(9, 30)), endsAt: instantAt(day, h(12, 30)) };
    expect(appointmentsInBlock(appointments, block2).map((a) => a.id)).toEqual(["mattina", "fine-mattina"]);
  });
});
