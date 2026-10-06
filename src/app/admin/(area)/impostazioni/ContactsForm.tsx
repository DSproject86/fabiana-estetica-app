"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { saveContactsAction, type ContactsFormState } from "./actions";

export function ContactsForm({ businessWhatsapp }: { businessWhatsapp: string }) {
  const [state, formAction, pending] = useActionState<ContactsFormState, FormData>(saveContactsAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        label="Numero WhatsApp di Fabiana"
        id="businessWhatsapp"
        name="businessWhatsapp"
        type="tel"
        inputMode="tel"
        placeholder="333 123 4567"
        hint="Le clienti lo usano dal pulsante “Scrivi a Fabiana” per spostare o disdire. Vuoto = pulsante nascosto."
        defaultValue={businessWhatsapp}
        error={state.error}
      />
      {state.saved && !pending ? (
        <p role="status" className="rounded-xl bg-salvia/25 px-4 py-3 text-sm">
          Numero salvato.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva numero"}
        </Button>
      </div>
    </form>
  );
}
