import "server-only";
import { composeEmail } from "./compose";
import { loadBusinessInfo, loadTemplate } from "./context";
import { deliverEmail } from "./deliver";

/** Manda il codice e registra l'esito in NotificationLog (mai il codice). */
export async function sendLoginCodeEmail(
  client: { id: string; firstName: string; lastName: string; email: string },
  code: string,
) {
  const [business, template] = await Promise.all([loadBusinessInfo(), loadTemplate("LOGIN_CODE", "EMAIL")]);
  const content = composeEmail({ kind: "LOGIN_CODE", client, code }, template, business);
  const result = await deliverEmail({
    kind: "LOGIN_CODE",
    clientId: client.id,
    message: { to: client.email, ...content },
  });

  if (!result.ok && result.skipped && process.env.NODE_ENV !== "production") {
    // Solo in sviluppo, senza Resend configurato: il codice si legge nel terminale.
    console.info(`[sviluppo] codice di accesso per ${client.email}: ${code}`);
  }
}
