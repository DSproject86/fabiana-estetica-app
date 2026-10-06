import "server-only";

/**
 * Invio email con Resend (API HTTP, senza librerie). Unico punto di contatto col fornitore:
 * allo step 6 qui accanto si aggiungerà il canale WhatsApp con la stessa forma di risultato.
 */

export type EmailMessage = { to: string; subject: string; text: string };

export type SendResult =
  | { ok: true; provider: string; providerMessageId: string | null }
  | { ok: false; provider: string; error: string; skipped?: boolean };

const RESEND_URL = "https://api.resend.com/emails";

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, provider: "resend", skipped: true, error: "RESEND_API_KEY o EMAIL_FROM mancanti" };
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) {
      return { ok: false, provider: "resend", error: `HTTP ${response.status}: ${body?.message ?? "errore sconosciuto"}` };
    }
    return { ok: true, provider: "resend", providerMessageId: body?.id ?? null };
  } catch (error) {
    return { ok: false, provider: "resend", error: error instanceof Error ? error.message : String(error) };
  }
}
