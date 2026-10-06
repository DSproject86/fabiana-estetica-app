import { describe, expect, it } from "vitest";
import { newPasswordProblem } from "./account";
import { afterFailedAttempt, isLocked } from "./lockout";

describe("nuova password", () => {
  it("almeno 10 caratteri, diversa dall'attuale, confermata", () => {
    expect(newPasswordProblem("vecchia-password", "corta", "corta")).toMatchObject({ field: "next" });
    expect(newPasswordProblem("stessa-password", "stessa-password", "stessa-password")).toMatchObject({ field: "next" });
    expect(newPasswordProblem("vecchia-password", "nuova-password", "nuova-passw0rd")).toMatchObject({ field: "confirm" });
    expect(newPasswordProblem("vecchia-password", "nuova-password", "nuova-password")).toBeNull();
    expect(newPasswordProblem("vecchia-password", "1234567890", "1234567890")).toBeNull();
  });
});

describe("blocco dopo troppi errori", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  it("al quinto errore 15 minuti di blocco", () => {
    expect(afterFailedAttempt(3, now)).toEqual({ failedLoginCount: 4, lockedUntil: null });
    const locked = afterFailedAttempt(4, now);
    expect(locked.failedLoginCount).toBe(0);
    expect(locked.lockedUntil?.toISOString()).toBe("2026-10-06T10:15:00.000Z");
    expect(isLocked(locked.lockedUntil, new Date("2026-10-06T10:14:59Z"))).toBe(true);
    expect(isLocked(locked.lockedUntil, new Date("2026-10-06T10:15:00Z"))).toBe(false);
  });
});
