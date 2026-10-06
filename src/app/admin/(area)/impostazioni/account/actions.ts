"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { changeAdminPassword, signOutEverywhere, type ChangePasswordField } from "@/lib/auth/account";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/auth/admin";
import { removeDevice, saveDevice, sendTestToDevice } from "@/lib/push/devices";
import { cleanDeviceName, subscriptionSchema, suggestDeviceName } from "@/lib/push/subscription";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.

export type ChangePasswordState = { error?: string; field?: ChangePasswordField; saved?: boolean };

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const admin = await requireAdmin();
  const result = await changeAdminPassword(admin.id, {
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!result.ok) return { error: result.error, field: result.field };
  // Gli altri dispositivi escono (sessionVersion aumentata); questo resta collegato con un cookie nuovo.
  await startAdminSession({ id: admin.id, sessionVersion: result.sessionVersion });
  return { saved: true };
}

/** Esce da tutti i dispositivi, compreso questo. */
export async function signOutEverywhereAction(): Promise<void> {
  const admin = await requireAdmin();
  await signOutEverywhere(admin.id);
  await endAdminSession();
  redirect("/admin/login?uscito=1");
}

// ─────────────── Notifiche push su questo dispositivo ───────────────

export type PushActionResult = { ok?: boolean; error?: string; message?: string; expired?: boolean };

function refreshAccount() {
  revalidatePath("/admin/impostazioni/account");
}

/** Attiva (o aggiorna) le notifiche per il browser da cui arriva la richiesta. */
export async function enablePushAction(subscription: unknown, deviceName: string): Promise<PushActionResult> {
  const admin = await requireAdmin();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Abbonamento non valido." };
  const userAgent = (await headers()).get("user-agent");
  const name = cleanDeviceName(String(deviceName ?? ""), suggestDeviceName(userAgent ?? "", admin.name));
  const result = await saveDevice(admin.id, parsed.data, name, userAgent);
  refreshAccount();
  return result.ok ? { ok: true } : { error: result.error };
}

/** Disattiva le notifiche di questo browser (il browser cancella l'abbonamento per conto suo). */
export async function disablePushAction(endpoint: string): Promise<PushActionResult> {
  const admin = await requireAdmin();
  await removeDevice(admin.id, { endpoint: String(endpoint ?? "") });
  refreshAccount();
  return { ok: true };
}

/** Rimuove uno dei propri dispositivi dall'elenco. */
export async function removeDeviceAction(id: string): Promise<PushActionResult> {
  const admin = await requireAdmin();
  const removed = await removeDevice(admin.id, { id: String(id ?? "") });
  refreshAccount();
  return removed ? { ok: true } : { error: "Dispositivo non trovato." };
}

export async function sendTestPushAction(endpoint: string): Promise<PushActionResult> {
  const admin = await requireAdmin();
  const result = await sendTestToDevice(admin.id, String(endpoint ?? ""));
  refreshAccount();
  if (!result) return { error: "Questo dispositivo non è registrato: attiva prima le notifiche." };
  if (result.status === "SENT") return { ok: true, message: "Notifica inviata: dovrebbe arrivare tra pochi secondi." };
  if (result.status === "SKIPPED") return { error: "Le notifiche non sono configurate sul server (mancano le chiavi VAPID)." };
  if (result.expired) {
    return { expired: true, error: "Questo abbonamento alle notifiche non vale più: tocca “Attiva notifiche” per crearne uno nuovo." };
  }
  return { error: `Invio non riuscito. ${result.error ?? ""}`.trim() };
}
