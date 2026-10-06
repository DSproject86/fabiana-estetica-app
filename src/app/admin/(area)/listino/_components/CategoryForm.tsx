"use client";

import { useActionState } from "react";
import { TextField, ToggleField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/listino/validation";
import { FormActions, FormError } from "./FormActions";

export function CategoryForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: { name: string; active: boolean };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state.error} />
      <TextField
        id="name"
        name="name"
        label="Nome della categoria"
        placeholder="es. Viso, Corpo, Mani e piedi"
        defaultValue={v?.name ?? initial?.name ?? ""}
        error={state.fieldErrors?.name}
        maxLength={80}
        required
      />
      <ToggleField
        id="active"
        name="active"
        label="Visibile alle clienti"
        description="Se la nascondi, spariscono dalla prenotazione anche tutti i suoi servizi."
        defaultChecked={v ? v.active === "on" : (initial?.active ?? true)}
      />
      <FormActions pending={pending} submitLabel={submitLabel} />
    </form>
  );
}
