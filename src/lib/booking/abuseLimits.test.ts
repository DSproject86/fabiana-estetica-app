import { describe, expect, it } from "vitest";
import { bookingLimitProblem } from "./abuseLimits";

describe("limiti anti-abuso", () => {
  it("sotto i limiti: si prenota", () => {
    expect(bookingLimitProblem({ recentBookings: 3, futureAppointments: 5 })).toBeNull();
  });
  it("4 prenotazioni in 24 ore", () => {
    expect(bookingLimitProblem({ recentBookings: 4, futureAppointments: 0 })).toBe("limite-giorno");
  });
  it("6 appuntamenti futuri (ha la precedenza)", () => {
    expect(bookingLimitProblem({ recentBookings: 4, futureAppointments: 6 })).toBe("limite-futuri");
  });
});
