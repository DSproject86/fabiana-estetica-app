"use client";

import { useActionState } from "react";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/listino/validation";
import { FormActions, FormError } from "./FormActions";

export type ServiceInitial = {
  categoryId: string;
  name: string;
  description: string;
  durationMin: string;
  price: string;
  active: boolean;
};

export function ServiceForm({
  action,
  categories,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  categories: { id: string; name: string }[];
  initial: ServiceInitial;
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
        label="Nome del servizio"
        placeholder="es. Pulizia viso"
        defaultValue={v?.name ?? initial.name}
        error={e?.name}
        maxLength={80}
        required
      />
      <SelectField
        id="categoryId"
        name="categoryId"
        label="Categoria"
        defaultValue={v?.categoryId ?? initial.categoryId}
        error={e?.categoryId}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          id="durationMin"
          name="durationMin"
          label="Durata (minuti)"
          inputMode="numeric"
          placeholder="45"
          defaultValue={v?.durationMin ?? initial.durationMin}
          error={e?.durationMin}
          required
        />
        <TextField
          id="price"
          name="price"
          label="Prezzo (€)"
          inputMode="decimal"
          placeholder="35,00"
          defaultValue={v?.price ?? initial.price}
          error={e?.price}
          required
        />
      </div>
      <TextAreaField
        id="description"
        name="description"
        label="Descrizione (facoltativa)"
        hint="Breve testo che la cliente vedrà sotto il nome."
        defaultValue={v?.description ?? initial.description}
        error={e?.description}
        maxLength={300}
      />
      <ToggleField
        id="active"
        name="active"
        label="Visibile alle clienti"
        description="Se lo nascondi resta nel listino ma non si può prenotare."
        defaultChecked={v ? v.active === "on" : initial.active}
      />
      <FormActions pending={pending} submitLabel={submitLabel} />
    </form>
  );
}
