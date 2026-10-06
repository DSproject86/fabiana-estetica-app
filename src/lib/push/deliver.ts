import "server-only";
import type { MessageKind } from "@prisma/client";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { vapidConfig, type VapidConfig } from "./config";
import { newBookingPush, type PushPayload } from "./payload";

/**
 * Invio delle notifiche push agli admin, con lo stesso schema delle email (deliver.ts):
 * ogni dispositivo ha la sua riga in NotificationLog (canale PUSH: PENDING → SENT / FAILED / SKIPPED)
 * e qui non si lancia mai un errore. Un abbonamento scaduto (404/410) viene eliminato.
 */

export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string; deviceName: string; admin: { email: string } };

/** Chi consegna davvero la notifica: web-push in produzione, una finta nei test. */
export type PushTransport = (
  target: PushTarget,
  body: string,
  vapid: VapidConfig,
) => Promise<{ statusCode: number }>;

const webPushTransport: PushTransport = (target, body, vapid) =>
  webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, body, {
    vapidDetails: vapid,
    TTL: 60 * 60 * 24, // se il telefono è spento, la notifica aspetta al massimo un giorno
    urgency: "high",
    timeout: 10_000,
  });

export type PushResult = { subscriptionId: string; status: "SENT" | "FAILED" | "SKIPPED"; expired?: boolean; error?: string };

export const EXPIRED_MESSAGE = "Abbonamento scaduto o revocato: dispositivo rimosso.";
export const NOT_CONFIGURED_MESSAGE = "Notifiche non inviate: mancano le chiavi VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).";

const targetSelect = {
  id: true,
  endpoint: true,
  p256dh: true,
  auth: true,
  deviceName: true,
  admin: { select: { email: true } },
} as const;

function statusCodeOf(error: unknown): number | null {
  const code = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" ? code : null;
}

export async function deliverPush(input: {
  targets: PushTarget[];
  payload: PushPayload;
  kind: MessageKind;
  appointmentId?: string | null;
  isTest?: boolean;
  transport?: PushTransport;
  vapid?: VapidConfig | null;
  now?: Date;
}): Promise<PushResult[]> {
  const transport = input.transport ?? webPushTransport;
  const vapid = input.vapid === undefined ? vapidConfig() : input.vapid;
  const body = JSON.stringify(input.payload);
  const results: PushResult[] = [];

  for (const target of input.targets) {
    let logId: string | null = null;
    try {
      const log = await prisma.notificationLog.create({
        data: {
          channel: "PUSH",
          kind: input.kind,
          provider: "web-push",
          recipient: `${target.admin.email} · ${target.deviceName}`,
          appointmentId: input.appointmentId ?? null,
          isTest: input.isTest ?? false,
        },
        select: { id: true },
      });
      logId = log.id;

      if (!vapid) {
        await prisma.notificationLog.update({ where: { id: logId }, data: { status: "SKIPPED", error: NOT_CONFIGURED_MESSAGE } });
        results.push({ subscriptionId: target.id, status: "SKIPPED", error: NOT_CONFIGURED_MESSAGE });
        continue;
      }

      try {
        await transport(target, body, vapid);
        const now = input.now ?? new Date();
        await prisma.notificationLog.update({ where: { id: logId }, data: { status: "SENT", sentAt: now } });
        await prisma.pushSubscription.updateMany({ where: { id: target.id }, data: { lastUsedAt: now } });
        results.push({ subscriptionId: target.id, status: "SENT" });
      } catch (error) {
        const code = statusCodeOf(error);
        const expired = code === 404 || code === 410;
        const message = expired
          ? EXPIRED_MESSAGE
          : `${code ? `Errore ${code}: ` : ""}${error instanceof Error ? error.message : String(error)}`.slice(0, 500);
        if (expired) await prisma.pushSubscription.deleteMany({ where: { id: target.id } });
        await prisma.notificationLog.update({ where: { id: logId }, data: { status: "FAILED", error: message } });
        console.error(`Push ${input.kind} non consegnata (log ${logId}): ${message}`);
        results.push({ subscriptionId: target.id, status: "FAILED", expired, error: message });
      }
    } catch (error) {
      // Errore del database o altro imprevisto: si registra se possibile e si passa al dispositivo dopo.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Push ${input.kind}: errore durante l'invio o la registrazione (log ${logId ?? "—"}):`, error);
      if (logId) {
        await prisma.notificationLog
          .updateMany({ where: { id: logId, status: "PENDING" }, data: { status: "FAILED", error: message.slice(0, 500) } })
          .catch(() => undefined);
      }
      results.push({ subscriptionId: target.id, status: "FAILED", error: message });
    }
  }
  return results;
}

/**
 * Nuova prenotazione fatta da una cliente → notifica a tutti i dispositivi degli admin con
 * "avvisami delle nuove prenotazioni" acceso. Non lancia mai errori.
 */
export async function pushNewBookingToAdmins(
  appointmentId: string,
  options: { transport?: PushTransport; vapid?: VapidConfig | null } = {},
): Promise<PushResult[]> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        startsAt: true,
        createdBy: true,
        client: { select: { firstName: true, lastName: true } },
        items: { orderBy: { sortOrder: "asc" }, select: { name: true } },
      },
    });
    if (!appointment || appointment.createdBy !== "CLIENT") return [];
    const targets = await prisma.pushSubscription.findMany({
      where: { admin: { notifyNewBooking: true } },
      orderBy: { createdAt: "asc" },
      select: targetSelect,
    });
    return await deliverPush({
      targets,
      payload: newBookingPush(appointment),
      kind: "ADMIN_NEW_BOOKING",
      appointmentId,
      ...options,
    });
  } catch (error) {
    console.error("Notifica push della nuova prenotazione non inviata:", error);
    return [];
  }
}

export { targetSelect as pushTargetSelect };
