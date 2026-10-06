import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import type { EmailMessage } from "@/lib/email/send";
import { composeAdminNewBooking, composeEmail } from "./compose";
import { appointmentInfoSelect, loadBusinessInfo, loadTemplate, type AppointmentWithClient } from "./context";
import { deliverEmail, type DeliverResult } from "./deliver";
import { buildIcs } from "./ics";
import type { BusinessInfo } from "./vars";

/**
 * Email legate a un appuntamento. Ogni funzione registra l'invio in NotificationLog e non lancia
 * mai errori: un'email non partita non deve bloccare una prenotazione, una modifica o una cancellazione.
 */

type Outcome = DeliverResult | { ok: false; logId: null; skipped: "NO_EMAIL" | "NOT_FOUND" | "NOT_CONFIRMED" };

async function loadAppointment(appointmentId: string): Promise<AppointmentWithClient | null> {
  return prisma.appointment.findUnique({ where: { id: appointmentId }, select: appointmentInfoSelect });
}

export function icsAttachment(appointment: AppointmentWithClient, business: BusinessInfo, now: Date) {
  return {
    filename: "appuntamento.ics",
    content: buildIcs(appointment, business, { now }),
    contentType: "text/calendar; charset=utf-8; method=PUBLISH",
  };
}

async function safely(label: string, run: () => Promise<Outcome>): Promise<Outcome> {
  try {
    return await run();
  } catch (error) {
    console.error(`Email "${label}" non inviata:`, error);
    return { ok: false, logId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Conferma della prenotazione alla cliente, con il file .ics. */
export function sendBookingConfirmedEmail(appointmentId: string, now = new Date()): Promise<Outcome> {
  return safely("conferma", async () => {
    const appointment = await loadAppointment(appointmentId);
    if (!appointment) return { ok: false, logId: null, skipped: "NOT_FOUND" };
    if (appointment.status !== "CONFIRMED") return { ok: false, logId: null, skipped: "NOT_CONFIRMED" };
    if (!appointment.client.email) return { ok: false, logId: null, skipped: "NO_EMAIL" };
    const [business, template] = await Promise.all([loadBusinessInfo(), loadTemplate("BOOKING_CONFIRMED", "EMAIL")]);
    const content = composeEmail({ kind: "BOOKING_CONFIRMED", appointment }, template, business);
    return deliverEmail({
      kind: "BOOKING_CONFIRMED",
      clientId: appointment.client.id,
      appointmentId,
      message: { to: appointment.client.email, ...content, attachments: [icsAttachment(appointment, business, now)] },
    });
  });
}

/** Appuntamento modificato (da collegare all'agenda allo step 7): .ics aggiornato, stesso UID. */
export function sendAppointmentChangedEmail(
  appointmentId: string,
  previousStartsAt?: Date | null,
  now = new Date(),
): Promise<Outcome> {
  return safely("modifica", async () => {
    const appointment = await loadAppointment(appointmentId);
    if (!appointment) return { ok: false, logId: null, skipped: "NOT_FOUND" };
    if (appointment.status !== "CONFIRMED") return { ok: false, logId: null, skipped: "NOT_CONFIRMED" };
    if (!appointment.client.email) return { ok: false, logId: null, skipped: "NO_EMAIL" };
    const [business, template] = await Promise.all([loadBusinessInfo(), loadTemplate("APPOINTMENT_CHANGED", "EMAIL")]);
    const moved = previousStartsAt && previousStartsAt.getTime() !== appointment.startsAt.getTime();
    const content = composeEmail(
      { kind: "APPOINTMENT_CHANGED", appointment, previousStartsAt: moved ? previousStartsAt : null },
      template,
      business,
    );
    return deliverEmail({
      kind: "APPOINTMENT_CHANGED",
      clientId: appointment.client.id,
      appointmentId,
      message: { to: appointment.client.email, ...content, attachments: [icsAttachment(appointment, business, now)] },
    });
  });
}

/** Appuntamento cancellato (da collegare all'agenda allo step 7). */
export function sendAppointmentCancelledEmail(appointmentId: string): Promise<Outcome> {
  return safely("cancellazione", async () => {
    const appointment = await loadAppointment(appointmentId);
    if (!appointment) return { ok: false, logId: null, skipped: "NOT_FOUND" };
    if (!appointment.client.email) return { ok: false, logId: null, skipped: "NO_EMAIL" };
    const [business, template] = await Promise.all([loadBusinessInfo(), loadTemplate("APPOINTMENT_CANCELLED", "EMAIL")]);
    const content = composeEmail({ kind: "APPOINTMENT_CANCELLED", appointment }, template, business);
    return deliverEmail({
      kind: "APPOINTMENT_CANCELLED",
      clientId: appointment.client.id,
      appointmentId,
      message: { to: appointment.client.email, ...content },
    });
  });
}

/** Avviso agli admin con l'interruttore acceso, solo per le prenotazioni fatte dalle clienti. */
export async function notifyAdminsOfNewBooking(appointmentId: string): Promise<DeliverResult[]> {
  try {
    const appointment = await loadAppointment(appointmentId);
    if (!appointment || appointment.createdBy !== "CLIENT") return [];
    const [admins, business] = await Promise.all([
      prisma.admin.findMany({ where: { notifyNewBooking: true }, select: { email: true }, orderBy: { createdAt: "asc" } }),
      loadBusinessInfo(),
    ]);
    const content = composeAdminNewBooking(appointment, business);
    const results: DeliverResult[] = [];
    for (const admin of admins) {
      const message: EmailMessage = { to: admin.email, ...content, replyTo: appointment.client.email ?? undefined };
      results.push(await deliverEmail({ kind: "ADMIN_NEW_BOOKING", appointmentId, message }));
    }
    return results;
  } catch (error) {
    console.error("Avviso nuova prenotazione agli admin non inviato:", error);
    return [];
  }
}

/** Dopo la risposta alla cliente: conferma a lei, poi avviso agli admin. */
export function sendNewBookingEmailsInBackground(appointmentId: string) {
  after(async () => {
    await sendBookingConfirmedEmail(appointmentId);
    await notifyAdminsOfNewBooking(appointmentId);
  });
}
