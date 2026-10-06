import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
    [125, "2 h 5 min"],
  ])("%i → %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});
