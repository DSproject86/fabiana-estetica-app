import { describe, expect, it } from "vitest";
import { centsToInput, formatEuro, parseEuroToCents } from "./money";

describe("parseEuroToCents", () => {
  it.each([
    ["35", 3500],
    ["35,5", 3550],
    ["35,50", 3550],
    ["35.50", 3550],
    [" € 40 ", 4000],
    ["1.200,00", 120000],
    ["0", 0],
    ["0,99", 99],
  ])("%s → %i", (input, expected) => {
    expect(parseEuroToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "35,555", "35,", "1,2,3", "10000000,01"])("rifiuta %j", (input) => {
    expect(parseEuroToCents(input)).toBeNull();
  });
});

describe("formatEuro / centsToInput", () => {
  it("formatta in italiano", () => {
    expect(formatEuro(3550).replace(/\s/g, " ")).toBe("35,50 €");
    expect(formatEuro(4000).replace(/\s/g, " ")).toBe("40 €");
  });

  it("prepara il valore per i campi", () => {
    expect(centsToInput(3550)).toBe("35,50");
    expect(centsToInput(3505)).toBe("35,05");
    expect(centsToInput(4000)).toBe("40");
  });
});
