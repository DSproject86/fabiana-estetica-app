"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/TextField";
import type { EditClientState } from "../../actions";

export type EditClientInitial = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  adminNotes: string;
  /** null = campo nascosto (impostazione "Mostra note allergie" spenta). */
  allergyNotes: string | null;
};

export function EditClientForm({
  action,
  initial,
  cancelHref,
}: {
  action: (prev: EditClientState, formData: FormData) => Promise<EditClientState>;
  initial: EditClientInitial;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="firstName" name="firstName" label="Nome" defaultValue={v?.firstName ?? initial.firstName} error={e.firstName} required />
        <TextField id="lastName" name="lastName" label="Cognome" defaultValue={v?.lastName ?? initial.lastName} error={e.lastName} required />
      </div>
      <TextField id="phone" name="phone" label="Cellulare" type="tel" inputMode="tel" defaultValue={v?.phone ?? initial.phone} error={e.phone} required />
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        defaultValue={v?.email ?? initial.email}
        error={e.email}
        hint="Serve per accedere all'app e per le email di conferma e promemoria."
      />
      {initial.allergyNotes !== null ? (
        <TextAreaField
          id="allergyNotes"
          name="allergyNotes"
          label="Allergie (solo admin)"
          defaultValue={v?.allergyNotes ?? initial.allergyNotes}
          error={e.allergyNotes}
          maxLength={500}
        />
      ) : null}
      <TextAreaField
        id="adminNotes"
        name="adminNotes"
        label="Note (solo admin)"
        defaultValue={v?.adminNotes ?? initial.adminNotes}
        error={e.adminNotes}
        maxLength={1000}
      />
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium hover:bg-cipria/20">
          Annulla
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </form>
  );
}
