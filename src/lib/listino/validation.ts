import { z } from "zod";
import { parseEuroToCents } from "@/lib/money";
import { decodeCoverage } from "@/lib/packages/rules";

/** Stato restituito dai moduli: errore generale, errori per campo e valori digitati. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const name = z
  .string()
  .trim()
  .min(1, "Inserisci un nome.")
  .max(80, "Massimo 80 caratteri.");

const price = z.string().transform((value, ctx) => {
  const cents = parseEuroToCents(value);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Importo non valido (es. 35 oppure 35,50)." });
    return z.NEVER;
  }
  return cents;
});

const intInRange = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

export const categorySchema = z.object({
  name,
  active: checkbox,
});

export const serviceSchema = z.object({
  categoryId: z.string().min(1, "Scegli una categoria."),
  name,
  description: z
    .string()
    .trim()
    .max(300, "Massimo 300 caratteri.")
    .optional()
    .transform((v) => (v ? v : null)),
  durationMin: intInRange(5, 480, "Durata tra 5 e 480 minuti."),
  price,
  active: checkbox,
});

export const packageTemplateSchema = z.object({
  name,
  sessions: intInRange(1, 100, "Numero di sedute tra 1 e 100."),
  price,
  // "s:<id>" servizio, "c:<id>" categoria intera, "" nessuno
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
  active: checkbox,
});

/** Legge i campi del modulo e restituisce i dati validati oppure lo stato con gli errori. */
export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { data: z.output<T> } | { state: FormState } {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { state: { fieldErrors, values } };
}
