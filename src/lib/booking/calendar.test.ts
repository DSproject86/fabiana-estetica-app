import { describe, expect, it } from "vitest";
import { addMonthsToMonth, formatMonth, monthGrid, monthRange } from "./calendar";

describe("calendario mensile", () => {
  it("ottobre 2026 inizia di giovedì: 3 celle vuote, 31 giorni", () => {
    const cells = monthGrid("2026-10", new Set(["2026-10-12"]), "2026-10-06");
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toEqual({ day: "2026-10-01", n: 1, available: false, today: false });
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.find((c) => c?.day === "2026-10-12")?.available).toBe(true);
    expect(cells.find((c) => c?.day === "2026-10-06")?.today).toBe(true);
  });

  it("febbraio 2027 inizia di lunedì e ha 28 giorni", () => {
    const cells = monthGrid("2027-02", new Set(), "2026-10-06");
    expect(cells[0]?.day).toBe("2027-02-01");
    expect(cells).toHaveLength(28);
  });

  it("mesi successivi, intervalli e nomi", () => {
    expect(addMonthsToMonth("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToMonth("2026-10", -1)).toBe("2026-09");
    expect(monthRange("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(formatMonth("2026-10")).toBe("ottobre 2026");
  });
});
