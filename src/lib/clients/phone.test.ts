import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["3331234567", "+393331234567"],
    ["333 123 4567", "+393331234567"],
    ["333-123.4567", "+393331234567"],
    ["(333) 1234567", "+393331234567"],
    ["+39 333 1234567", "+393331234567"],
    ["+39 (333) 123-4567", "+393331234567"],
    ["0039 333 1234567", "+393331234567"],
    ["39 333 1234567", "+393331234567"],
    ["393331234567", "+393331234567"],
    ["  333123456 ", "+39333123456"], // vecchi cellulari a 9 cifre
    ["06 1234567", "+39061234567"], // fisso
    ["+41 79 123 45 67", "+41791234567"], // estero
    ["0041791234567", "+41791234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "333 12", "1234567890", "+39 12345", "333123456789012", "333 123 4567 int. 2", "+0123456789"])(
    "rifiuta %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("formatPhone", () => {
  it("spazia i cellulari italiani e lascia gli altri come sono", () => {
    expect(formatPhone("+393331234567")).toBe("+39 333 123 4567");
    expect(formatPhone("+39333123456")).toBe("+39 333 123 456");
    expect(formatPhone("+41791234567")).toBe("+41791234567");
  });
});
