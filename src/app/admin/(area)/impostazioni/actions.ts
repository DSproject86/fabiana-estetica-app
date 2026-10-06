"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { settingsSchema } from "@/lib/settings/schema";

export type SettingsFormState = { error?: string; saved?: boolean };

export async function saveSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valori non validi." };

  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  revalidatePath("/admin/impostazioni");
  return { saved: true };
}
