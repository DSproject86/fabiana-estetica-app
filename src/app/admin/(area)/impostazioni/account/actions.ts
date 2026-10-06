"use server";

import { redirect } from "next/navigation";
import { changeAdminPassword, signOutEverywhere, type ChangePasswordField } from "@/lib/auth/account";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/auth/admin";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.

export type ChangePasswordState = { error?: string; field?: ChangePasswordField; saved?: boolean };

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const admin = await requireAdmin();
  const result = await changeAdminPassword(admin.id, {
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!result.ok) return { error: result.error, field: result.field };
  // Gli altri dispositivi escono (sessionVersion aumentata); questo resta collegato con un cookie nuovo.
  await startAdminSession({ id: admin.id, sessionVersion: result.sessionVersion });
  return { saved: true };
}

/** Esce da tutti i dispositivi, compreso questo. */
export async function signOutEverywhereAction(): Promise<void> {
  const admin = await requireAdmin();
  await signOutEverywhere(admin.id);
  await endAdminSession();
  redirect("/admin/login?uscito=1");
}
