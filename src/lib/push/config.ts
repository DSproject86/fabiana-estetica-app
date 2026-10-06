import "server-only";

/**
 * Chiavi VAPID (Web Push). Solo in Production su Vercel: senza chiavi (anteprime, sviluppo, test)
 * le notifiche non partono e il registro le segna come "non inviate".
 */
export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^(mailto:|https:)/.test(subject)) {
    console.error("VAPID_SUBJECT deve iniziare con mailto: oppure https:");
    return null;
  }
  return { publicKey, privateKey, subject };
}
