import { DateTime } from "luxon";
import { addDays, dayKeyOf, TIME_ZONE, type DayKey } from "@/lib/time/rome";

/**
 * Regole del promemoria del giorno prima (modulo puro).
 * - Parte per gli appuntamenti CONFIRMED di domani, quando a Roma sono passate le `reminderHour`.
 * - Mai per le clienti senza email, né per gli appuntamenti prenotati lo stesso giorno in cui
 *   partirebbe il promemoria (cioè il giorno prima dell'appuntamento).
 * - Al massimo una volta: `reminderEmailSentAt` si segna prima dell'invio.
 */

/** Dopo quanto un invio rimasto "in corso" si considera interrotto (e si può riprovare). */
export const STALE_PENDING_MS = 10 * 60_000;

export function romeHour(now: Date): number {
  return DateTime.fromJSDate(now, { zone: TIME_ZONE }).hour;
}

/** Il giorno degli appuntamenti a cui si manda il promemoria oggi: domani. */
export function reminderTargetDay(now: Date): DayKey {
  return addDays(dayKeyOf(now), 1);
}

export function reminderWindowOpen(now: Date, reminderHour: number): boolean {
  return romeHour(now) >= reminderHour;
}

export type ReminderSubject = {
  startsAt: Date;
  createdAt: Date;
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW";
  clientEmail: string | null;
};

export type NotPlannedReason = "NO_EMAIL" | "BOOKED_SAME_DAY" | "NOT_CONFIRMED";

/** Perché questo appuntamento non avrà il promemoria email (null = è previsto). */
export function reminderNotPlannedReason(a: ReminderSubject): NotPlannedReason | null {
  if (a.status !== "CONFIRMED") return "NOT_CONFIRMED";
  if (!a.clientEmail) return "NO_EMAIL";
  const sendingDay = addDays(dayKeyOf(a.startsAt), -1);
  if (dayKeyOf(a.createdAt) === sendingDay) return "BOOKED_SAME_DAY";
  return null;
}

export const NOT_PLANNED_LABEL: Record<NotPlannedReason, string> = {
  NO_EMAIL: "Non prevista: la cliente non ha l'email",
  BOOKED_SAME_DAY: "Non prevista: prenotato oggi",
  NOT_CONFIRMED: "Non prevista",
};

export type ReminderLog = { status: "PENDING" | "SENT" | "FAILED" | "SKIPPED"; createdAt: Date; sentAt: Date | null; error: string | null };

export type ReminderEmailState =
  | { state: "SENT"; at: Date }
  | { state: "FAILED"; error: string }
  | { state: "SENDING" }
  | { state: "SCHEDULED"; hour: number } // partirà oggi alle …
  | { state: "DUE" } // l'ora è passata: parte al prossimo giro del cron
  | { state: "NOT_PLANNED"; reason: NotPlannedReason };

/** Stato dell'email di promemoria mostrato in "Promemoria di domani". */
export function reminderEmailState(
  a: ReminderSubject & { reminderEmailSentAt: Date | null },
  latestLog: ReminderLog | null,
  reminderHour: number,
  now: Date,
): ReminderEmailState {
  if (latestLog) {
    if (latestLog.status === "SENT") return { state: "SENT", at: latestLog.sentAt ?? latestLog.createdAt };
    if (latestLog.status === "PENDING") {
      return now.getTime() - latestLog.createdAt.getTime() > STALE_PENDING_MS
        ? { state: "FAILED", error: "Invio interrotto" }
        : { state: "SENDING" };
    }
    return { state: "FAILED", error: latestLog.error ?? "Errore sconosciuto" };
  }
  if (a.reminderEmailSentAt) return { state: "FAILED", error: "Invio interrotto" };

  const reason = reminderNotPlannedReason(a);
  if (reason) return { state: "NOT_PLANNED", reason };
  return reminderWindowOpen(now, reminderHour) ? { state: "DUE" } : { state: "SCHEDULED", hour: reminderHour };
}

/** "Riprova" ha senso solo per un invio non riuscito di un appuntamento ancora valido e futuro. */
export function canRetryReminder(state: ReminderEmailState, a: ReminderSubject, now: Date): boolean {
  return state.state === "FAILED" && a.status === "CONFIRMED" && !!a.clientEmail && a.startsAt > now;
}
