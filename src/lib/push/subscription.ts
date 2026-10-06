import { createECDH } from "node:crypto";
import { z } from "zod";

/**
 * Abbonamento push mandato dal browser (PushSubscription.toJSON()). Il server poi fa richieste a
 * `endpoint`: si accettano solo indirizzi https dei servizi push dei browser, mai indirizzi qualsiasi.
 */
export const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge su Android, Samsung Internet
  "android.googleapis.com",
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari (iPhone, iPad, Mac)
  "notify.windows.com", // Edge su Windows
] as const;

export const MAX_DEVICES_PER_ADMIN = 10;
export const DEVICE_NAME_MAX = 60;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Chiave in base64url che, decodificata, ha esattamente `bytes` byte. */
const base64urlKey = (bytes: number, label: string) =>
  z
    .string()
    .max(200)
    .refine((v) => /^[A-Za-z0-9_-]+={0,2}$/.test(v) && Buffer.from(v, "base64url").length === bytes, `${label} non valida.`);

/** La chiave del browser deve essere un punto valido della curva P-256, altrimenti nessun invio funzionerebbe. */
export function isValidP256Key(base64url: string): boolean {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    ecdh.computeSecret(Buffer.from(base64url, "base64url")); // lancia se il punto non è sulla curva
    return true;
  } catch {
    return false;
  }
}

export const subscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(isAllowedPushEndpoint, "Servizio di notifiche non riconosciuto."),
  keys: z.object({
    p256dh: base64urlKey(65, "Chiave del browser").refine(isValidP256Key, "Chiave del browser non valida."),
    auth: base64urlKey(16, "Chiave di autenticazione"),
  }),
});

export type SubscriptionInput = z.output<typeof subscriptionSchema>;

/** Nome del dispositivo: una riga, al massimo 60 caratteri; vuoto → nome proposto. */
export function cleanDeviceName(typed: string, fallback: string): string {
  const name = typed.replace(/\s+/g, " ").trim().slice(0, DEVICE_NAME_MAX);
  return name || fallback;
}

/** Nome proposto dal browser: "iPhone di Fabiana", "Android di Marco", "Computer di Fabiana"… */
export function suggestDeviceName(userAgent: string, adminName: string): string {
  const device = /iPad/.test(userAgent)
    ? "iPad"
    : /iPhone|iPod/.test(userAgent)
      ? "iPhone"
      : /Android/.test(userAgent)
        ? "Android"
        : /Macintosh|Mac OS X/.test(userAgent)
          ? "Mac"
          : "Computer";
  return `${device} di ${adminName}`.slice(0, DEVICE_NAME_MAX);
}
