import "server-only";
import { prisma } from "@/lib/db";
import { deliverPush, pushTargetSelect, type PushResult, type PushTransport } from "./deliver";
import type { VapidConfig } from "./config";
import { testPush } from "./payload";
import { MAX_DEVICES_PER_ADMIN, type SubscriptionInput } from "./subscription";

/** Dispositivi degli admin abbonati alle notifiche (Il mio account → Notifiche). */

export type SaveDeviceResult = { ok: true; id: string } | { ok: false; error: string };

export const TOO_MANY_DEVICES = `Hai già ${MAX_DEVICES_PER_ADMIN} dispositivi con le notifiche: rimuovine uno dall'elenco.`;

/**
 * Attiva (o aggiorna) le notifiche per un dispositivo. Se lo stesso browser era registrato da un altro
 * admin (telefono condiviso) passa all'admin collegato adesso: le notifiche vanno a chi lo usa ora.
 */
export async function saveDevice(
  adminId: string,
  sub: SubscriptionInput,
  deviceName: string,
  userAgent: string | null,
  now = new Date(),
): Promise<SaveDeviceResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pushSubscription.findUnique({ where: { endpoint: sub.endpoint }, select: { id: true, adminId: true } });
    if (!existing || existing.adminId !== adminId) {
      const count = await tx.pushSubscription.count({ where: { adminId } });
      if (count >= MAX_DEVICES_PER_ADMIN) return { ok: false, error: TOO_MANY_DEVICES };
    }
    const data = {
      adminId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      deviceName,
      userAgent: userAgent?.slice(0, 300) ?? null,
    };
    const saved = await tx.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { endpoint: sub.endpoint, ...data, createdAt: now },
      update: data,
      select: { id: true },
    });
    return { ok: true, id: saved.id };
  });
}

/** Rimuove un dispositivo, solo se è dell'admin collegato. */
export async function removeDevice(adminId: string, where: { id: string } | { endpoint: string }): Promise<boolean> {
  const deleted = await prisma.pushSubscription.deleteMany({ where: { ...where, adminId } });
  return deleted.count > 0;
}

export function listDevices(adminId: string) {
  return prisma.pushSubscription.findMany({
    where: { adminId },
    orderBy: { createdAt: "asc" },
    select: { id: true, endpoint: true, deviceName: true, createdAt: true, lastUsedAt: true },
  });
}

/** Notifica di prova a un dispositivo dell'admin collegato (registrata come "prova"). */
export async function sendTestToDevice(
  adminId: string,
  endpoint: string,
  options: { transport?: PushTransport; vapid?: VapidConfig | null } = {},
): Promise<PushResult | null> {
  const target = await prisma.pushSubscription.findFirst({ where: { endpoint, adminId }, select: pushTargetSelect });
  if (!target) return null;
  const [result] = await deliverPush({ targets: [target], payload: testPush(target.deviceName), kind: "ADMIN_NEW_BOOKING", isTest: true, ...options });
  return result ?? null;
}
