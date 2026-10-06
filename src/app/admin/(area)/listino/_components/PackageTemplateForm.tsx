"use client";

import { useActionState } from "react";
import { SelectField, TextField, ToggleField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/listino/validation";
import { FormActions, FormError } from "./FormActions";

export type PackageTemplateInitial = {
  name: string;
  sessions: string;
  price: string;
  serviceId: string;
  active: boolean;
};

export function PackageTemplateForm({
  action,
  services,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  services: { id: string; label: string }[];
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
      <SelectField
        id="serviceId"
        name="serviceId"
        label="Servizio delle sedute (facoltativo)"
        hint="Il trattamento a cui valgono le sedute: servirà per collegare il pacchetto agli appuntamenti."
        defaultValue={v?.serviceId ?? initial.serviceId}
        error={e?.serviceId}
      >
        <option value="">Nessuno</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>
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
