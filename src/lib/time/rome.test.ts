import { describe, expect, it } from "vitest";
import {
  addDays,
  dayBounds,
  dayKeyOf,
  dayKeyToDbDate,
  dbDateToDayKey,
  formatDayShort,
  formatTime,
  instantAt,
  minuteOfDayOf,
  minutesToTime,
  timeToMinutes,
  weekdayOf,
} from "./rome";

const HOUR = 3_600_000;

describe("instantAt: ora di Roma → istante UTC", () => {
  it("in inverno Roma è UTC+1", () => {
    expect(instantAt("2026-01-15", 9 * 60).toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("in estate Roma è UTC+2", () => {
    expect(instantAt("2026-07-15", 9 * 60).toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("1440 è la mezzanotte del giorno dopo", () => {
    expect(instantAt("2026-07-15", 1440).toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });
});

describe.each([
  // [giorno del cambio, giorno prima, giorno dopo, durata del giorno in ore]
  ["2026-03-29", "2026-03-28", "2026-03-30", 23], // ultima domenica di marzo 2026
  ["2026-10-25", "2026-10-24", "2026-10-26", 25], // ultima domenica di ottobre 2026
  ["2027-03-28", "2027-03-27", "2027-03-29", 23],
  ["2027-10-31", "2027-10-30", "2027-11-01", 25],
])("cambio d'ora del %s", (change, before, after, hours) => {
  it(`il giorno dura ${hours} ore`, () => {
    const { start, end } = dayBounds(change);
    expect((end.getTime() - start.getTime()) / HOUR).toBe(hours);
  });

  it("una fascia 9:00–13:00 resta 9:00–13:00 ora italiana prima, durante e dopo", () => {
    for (const day of [before, change, after]) {
      const start = instantAt(day, 9 * 60);
      const end = instantAt(day, 13 * 60);
      expect(formatTime(start)).toBe("09:00");
      expect(formatTime(end)).toBe("13:00");
      expect((end.getTime() - start.getTime()) / HOUR).toBe(4);
      expect(dayKeyOf(start)).toBe(day);
      expect(minuteOfDayOf(start)).toBe(540);
    }
  });

  it("l'offset UTC cambia tra il giorno prima e il giorno dopo", () => {
    const offsetBefore = instantAt(before, 540).getUTCHours();
    const offsetAfter = instantAt(after, 540).getUTCHours();
    expect(Math.abs(offsetBefore - offsetAfter)).toBe(1);
  });

  it("addDays attraversa il cambio senza saltare o ripetere giorni", () => {
    expect(addDays(before, 1)).toBe(change);
    expect(addDays(change, 1)).toBe(after);
    expect(addDays(after, -2)).toBe(before);
  });
});

describe("ore notturne del cambio d'ora", () => {
  it("marzo: le 02:30 non esistono e diventano 03:30", () => {
    expect(formatTime(instantAt("2026-03-29", 150))).toBe("03:30");
  });

  it("ottobre: le 02:30 esistono due volte, si usa la prima (ora legale)", () => {
    expect(instantAt("2026-10-25", 150).toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });
});

describe("giorni e formattazione", () => {
  it("dayKeyOf usa la data di Roma, non quella UTC", () => {
    // 23:30 UTC del 14 luglio = 01:30 del 15 luglio a Roma
    expect(dayKeyOf(new Date("2026-07-14T23:30:00Z"))).toBe("2026-07-15");
  });

  it("weekdayOf: 1 = lunedì, 7 = domenica", () => {
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(weekdayOf("2026-10-11")).toBe(7);
  });

  it("colonne @db.Date", () => {
    expect(dayKeyToDbDate("2026-10-25").toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(dbDateToDayKey(new Date("2026-10-25T00:00:00.000Z"))).toBe("2026-10-25");
  });

  it("orari e date in italiano", () => {
    expect(minutesToTime(570)).toBe("09:30");
    expect(timeToMinutes("9:30")).toBe(570);
    expect(timeToMinutes("19:05")).toBe(1145);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("abc")).toBeNull();
    expect(formatDayShort("2026-10-12")).toBe("lun 12 ott");
  });
});
