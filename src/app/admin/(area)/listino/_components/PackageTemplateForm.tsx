"use client";

import { useActionState } from "react";
import { CoverageSelect, type CoverageGroup } from "@/components/admin/CoverageSelect";
import { TextField, ToggleField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/listino/validation";
import { FormActions, FormError } from "./FormActions";

export type PackageTemplateInitial = {
  name: string;
  sessions: string;
  price: string;
  coverage: string;
  active: boolean;
};

export function PackageTemplateForm({
  action,
  coverage,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  coverage: CoverageGroup[];
  initial: PackageTemplateInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const e = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state.error} />
      <TextField
        id="name"
        name="name"
        label="Nome del pacchetto"
        placeholder="es. 10 massaggi rilassanti"
        defaultValue={v?.name ?? initial.name}
        error={e?.name}
        maxLength={80}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          id="sessions"
          name="sessions"
          label="Numero di sedute"
          inputMode="numeric"
          placeholder="10"
          defaultValue={v?.sessions ?? initial.sessions}
          error={e?.sessions}
          required
        />
        <TextField
          id="price"
          name="price"
          label="Prezzo totale (€)"
          inputMode="decimal"
          placeholder="400"
          defaultValue={v?.price ?? initial.price}
          error={e?.price}
          required
        />
      </div>
      <CoverageSelect groups={coverage} defaultValue={v?.coverage ?? initial.coverage} error={e?.coverage} />
      <ToggleField
        id="active"
        name="active"
        label="Disponibile"
        description="Se lo disattivi non si potrà più assegnare a nuove clienti; quelli già venduti restano."
        defaultChecked={v ? v.active === "on" : initial.active}
      />
      <FormActions pending={pending} submitLabel={submitLabel} />
    </form>
  );
}
