"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  addPayment,
  deletePackage,
  deletePayment,
  sellPackage,
  setPackageArchived,
  updatePackage,
  updatePayment,
} from "@/lib/packages/mutations";
import { issuesToFieldErrors, packageSchema, paymentSchema, type FieldErrors } from "@/lib/packages/validation";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.
// Le regole (sedute, residuo, lock) stanno in src/lib/packages/mutations.ts.

export type PackageFormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
  /** Cambia a ogni salvataggio riuscito (per svuotare/chiudere il modulo). */
  savedAt?: number;
};

function refresh() {
  revalidatePath("/admin/pacchetti", "layout");
  revalidatePath("/admin/clienti", "layout");
  revalidatePath("/admin/agenda", "layout");
  revalidatePath("/admin/statistiche");
  revalidatePath("/appuntamenti");
}

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
  return values;
}

/** Acconto facoltativo alla vendita: si valida solo se è stato scritto un importo. */
function readInitialPayment(values: Record<string, string>) {
  if (!(values.amount ?? "").trim()) return { payment: null };
  const parsed = paymentSchema.safeParse(values);
  return parsed.success ? { payment: parsed.data } : { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
}

export async function sellPackageAction(_prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  await requireAdmin();
  const values = formValues(formData);
  const parsed = packageSchema.safeParse(values);
  const initial = readInitialPayment(values);
  if (!parsed.success || "fieldErrors" in initial) {
    return {
      values,
      fieldErrors: {
        ...(parsed.success ? {} : issuesToFieldErrors(parsed.error.issues)),
        ...("fieldErrors" in initial ? initial.fieldErrors : {}),
      },
    };
  }
  const result = await sellPackage({
    clientId: values.clientId ?? "",
    templateId: values.templateId || null,
    data: parsed.data,
    initialPayment: initial.payment ?? null,
  });
  if (!result.ok) return { values, error: result.error, fieldErrors: result.fieldErrors };
  refresh();
  redirect(`/admin/pacchetti/${result.packageId}?esito=venduto`);
}

export async function updatePackageAction(packageId: string, _prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  await requireAdmin();
  const values = formValues(formData);
  const parsed = packageSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const result = await updatePackage(packageId, parsed.data);
  if (!result.ok) return { values, error: result.error, fieldErrors: result.fieldErrors };
  refresh();
  redirect(`/admin/pacchetti/${packageId}`);
}

export async function deletePackageAction(packageId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const result = await deletePackage(packageId);
  if (!result.ok) return { error: result.error };
  refresh();
  redirect(`/admin/clienti/${result.clientId}`);
}

export async function archivePackageAction(packageId: string, archived: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const result = await setPackageArchived(packageId, archived);
  refresh();
  return result.ok ? {} : { error: result.error };
}

// ─────────────── Pagamenti ───────────────

export async function addPaymentAction(packageId: string, _prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  await requireAdmin();
  const values = formValues(formData);
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const result = await addPayment(packageId, parsed.data);
  if (!result.ok) return { values, error: result.error, fieldErrors: result.fieldErrors };
  refresh();
  return { savedAt: Date.now() };
}

export async function updatePaymentAction(paymentId: string, _prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  await requireAdmin();
  const values = formValues(formData);
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const result = await updatePayment(paymentId, parsed.data);
  if (!result.ok) return { values, error: result.error, fieldErrors: result.fieldErrors };
  refresh();
  return { savedAt: Date.now() };
}

export async function deletePaymentAction(paymentId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const result = await deletePayment(paymentId);
  refresh();
  return result.ok ? {} : { error: result.error };
}
