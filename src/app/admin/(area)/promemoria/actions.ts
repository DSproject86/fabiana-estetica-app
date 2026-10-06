"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { retryReminder } from "@/lib/notifications/reminders";

export async function setWhatsappSentAction(appointmentId: string, sent: boolean): Promise<void> {
  await requireAdmin();
  await prisma.appointment.updateMany({
    where: { id: appointmentId },
    data: { whatsappSentAt: sent ? new Date() : null },
  });
  revalidatePath("/admin/promemoria");
}

export type RetryState = { error?: string; ok?: boolean };

export async function retryReminderAction(appointmentId: string): Promise<RetryState> {
  await requireAdmin();
  const result = await retryReminder(appointmentId);
  revalidatePath("/admin/promemoria");
  return result.ok ? { ok: true } : { error: result.error };
}
