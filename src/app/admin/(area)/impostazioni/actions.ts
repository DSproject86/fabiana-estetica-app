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

export type ContactsFormState = { error?: string; field?: "businessWhatsapp" | "businessAddress"; saved?: boolean };

const ADDRESS_MAX = 200;

export async function saveContactsAction(_prev: ContactsFormState, formData: FormData): Promise<ContactsFormState> {
  await requireAdmin();
  const typed = String(formData.get("businessWhatsapp") ?? "").trim();
  const businessWhatsapp = typed ? normalizePhone(typed) : null;
  if (typed && !businessWhatsapp) return { error: "Controlla il numero di cellulare.", field: "businessWhatsapp" };

  // Indirizzo su una riga (va anche nel file .ics), spazi in eccesso tolti.
  const businessAddress = String(formData.get("businessAddress") ?? "").replace(/\s+/g, " ").trim() || null;
  if (businessAddress && businessAddress.length > ADDRESS_MAX) {
    return { error: `L'indirizzo può avere al massimo ${ADDRESS_MAX} caratteri.`, field: "businessAddress" };
  }

  const data = { businessWhatsapp, businessAddress };
  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/admin/impostazioni");
  return { saved: true };
}

/** Interruttore "avvisami delle nuove prenotazioni" di ciascun admin. */
export async function setAdminNotifyAction(adminId: string, enabled: boolean): Promise<void> {
  await requireAdmin();
  await prisma.admin.updateMany({ where: { id: adminId }, data: { notifyNewBooking: enabled } });
  revalidatePath("/admin/impostazioni");
}

/** "Mostra note allergie" (agenda e scheda cliente). Spenta, il dato resta nel database. */
export async function setShowAllergyNotesAction(enabled: boolean): Promise<void> {
  await requireAdmin();
  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, showAllergyNotes: enabled }, update: { showAllergyNotes: enabled } });
  revalidatePath("/admin", "layout");
}
