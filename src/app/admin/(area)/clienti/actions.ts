"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { loadSettings } from "@/lib/availability/queries";
import { deleteClientForPrivacy, setClientBlocked, updateClientByAdmin, type EditClientField } from "@/lib/clients/manage";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.

export type EditClientState = {
  error?: string;
  fieldErrors?: Partial<Record<EditClientField, string>>;
  values?: Record<string, string>;
};

function refresh() {
  revalidatePath("/admin/clienti", "layout");
  revalidatePath("/admin/agenda", "layout");
  revalidatePath("/admin/pacchetti", "layout");
  revalidatePath("/admin/promemoria");
}

export async function updateClientAction(clientId: string, _prev: EditClientState, formData: FormData): Promise<EditClientState> {
  await requireAdmin();
  const values: Record<string, string> = {};
  for (const key of ["firstName", "lastName", "phone", "email", "adminNotes", "allergyNotes"]) {
    const v = formData.get(key);
    if (typeof v === "string") values[key] = v;
  }
  // Le allergie si salvano solo se l'impostazione è accesa (e quindi il campo era nel modulo).
  const { showAllergyNotes } = await loadSettings();
  const result = await updateClientByAdmin(clientId, values, showAllergyNotes && "allergyNotes" in values);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values };
  refresh();
  redirect(`/admin/clienti/${clientId}`);
}

export async function setClientBlockedAction(clientId: string, blocked: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const ok = await setClientBlocked(clientId, blocked);
  refresh();
  return ok ? {} : { error: "Cliente non trovata." };
}

export type DeleteClientState = { error?: string };

export async function deleteClientAction(clientId: string, _prev: DeleteClientState, formData: FormData): Promise<DeleteClientState> {
  await requireAdmin();
  const result = await deleteClientForPrivacy(clientId, String(formData.get("conferma") ?? ""));
  if (!result.ok) return { error: result.error };
  refresh();
  revalidatePath("/admin/statistiche");
  redirect(result.mode === "deleted" ? "/admin/clienti?esito=eliminata" : `/admin/clienti/${clientId}?esito=anonimizzata`);
}
