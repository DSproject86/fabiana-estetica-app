import { describe, expect, it } from "vitest";
import { formatNotice, settingsSchema } from "./schema";

const valid = {
  slotGridMin: "30",
  durationRoundingMin: "30",
  bufferMin: "30",
  minNoticeMin: "60",
  bookingHorizonMonths: "3",
  reminderHour: "18",
};

describe("settingsSchema", () => {
  it("accetta i valori di default (arrivano come testo dal modulo)", () => {
    expect(settingsSchema.parse(valid)).toEqual({
      slotGridMin: 30,
      durationRoundingMin: 30,
      bufferMin: 30,
      minNoticeMin: 60,
      bookingHorizonMonths: 3,
      reminderHour: 18,
    });
  });

  it("accetta pausa 0 e preavviso 0", () => {
    expect(settingsSchema.safeParse({ ...valid, bufferMin: "0", minNoticeMin: "0" }).success).toBe(true);
  });

  it.each([
    ["slotGridMin", "25"],
    ["durationRoundingMin", "7"],
    ["bufferMin", "33"],
    ["bufferMin", "125"],
    ["minNoticeMin", "-60"],
    ["bookingHorizonMonths", "13"],
    ["reminderHour", "23"],
    ["reminderHour", "abc"],
  ])("rifiuta %s = %s", (key, value) => {
    expect(settingsSchema.safeParse({ ...valid, [key]: value }).success).toBe(false);
  });

  it("formatta il preavviso", () => {
    expect(formatNotice(0)).toBe("Nessun preavviso");
    expect(formatNotice(30)).toBe("30 minuti");
    expect(formatNotice(60)).toBe("1 ora");
    expect(formatNotice(2880)).toBe("48 ore");
  });
});
