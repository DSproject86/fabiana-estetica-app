import { z } from "zod";
import { parseEuroToCents } from "@/lib/money";
import { isValidDayKey, type DayKey } from "@/lib/time/rome";
import { decodeCoverage } from "./rules";

/** Moduli di pacchetti e pagamenti: testo del modulo → dati validati (importi in centesimi). */

const cents = (message: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parseEuroToCents(value);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

const int = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.replace(/\s+/g, " ").trim() || null)
    .pipe(z.string().max(max, `Massimo ${max} caratteri.`).nullable());

export const MAX_SESSIONS = 100;

export const packageSchema = z
  .object({
    name: z.string().trim().min(1, "Inserisci un nome.").max(80, "Massimo 80 caratteri."),
    totalSessions: int(1, MAX_SESSIONS, `Numero di sedute tra 1 e ${MAX_SESSIONS}.`),
    price: cents("Importo non valido (es. 150 oppure 150,50)."),
    coverage: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const decoded = decodeCoverage(v ?? "");
        if (!decoded) {
          ctx.addIssue({ code: "custom", message: "Scelta non valida." });
          return z.NEVER;
        }
        return decoded;
      }),
    sessionsUsedBefore: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim() || "0")
      .pipe(int(0, MAX_SESSIONS, "Scrivi un numero (0 se nessuna).")),
    notes: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (v.sessionsUsedBefore > v.totalSessions) {
      ctx.addIssue({ code: "custom", path: ["sessionsUsedBefore"], message: "Non possono essere più delle sedute del pacchetto." });
    }
  });

export type PackageInput = z.output<typeof packageSchema>;

export const PAYMENT_METHODS = ["CASH", "CARD"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];
export const METHOD_LABEL: Record<PaymentMethodValue, string> = { CASH: "Contanti", CARD: "Carta" };

/** Data di un pagamento: non nel futuro e non prima del 2020. */
export function paymentDayProblem(day: string, today: DayKey): string | null {
  if (!isValidDayKey(day)) return "Data non valida.";
  if (day > today) return "La data non può essere nel futuro.";
  if (day < "2020-01-01") return "Data troppo vecchia.";
  return null;
}

export const paymentSchema = z.object({
  amount: cents("Importo non valido (es. 50 oppure 50,50).").pipe(z.number().int().min(1, "L'importo deve essere più di zero.")),
  method: z.enum(PAYMENT_METHODS, { message: "Scegli contanti o carta." }),
  paidOn: z.string().trim(),
  note: optionalText(200),
});

export type PaymentInput = z.output<typeof paymentSchema>;

export type FieldErrors = Record<string, string | undefined>;

export function issuesToFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
