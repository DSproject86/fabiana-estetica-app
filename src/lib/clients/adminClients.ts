import "server-only";
import type { Prisma } from "@prisma/client";
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

/** Condizione di ricerca: ogni parola deve comparire in nome, cognome, email o cellulare. */
function searchWhere(q: string): Prisma.ClientWhereInput {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    anonymizedAt: null,
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
  };
}

/** Ricerca per nome, cognome, email o cellulare (le clienti eliminate per la privacy non compaiono). */
export async function searchClients(q: string, take = 20) {
  const select = { ...matchSelect, blockedAt: true } as const;
  if (!q.trim()) {
    return prisma.client.findMany({ where: { anonymizedAt: null }, orderBy: { updatedAt: "desc" }, take: 8, select });
  }
  return prisma.client.findMany({
    where: searchWhere(q),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take,
    select,
  });
}

export const CLIENTS_PAGE_SIZE = 50;

/** Elenco clienti (pagina "Clienti"): in ordine di cognome, a pagine. */
export async function listClients(q: string, page: number) {
  const where = searchWhere(q);
  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * CLIENTS_PAGE_SIZE,
      take: CLIENTS_PAGE_SIZE,
      select: { ...matchSelect, blockedAt: true, _count: { select: { packages: { where: { closedAt: null } } } } },
    }),
  ]);
  return { total, clients, pages: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)) };
}
