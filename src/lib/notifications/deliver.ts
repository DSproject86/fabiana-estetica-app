import "server-only";
import type { MessageKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail, type EmailMessage } from "@/lib/email/send";

/**
 * Unico punto da cui partono i messaggi automatici: registra l'invio in NotificationLog
 * (PENDING → SENT / FAILED / SKIPPED), chiama il fornitore e non lancia mai errori.
 * Per aggiungere la WhatsApp Cloud API basterà un ramo "WHATSAPP" con lo stesso schema.
 */

export type DeliverEmailInput = {
  kind: MessageKind;
  message: EmailMessage;
  clientId?: string | null;
  appointmentId?: string | null;
  isTest?: boolean;
  /** Riga PENDING già creata (es. promemoria "preso in carico" nella stessa transazione). */
  logId?: string;
};

export type DeliverResult = { ok: boolean; logId: string | null; error?: string; skipped?: boolean };

export async function deliverEmail(input: DeliverEmailInput): Promise<DeliverResult> {
  let logId = input.logId ?? null;
  let accepted = false; // il fornitore ha accettato l'email: mai segnarla come fallita
  try {
    if (!logId) {
      const log = await prisma.notificationLog.create({
        data: {
          channel: "EMAIL",
          kind: input.kind,
          provider: "resend",
          recipient: input.message.to,
          clientId: input.clientId ?? null,
          appointmentId: input.appointmentId ?? null,
          isTest: input.isTest ?? false,
        },
        select: { id: true },
      });
      logId = log.id;
    }

    const result = await sendEmail(input.message);
    accepted = result.ok;
    if (!result.ok) console.error(`Email ${input.kind} non inviata (log ${logId}): ${result.error}`);

    await prisma.notificationLog.update({
      where: { id: logId },
      data: result.ok
        ? { status: "SENT", sentAt: new Date(), providerMessageId: result.providerMessageId, provider: result.provider }
        : { status: result.skipped ? "SKIPPED" : "FAILED", error: result.error.slice(0, 500), provider: result.provider },
    });
    return result.ok ? { ok: true, logId } : { ok: false, logId, error: result.error, skipped: result.skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Email ${input.kind}: errore durante l'invio o la registrazione (log ${logId ?? "—"}):`, error);
    if (logId && !accepted) {
      await prisma.notificationLog
        .updateMany({ where: { id: logId, status: "PENDING" }, data: { status: "FAILED", error: message.slice(0, 500) } })
        .catch(() => undefined);
    }
    return { ok: accepted, logId, error: message };
  }
}
