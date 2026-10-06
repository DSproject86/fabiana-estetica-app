import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import {
  canRetryReminder,
  reminderEmailState,
  reminderNotPlannedReason,
  reminderTargetDay,
  reminderWindowOpen,
  romeHour,
} from "./reminderRules";

const at = (day: string, h: number, m = 0) => instantAt(day, h * 60 + m);

const base = {
  startsAt: at("2026-10-14", 10),
  createdAt: at("2026-10-10", 12),
  status: "CONFIRMED" as const,
  clientEmail: "anna@example.it",
  reminderEmailSentAt: null,
};

describe("quando parte", () => {
  it("ora di Roma ≥ reminderHour, anche col cambio d'ora", () => {
    expect(reminderWindowOpen(at("2026-10-13", 17, 59), 18)).toBe(false);
    expect(reminderWindowOpen(at("2026-10-13", 18), 18)).toBe(true);
    expect(reminderWindowOpen(at("2026-10-13", 23, 59), 18)).toBe(true);
    expect(romeHour(new Date("2026-10-13T16:00:00Z"))).toBe(18); // ora legale
    expect(romeHour(new Date("2026-11-13T16:00:00Z"))).toBe(17); // ora solare
  });

  it("per gli appuntamenti di domani (a Roma)", () => {
    expect(reminderTargetDay(at("2026-10-13", 18))).toBe("2026-10-14");
    expect(reminderTargetDay(new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-15"); // 00:30 a Roma del 14
    expect(reminderTargetDay(at("2026-10-24", 19))).toBe("2026-10-25"); // giorno di 25 ore
  });
});

describe("chi lo riceve", () => {
  it("previsto per gli appuntamenti confermati prenotati prima del giorno precedente", () => {
    expect(reminderNotPlannedReason(base)).toBeNull();
    expect(reminderNotPlannedReason({ ...base, createdAt: at("2026-10-12", 23, 59) })).toBeNull();
  });

  it("niente per chi non ha l'email", () => {
    expect(reminderNotPlannedReason({ ...base, clientEmail: null })).toBe("NO_EMAIL");
  });

  it("niente se prenotato lo stesso giorno in cui partirebbe (il giorno prima)", () => {
    expect(reminderNotPlannedReason({ ...base, createdAt: at("2026-10-13", 0, 5) })).toBe("BOOKED_SAME_DAY");
    expect(reminderNotPlannedReason({ ...base, createdAt: at("2026-10-13", 19) })).toBe("BOOKED_SAME_DAY");
  });

  it("niente per gli appuntamenti cancellati", () => {
    expect(reminderNotPlannedReason({ ...base, status: "CANCELLED" })).toBe("NOT_CONFIRMED");
  });
});

describe("stato dell'email (Promemoria di domani)", () => {
  const before = at("2026-10-13", 11);
  const after = at("2026-10-13", 18, 30);

  it("partirà alle 18 / al prossimo giro / non prevista", () => {
    expect(reminderEmailState(base, null, 18, before)).toEqual({ state: "SCHEDULED", hour: 18 });
    expect(reminderEmailState(base, null, 18, after)).toEqual({ state: "DUE" });
    expect(reminderEmailState({ ...base, clientEmail: null }, null, 18, after)).toEqual({ state: "NOT_PLANNED", reason: "NO_EMAIL" });
  });

  it("inviata, non riuscita, in invio, interrotta", () => {
    const sentAt = at("2026-10-13", 18, 2);
    const sent = { status: "SENT" as const, createdAt: sentAt, sentAt, error: null };
    expect(reminderEmailState(base, sent, 18, after)).toEqual({ state: "SENT", at: sentAt });
    const failed = { status: "FAILED" as const, createdAt: sentAt, sentAt: null, error: "HTTP 500" };
    expect(reminderEmailState(base, failed, 18, after)).toEqual({ state: "FAILED", error: "HTTP 500" });
    const pending = { status: "PENDING" as const, createdAt: sentAt, sentAt: null, error: null };
    expect(reminderEmailState(base, pending, 18, at("2026-10-13", 18, 5))).toEqual({ state: "SENDING" });
    expect(reminderEmailState(base, pending, 18, at("2026-10-13", 18, 30))).toEqual({ state: "FAILED", error: "Invio interrotto" });
    expect(reminderEmailState({ ...base, reminderEmailSentAt: sentAt }, null, 18, after).state).toBe("FAILED");
  });

  it("Riprova solo sulle non riuscite, per appuntamenti confermati e futuri", () => {
    const failed = { state: "FAILED" as const, error: "x" };
    expect(canRetryReminder(failed, base, after)).toBe(true);
    expect(canRetryReminder({ state: "SENDING" }, base, after)).toBe(false);
    expect(canRetryReminder(failed, { ...base, status: "CANCELLED" }, after)).toBe(false);
    expect(canRetryReminder(failed, base, at("2026-10-14", 11))).toBe(false);
  });
});
