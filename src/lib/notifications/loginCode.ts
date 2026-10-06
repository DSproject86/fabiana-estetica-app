import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { renderTemplate } from "./render";

// Testo di riserva se il template non è nel database (il seed lo crea uguale).
const FALLBACK = {
  subject: "Il tuo codice di accesso: {codice}",
  body: "Ciao {nome},\n\nil tuo codice per accedere è: {codice}\n\nVale 10 minuti. Se non l'hai richiesto tu, ignora questa email.\n\nFabiana",
};

/** Manda il codice e registra l'esito in NotificationLog (mai il codice). */
export async function sendLoginCodeEmail(client: { id: string; firstName: string; email: string }, code: string) {
  const template = await prisma.messageTemplate.findUnique({
    where: { kind_channel: { kind: "LOGIN_CODE", channel: "EMAIL" } },
  });
  const vars = { nome: client.firstName, codice: code };
  const subject = renderTemplate(template?.subject ?? FALLBACK.subject, vars);
  const text = renderTemplate(template?.body ?? FALLBACK.body, vars);

  const log = await prisma.notificationLog.create({
    data: { channel: "EMAIL", kind: "LOGIN_CODE", provider: "resend", recipient: client.email, clientId: client.id },
    select: { id: true },
  });

  const result = await sendEmail({ to: client.email, subject, text });

  if (!result.ok && result.skipped && process.env.NODE_ENV !== "production") {
    // Solo in sviluppo, senza Resend configurato: il codice si legge nel terminale.
    console.info(`[sviluppo] codice di accesso per ${client.email}: ${code}`);
  }
  if (!result.ok) console.error(`Invio codice di accesso non riuscito (log ${log.id}): ${result.error}`);

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: result.ok
      ? { status: "SENT", sentAt: new Date(), providerMessageId: result.providerMessageId }
      : { status: result.skipped ? "SKIPPED" : "FAILED", error: result.error.slice(0, 500) },
  });
}
