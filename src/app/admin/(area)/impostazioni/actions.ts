"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { settingsSchema } from "@/lib/settings/schema";
import { normalizePhone } from "@/lib/clients/phone";
import { regenerateInvite } from "@/lib/invite/invite";

export type SettingsFormState = { error?: string; saved?: boolean };

export async function saveSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valori non validi." };

  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  revalidatePath("/admin/impostazioni");
  return { saved: true };
}

export async function regenerateInviteAction() {
  await requireAdmin();
  await regenerateInvite();
  revalidatePath("/admin/impostazioni");
}

export type ContactsFormState = { error?: string; saved?: boolean };

export async function saveContactsAction(_prev: ContactsFormState, formData: FormData): Promise<ContactsFormState> {
  await requireAdmin();
  const typed = String(formData.get("businessWhatsapp") ?? "").trim();
  const businessWhatsapp = typed ? normalizePhone(typed) : null;
  if (typed && !businessWhatsapp) return { error: "Controlla il numero di cellulare." };

  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, businessWhatsapp }, update: { businessWhatsapp } });
  revalidatePath("/admin/impostazioni");
  return { saved: true };
}
