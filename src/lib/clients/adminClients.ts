import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "./phone";
import { emailSchema } from "./signup";

/** Cliente inserita a mano dall'admin: email facoltativa, nessun consenso privacy registrato. */
const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Scrivi il ${label}.`)
    .max(60, `Il ${label} è troppo lungo.`)
    .transform((v) => v.replace(/\s+/g, " "));

export const adminClientSchema = z.object({
  firstName: name("nome"),
  lastName: name("cognome"),
  phone: z.string().transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Controlla il numero di cellulare." });
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(emailSchema.nullable()),
});

export type AdminClientField = "firstName" | "lastName" | "phone" | "email";
export type ClientMatch = { id: string; firstName: string; lastName: string; phone: string; email: string | null };

export type CreateClientResult =
  | { ok: true; clientId: string }
  | { ok: false; fieldErrors: Partial<Record<AdminClientField, string>> }
  | { ok: false; duplicates: ClientMatch[]; emailTaken: boolean };

const matchSelect = { id: true, firstName: true, lastName: true, phone: true, email: true } as const;

/**
 * Crea una cliente al volo. Se l'email è già di un'altra cliente non si crea (va scelta quella);
 * se il cellulare è già usato si propone quella cliente, ma si può creare comunque (`force`).
 */
export async function createClientByAdmin(raw: Record<string, string>, force = false): Promise<CreateClientResult> {
  const parsed = adminClientSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<AdminClientField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as AdminClientField | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const values = parsed.data;

  if (values.email) {
    const sameEmail = await prisma.client.findUnique({ where: { email: values.email }, select: matchSelect });
    if (sameEmail) return { ok: false, duplicates: [sameEmail], emailTaken: true };
  }
  if (!force) {
    const samePhone = await prisma.client.findMany({ where: { phone: values.phone }, select: matchSelect, take: 5 });
    if (samePhone.length > 0) return { ok: false, duplicates: samePhone, emailTaken: false };
  }

  try {
    const client = await prisma.client.create({ data: { ...values, source: "ADMIN" }, select: { id: true } });
    return { ok: true, clientId: client.id };
  } catch (error) {
    // Email registrata nel frattempo (indice unico).
    if (values.email && error instanceof Error && error.message.includes("Unique constraint")) {
      const sameEmail = await prisma.client.findUnique({ where: { email: values.email }, select: matchSelect });
      if (sameEmail) return { ok: false, duplicates: [sameEmail], emailTaken: true };
    }
    throw error;
  }
}

/** Ricerca per nome, cognome, email o cellulare (ogni parola deve comparire da qualche parte). */
export async function searchClients(q: string, take = 20) {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  const select = { ...matchSelect, blockedAt: true } as const;
  if (words.length === 0) {
    return prisma.client.findMany({ orderBy: { updatedAt: "desc" }, take: 8, select });
  }
  return prisma.client.findMany({
    where: {
      AND: words.map((w) => {
        const digits = w.replace(/\D/g, "");
        return {
          OR: [
            { firstName: { contains: w, mode: "insensitive" as const } },
            { lastName: { contains: w, mode: "insensitive" as const } },
            { email: { contains: w, mode: "insensitive" as const } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        };
      }),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select,
  });
}
