"use server";

import { redirect } from "next/navigation";
import {
  clearPendingLogin,
  getPendingLogin,
  setPendingLogin,
  startClientSession,
} from "@/lib/auth/client";
import { sendCodeInBackground, verifyLoginCode } from "@/lib/auth/clientLogin";
import { normalizeCode } from "@/lib/auth/loginCode";
import { emailSchema } from "@/lib/clients/signup";

export type AccessState = { error?: string; info?: string; email?: string };

export async function requestCodeAction(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(typed);
  if (!parsed.success) return { error: "Controlla l'email.", email: typed };

  await setPendingLogin(parsed.data);
  sendCodeInBackground(parsed.data);
  redirect("/accedi");
}

export async function verifyCodeAction(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const email = await getPendingLogin();
  if (!email) return { error: "È passato troppo tempo. Torna indietro e inserisci di nuovo l'email." };

  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "Il codice è di 6 cifre." };

  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    return { error: "Codice non valido o scaduto. Controlla l'ultima email ricevuta o chiedi un nuovo codice." };
  }

  await startClientSession(result.client);
  await clearPendingLogin();
  redirect("/");
}

export async function resendCodeAction(): Promise<AccessState> {
  const email = await getPendingLogin();
  if (!email) redirect("/accedi");
  await setPendingLogin(email); // altri 30 minuti per inserirlo
  sendCodeInBackground(email);
  return { info: "Se l'email è registrata riceverai un nuovo codice. Vale solo l'ultimo ricevuto." };
}

export async function changeEmailAction() {
  await clearPendingLogin();
  redirect("/accedi");
}
