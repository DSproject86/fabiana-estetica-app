import { z } from "zod";
import { normalizePhone } from "./phone";

/** Versione dell'informativa accettata all'iscrizione (cambiarla quando arriva quella definitiva). */
export const PRIVACY_VERSION = "provvisoria-2026-10";

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Scrivi il tuo ${label}.`)
    .max(60, `Il ${label} è troppo lungo.`)
    .transform((v) => v.replace(/\s+/g, " "));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Controlla l'email.").max(254, "Controlla l'email."));

export const signupSchema = z.object({
  firstName: name("nome"),
  lastName: name("cognome"),
  phone: z
    .string()
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Controlla il numero di cellulare." });
        return z.NEVER;
      }
      return phone;
    }),
  email: emailSchema,
  privacy: z.literal("on", { error: "Per iscriverti serve il consenso al trattamento dei dati." }),
});

export type SignupValues = z.output<typeof signupSchema>;
export type SignupField = keyof SignupValues;

/** Primo errore per ogni campo, da mostrare sotto i campi del modulo. */
export function signupFieldErrors(error: z.ZodError): Partial<Record<SignupField, string>> {
  const out: Partial<Record<SignupField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as SignupField | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
