import { describe, expect, it } from "vitest";
import { effectiveDay, type WeeklySlotRow } from "@/lib/schedule/effective";
import { addMonths, formatTime, instantAt, type DayKey } from "@/lib/time/rome";
import { bookingDuration, roundUpTo } from "./duration";
import { availableDays, isSlotAvailable, slotsForDay, type BookingLimits, type SlotQuery } from "./engine";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const NO_LIMITS: BookingLimits = { earliestStart: null, lastDay: null };
const MON = "2026-10-12"; // lunedì

const day = (slots: [number, number][], key: DayKey = MON) => ({
  day: key,
  slots: slots.map(([startMinute, endMinute]) => ({ startMinute, endMinute })),
});
const q = (durationMin: number, extra: Partial<SlotQuery> = {}): SlotQuery => ({
  durationMin,
  bufferMin: 30,
  gridMin: 30,
  limits: NO_LIMITS,
  ...extra,
});
const times = (slots: Date[]) => slots.map(formatTime);
/** Appuntamento esistente: endsAt include già la sua pausa. */
const appt = (start: number, durationMin: number, bufferMin = 30, key: DayKey = MON) => ({
  startsAt: instantAt(key, start),
  endsAt: instantAt(key, start + durationMin + bufferMin),
});
const block = (start: number, end: number, key: DayKey = MON) => ({
  startsAt: instantAt(key, start),
  endsAt: instantAt(key, end),
});

describe("durata", () => {
  it("65 minuti con arrotondamento 30 → 90", () => {
    expect(bookingDuration([45, 20], 30, 30)).toEqual({ rawMin: 65, durationMin: 90, bufferMin: 30 });
  });

  it("una somma già multipla non cambia; arrotondamento 5", () => {
    expect(roundUpTo(60, 30)).toBe(60);
    expect(roundUpTo(61, 5)).toBe(65);
  });

  it("la durata arrotondata si usa nel calendario: 65 min in una fascia di 90 occupa tutta la fascia", () => {
    const { durationMin } = bookingDuration([65], 30, 30);
    expect(times(slotsForDay(day([[h(9), h(10, 30)]]), [], [], q(durationMin)))).toEqual(["09:00"]);
    expect(times(slotsForDay(day([[h(9), h(10, 20)]]), [], [], q(durationMin)))).toEqual([]);
  });
});

describe("griglia e fasce", () => {
  it("inizi ogni 30 minuti dall'inizio della fascia", () => {
    expect(times(slotsForDay(day([[h(9), h(11)]]), [], [], q(30)))).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("la griglia parte dall'inizio della fascia (9:15 → 9:15, 9:45…)", () => {
    expect(times(slotsForDay(day([[h(9, 15), h(10, 45)]]), [], [], q(30)))).toEqual(["09:15", "09:45", "10:15"]);
  });

  it("fascia che finisce esattamente col trattamento: l'ultimo inizio è valido", () => {
    // 9:00–13:00, trattamento 60: l'ultimo inizio è 12:00 (finisce alle 13:00 in punto)
    const result = times(slotsForDay(day([[h(9), h(13)]]), [], [], q(60)));
    expect(result.at(-1)).toBe("12:00");
    expect(result).not.toContain("12:30");
  });

  it("la pausa non serve a fine giornata", () => {
    // con pausa 30 l'appuntamento delle 12:00 finirebbe (pausa compresa) alle 13:30: va bene lo stesso
    expect(times(slotsForDay(day([[h(9), h(13)]]), [], [], q(60, { bufferMin: 30 }))).at(-1)).toBe("12:00");
    expect(times(slotsForDay(day([[h(9), h(13)]]), [], [], q(60, { bufferMin: 120 }))).at(-1)).toBe("12:00");
  });

  it("due fasce nella stessa giornata (pausa pranzo): niente orari a cavallo", () => {
    const result = times(slotsForDay(day([[h(9), h(13)], [h(15), h(19, 30)]]), [], [], q(60)));
    expect(result).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
      "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    ]);
  });

  it("servizio più lungo di ogni fascia: nessun orario", () => {
    expect(slotsForDay(day([[h(9), h(11)], [h(15), h(17)]]), [], [], q(150))).toEqual([]);
  });

  it("giorno chiuso da eccezione: nessun orario", () => {
    const weekly: WeeklySlotRow[] = [{ weekday: 1, startMinute: h(9), endMinute: h(13) }];
    const closed = effectiveDay(MON, weekly, [{ id: "x", day: MON, closed: true, note: "ferie", slots: [] }], []);
    expect(slotsForDay(closed, [], [], q(60))).toEqual([]);
    // senza eccezione lo stesso giorno ha orari
    expect(slotsForDay(effectiveDay(MON, weekly, [], []), [], [], q(60)).length).toBeGreaterThan(0);
  });
});

describe("appuntamenti esistenti", () => {
  it("la pausa di un appuntamento esistente blocca l'orario successivo", () => {
    // esistente 9:00–10:00 + pausa 30 → occupato fino alle 10:30
    const result = times(slotsForDay(day([[h(9), h(13)]]), [], [appt(h(9), 60)], q(60)));
    expect(result).not.toContain("10:00");
    expect(result[0]).toBe("10:30");
  });

  it("anche la pausa del nuovo appuntamento non può finire su uno esistente", () => {
    // esistente alle 11:00: un nuovo 60 min alle 10:00 finirebbe alle 11:00 ma la sua pausa arriva alle 11:30
    const result = times(slotsForDay(day([[h(9), h(13)]]), [], [appt(h(11), 60)], q(60)));
    expect(result).toContain("09:30"); // 9:30–10:30 + pausa fino alle 11:00: tocca soltanto
    expect(result).not.toContain("10:00");
  });

  it("con pausa 0 gli appuntamenti possono essere attaccati", () => {
    const result = times(slotsForDay(day([[h(9), h(13)]]), [], [appt(h(9), 60, 0)], q(60, { bufferMin: 0 })));
    expect(result[0]).toBe("10:00");
  });
});

describe("blocchi", () => {
  it("blocco in mezzo alla mattina", () => {
    const result = times(slotsForDay(day([[h(9), h(13)]]), [block(h(10, 30), h(11, 30))], [], q(60)));
    expect(result).toEqual(["09:00", "09:30", "11:30", "12:00"]);
  });

  it("un blocco che inizia esattamente alla fine del trattamento non dà fastidio (nemmeno alla pausa)", () => {
    const result = times(slotsForDay(day([[h(9), h(13)]]), [block(h(10), h(13))], [], q(60)));
    expect(result).toEqual(["09:00"]); // 9:00–10:00, la pausa può cadere nel blocco
  });
});

describe("limiti di tempo", () => {
  it("preavviso minimo oggi: niente orari prima di adesso + preavviso", () => {
    const now = instantAt(MON, h(10, 10));
    const earliestStart = new Date(now.getTime() + 60 * 60_000); // 11:10
    const result = times(slotsForDay(day([[h(9), h(13)]]), [], [], q(30, { limits: { earliestStart, lastDay: null } })));
    expect(result).toEqual(["11:30", "12:00", "12:30"]);
  });

  it("limite dei 3 mesi: l'ultimo giorno prenotabile è incluso, il successivo no", () => {
    const today = "2026-10-06";
    const lastDay = addMonths(today, 3); // 2027-01-06
    const limits = { earliestStart: null, lastDay };
    expect(slotsForDay(day([[h(9), h(13)]], "2027-01-06"), [], [], q(60, { limits })).length).toBeGreaterThan(0);
    expect(slotsForDay(day([[h(9), h(13)]], "2027-01-07"), [], [], q(60, { limits }))).toEqual([]);
  });
});

describe("cambio d'ora legale", () => {
  it.each([
    ["2026-03-29", "+02:00"], // domenica in cui si passa all'ora legale
    ["2026-10-25", "+01:00"], // domenica in cui si torna all'ora solare
  ])("il %s gli orari restano in ora italiana", (key, offset) => {
    const result = slotsForDay(day([[h(9), h(11)]], key), [], [], q(60));
    expect(times(result)).toEqual(["09:00", "09:30", "10:00"]);
    expect(result[0].toISOString()).toBe(new Date(`${key}T09:00:00${offset}`).toISOString());
  });

  it("un appuntamento la sera prima del cambio non tocca il mattino dopo", () => {
    const sat = "2026-10-24";
    const sun = "2026-10-25";
    const existing = appt(h(18), 60, 30, sat);
    expect(times(slotsForDay(day([[h(9), h(10)]], sun), [], [existing], q(60)))).toEqual(["09:00"]);
  });
});

describe("isSlotAvailable e availableDays", () => {
  it("riconosce solo inizi esatti della griglia", () => {
    const d = day([[h(9), h(13)]]);
    expect(isSlotAvailable(instantAt(MON, h(9, 30)), d, [], [], q(60))).toBe(true);
    expect(isSlotAvailable(instantAt(MON, h(9, 15)), d, [], [], q(60))).toBe(false);
  });

  it("restituisce solo i giorni con almeno un orario libero", () => {
    const days = [
      day([[h(9), h(10)]], "2026-10-12"), // pieno per l'appuntamento sotto
      day([], "2026-10-13"), // chiuso
      day([[h(9), h(10)]], "2026-10-14"), // libero
    ];
    const busy = [appt(h(9), 60, 0, "2026-10-12")];
    expect(availableDays(days, [], busy, q(60))).toEqual(["2026-10-14"]);
  });
});
