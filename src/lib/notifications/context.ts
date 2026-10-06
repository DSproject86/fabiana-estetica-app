import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { replyToAddress } from "@/lib/email/send";
import { DEFAULT_TEMPLATES, templateKey, type TemplateText } from "./defaults";
import type { TemplateChannel, TemplateKind } from "./placeholders";
import type { BusinessInfo } from "./vars";

type Db = Prisma.TransactionClient | typeof prisma;

/** Indirizzo pubblico dell'app per i link nelle email (APP_URL; in locale localhost). */
export function publicAppUrl(): string {
  return process.env.APP_URL?.trim().replace(/\/+$/, "") || "http://localhost:3000";
}

export async function loadBusinessInfo(db: Db = prisma): Promise<BusinessInfo> {
  const settings = await db.settings.findUnique({
    where: { id: 1 },
    select: { businessAddress: true, businessWhatsapp: true },
  });
  return {
    address: settings?.businessAddress ?? null,
    whatsapp: settings?.businessWhatsapp ?? null,
    replyTo: replyToAddress(),
    appUrl: publicAppUrl(),
  };
}

/** Testo salvato dall'admin, oppure quello predefinito se manca. */
export async function loadTemplate(kind: TemplateKind, channel: TemplateChannel, db: Db = prisma): Promise<TemplateText> {
  const stored = await db.messageTemplate.findUnique({
    where: { kind_channel: { kind, channel } },
    select: { subject: true, body: true },
  });
  if (stored) return stored;
  const fallback = DEFAULT_TEMPLATES[templateKey(kind, channel)];
  if (!fallback) throw new Error(`Nessun testo per ${kind}/${channel}`);
  return fallback;
}

/** Campi dell'appuntamento che servono a email, WhatsApp e promemoria. */
export const appointmentInfoSelect = {
  id: true,
  startsAt: true,
  createdAt: true,
  durationMin: true,
  totalPriceCents: true,
  status: true,
  createdBy: true,
  reminderEmailSentAt: true,
  whatsappSentAt: true,
  items: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} satisfies Prisma.AppointmentSelect;

export type AppointmentWithClient = Prisma.AppointmentGetPayload<{ select: typeof appointmentInfoSelect }>;
