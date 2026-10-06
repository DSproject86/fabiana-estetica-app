import "server-only";

/**
 * Invio email con Resend (API HTTP, senza librerie). Unico punto di contatto col fornitore:
 * chi invia passa da src/lib/notifications/deliver.ts, che registra ogni invio e in futuro
 * potrà affiancare altri canali (es. WhatsApp Cloud API) con la stessa forma di risultato.
 */

export type EmailAttachment = { filename: string; content: string; contentType: string };

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Sostituisce EMAIL_REPLY_TO (es. l'avviso agli admin risponde alla cliente). */
  replyTo?: string | null;
  attachments?: EmailAttachment[];
};

export type SendResult =
  | { ok: true; provider: string; providerMessageId: string | null }
  | { ok: false; provider: string; error: string; skipped?: boolean };

const RESEND_URL = "https://api.resend.com/emails";

/** Resend accetta poche richieste al secondo: tra un invio e l'altro passa almeno questo tempo. */
const MIN_GAP_MS = 600;
let queue: Promise<void> = Promise.resolve();
let lastStart = 0;

function waitTurn(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = lastStart + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStart = Date.now();
  });
  queue = turn.catch(() => undefined);
  return turn;
}

export function replyToAddress(): string | null {
  return process.env.EMAIL_REPLY_TO?.trim() || null;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, provider: "resend", skipped: true, error: "RESEND_API_KEY o EMAIL_FROM mancanti" };
  }

  const replyTo = message.replyTo === undefined ? replyToAddress() : message.replyTo;
  const payload = JSON.stringify({
    from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(message.attachments?.length
      ? {
          attachments: message.attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, "utf8").toString("base64"),
            content_type: a.contentType,
          })),
        }
      : {}),
  });

  // Un solo nuovo tentativo, e solo per "troppe richieste" (429): in quel caso l'email non è partita.
  for (let attempt = 1; ; attempt++) {
    await waitTurn();
    try {
      const response = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (response.status === 429 && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        continue;
      }
      if (!response.ok) {
        return { ok: false, provider: "resend", error: `HTTP ${response.status}: ${body?.message ?? "errore sconosciuto"}` };
      }
      return { ok: true, provider: "resend", providerMessageId: body?.id ?? null };
    } catch (error) {
      return { ok: false, provider: "resend", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
