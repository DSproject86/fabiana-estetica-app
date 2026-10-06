import "server-only";
import { prisma } from "@/lib/db";
import { loadSettings } from "@/lib/availability/queries";
import { dayBounds, type DayKey } from "@/lib/time/rome";
import { composeEmail } from "./compose";
import { appointmentInfoSelect, loadBusinessInfo, loadTemplate, type AppointmentWithClient } from "./context";
import { deliverEmail } from "./deliver";
import {
  canRetryReminder,
  reminderEmailState,
  reminderNotPlannedReason,
  reminderTargetDay,
  reminderWindowOpen,
} from "./reminderRules";
import type { BusinessInfo } from "./vars";
import type { TemplateText } from "./defaults";

export type ReminderRunSummary = {
  day: DayKey; // giorno degli appuntamenti (domani)
  windowOpen: boolean; // a Roma è già l'ora del promemoria?
  reminderHour: number;
  sent: number;
  failed: number;
  alreadyHandled: number; // presi in carico da un'altra chiamata nel frattempo
  skippedNoEmail: number;
  skippedBookedSameDay: number;
  remaining: number; // da inviare al prossimo giro (tempo esaurito)
  stoppedEarly: boolean;
};

/**
 * Promemoria del giorno prima, chiamato ogni ora dal cron. Idempotente:
 * ogni appuntamento viene "preso in carico" con un aggiornamento condizionato
 * (reminderEmailSentAt da vuoto a adesso) nella stessa transazione che crea la riga di log.
 * Solo chi vince quell'aggiornamento invia: due chiamate, anche simultanee, non mandano mai due email.
 * Se l'invio fallisce non si riprova in automatico (resta "non riuscita", con "Riprova" dall'admin).
 *
 * `budgetMs`: oltre questo tempo non si prendono in carico altri appuntamenti; i rimanenti
 * partono alla chiamata dell'ora successiva.
 */
export async function runReminders({ now = new Date(), budgetMs = 45_000 }: { now?: Date; budgetMs?: number } = {}) {
  const startedAt = Date.now();
  const settings = await loadSettings();
  const day = reminderTargetDay(now);
  const summary: ReminderRunSummary = {
    day,
    windowOpen: reminderWindowOpen(now, settings.reminderHour),
    reminderHour: settings.reminderHour,
    sent: 0,
    failed: 0,
    alreadyHandled: 0,
    skippedNoEmail: 0,
    skippedBookedSameDay: 0,
    remaining: 0,
    stoppedEarly: false,
  };
  if (!summary.windowOpen) return summary;

  const { start, end } = dayBounds(day);
  const candidates = await prisma.appointment.findMany({
    where: { status: "CONFIRMED", reminderEmailSentAt: null, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    select: appointmentInfoSelect,
  });

  const due: AppointmentWithClient[] = [];
  for (const a of candidates) {
    const reason = reminderNotPlannedReason({ ...a, clientEmail: a.client.email });
    if (reason === "NO_EMAIL") summary.skippedNoEmail++;
    else if (reason === "BOOKED_SAME_DAY") summary.skippedBookedSameDay++;
    else if (!reason) due.push(a);
  }
  if (due.length === 0) return summary;

  const [business, template] = await Promise.all([loadBusinessInfo(), loadTemplate("REMINDER", "EMAIL")]);

  for (let i = 0; i < due.length; i++) {
    if (Date.now() - startedAt > budgetMs) {
      summary.remaining = due.length - i;
      summary.stoppedEarly = true;
      break;
    }
    const outcome = await claimAndSend(due[i], business, template, now);
    if (outcome === "claimed-by-other") summary.alreadyHandled++;
    else if (outcome === "sent") summary.sent++;
    else summary.failed++;
  }
  return summary;
}

async function claimAndSend(
  appointment: AppointmentWithClient,
  business: BusinessInfo,
  template: TemplateText,
  now: Date,
): Promise<"sent" | "failed" | "claimed-by-other"> {
  const email = appointment.client.email!;
  const logId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.appointment.updateMany({
      where: { id: appointment.id, status: "CONFIRMED", reminderEmailSentAt: null },
      data: { reminderEmailSentAt: now },
    });
    if (claimed.count !== 1) return null;
    const log = await tx.notificationLog.create({
      data: {
        channel: "EMAIL",
        kind: "REMINDER",
        provider: "resend",
        recipient: email,
        clientId: appointment.client.id,
        appointmentId: appointment.id,
        createdAt: now,
      },
      select: { id: true },
    });
    return log.id;
  });
  if (!logId) return "claimed-by-other";

  const content = composeEmail({ kind: "REMINDER", appointment }, template, business);
  const result = await deliverEmail({
    kind: "REMINDER",
    logId,
    clientId: appointment.client.id,
    appointmentId: appointment.id,
    message: { to: email, ...content },
  });
  return result.ok ? "sent" : "failed";
}

/** Ultimo tentativo di promemoria email di ogni appuntamento (per lo stato in "Promemoria di domani"). */
export async function latestReminderLogs(appointmentIds: string[]) {
  const logs = await prisma.notificationLog.findMany({
    where: { appointmentId: { in: appointmentIds }, kind: "REMINDER", channel: "EMAIL", isTest: false },
    orderBy: { createdAt: "desc" },
    select: { appointmentId: true, status: true, createdAt: true, sentAt: true, error: true },
  });
  const latest = new Map<string, (typeof logs)[number]>();
  for (const log of logs) if (log.appointmentId && !latest.has(log.appointmentId)) latest.set(log.appointmentId, log);
  return latest;
}

export type RetryResult = { ok: true } | { ok: false; error: string };

/**
 * "Riprova" su un promemoria non riuscito. La riga dell'appuntamento si blocca (FOR UPDATE)
 * mentre si controlla l'ultimo tentativo e si crea quello nuovo: due clic, o un clic insieme
 * al cron, non producono mai due email.
 */
export async function retryReminder(appointmentId: string, now = new Date()): Promise<RetryResult> {
  const settings = await loadSettings();
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${appointmentId} FOR UPDATE`;
    const appointment = await tx.appointment.findUnique({ where: { id: appointmentId }, select: appointmentInfoSelect });
    if (!appointment) return { error: "Appuntamento non trovato." } as const;
    const latest = await tx.notificationLog.findFirst({
      where: { appointmentId, kind: "REMINDER", channel: "EMAIL", isTest: false },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, sentAt: true, error: true },
    });
    const subject = { ...appointment, clientEmail: appointment.client.email };
    const state = reminderEmailState(subject, latest, settings.reminderHour, now);
    if (!canRetryReminder(state, subject, now)) {
      return { error: state.state === "SENT" ? "Il promemoria risulta già inviato." : "Non c'è niente da riprovare." } as const;
    }
    await tx.appointment.update({ where: { id: appointmentId }, data: { reminderEmailSentAt: appointment.reminderEmailSentAt ?? now } });
    if (latest?.status === "PENDING") {
      // Invio rimasto a metà: si chiude come fallito, così lo storico resta leggibile.
      await tx.notificationLog.updateMany({
        where: { appointmentId, kind: "REMINDER", channel: "EMAIL", status: "PENDING" },
        data: { status: "FAILED", error: "Invio interrotto" },
      });
    }
    const log = await tx.notificationLog.create({
      data: {
        channel: "EMAIL",
        kind: "REMINDER",
        provider: "resend",
        recipient: appointment.client.email!,
        clientId: appointment.client.id,
        appointmentId,
        createdAt: now,
      },
      select: { id: true },
    });
    return { appointment, logId: log.id } as const;
  });
  if ("error" in claim) return { ok: false, error: claim.error ?? "Non c'è niente da riprovare." };

  const [business, template] = await Promise.all([loadBusinessInfo(), loadTemplate("REMINDER", "EMAIL")]);
  const content = composeEmail({ kind: "REMINDER", appointment: claim.appointment }, template, business);
  const result = await deliverEmail({
    kind: "REMINDER",
    logId: claim.logId,
    clientId: claim.appointment.client.id,
    appointmentId,
    message: { to: claim.appointment.client.email!, ...content },
  });
  return result.ok ? { ok: true } : { ok: false, error: `Invio non riuscito: ${result.error ?? "errore sconosciuto"}` };
}
