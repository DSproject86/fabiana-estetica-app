"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { MESSAGE_KIND_LABEL, templateBySlug } from "@/lib/notifications/defaults";
import { validateTemplate } from "@/lib/notifications/placeholders";
import { TEST_EMAIL_KINDS, sendTestEmail, type TestEmailKind } from "@/lib/notifications/testEmail";

export type TemplateFormState = { error?: string; saved?: boolean };

export async function saveTemplateAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  await requireAdmin();
  const meta = templateBySlug(String(formData.get("slug") ?? ""));
  if (!meta) return { error: "Messaggio non trovato." };

  const subject = meta.channel === "EMAIL" ? String(formData.get("subject") ?? "").trim() : null;
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const error = validateTemplate({ kind: meta.kind, channel: meta.channel, subject, body });
  if (error) return { error };

  await prisma.messageTemplate.upsert({
    where: { kind_channel: { kind: meta.kind, channel: meta.channel } },
    create: { kind: meta.kind, channel: meta.channel, subject, body },
    update: { subject, body },
  });
  revalidatePath("/admin/impostazioni/messaggi");
  revalidatePath(`/admin/impostazioni/messaggi/${meta.slug}`);
  return { saved: true };
}

export type TestEmailState = { error?: string; info?: string };

export async function sendTestEmailAction(_prev: TestEmailState, formData: FormData): Promise<TestEmailState> {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") ?? "") as TestEmailKind;
  if (!TEST_EMAIL_KINDS.includes(kind)) return { error: "Scegli quale email provare." };

  const result = await sendTestEmail(kind, admin.email);
  revalidatePath("/admin/impostazioni/registro");
  return result.ok
    ? { info: `Email di prova “${MESSAGE_KIND_LABEL[kind]}” inviata a ${admin.email}.` }
    : { error: `Invio non riuscito: ${result.error ?? "errore sconosciuto"}` };
}
