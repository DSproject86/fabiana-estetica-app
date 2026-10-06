"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TextField } from "@/components/ui/TextField";
import { formatPhone } from "@/lib/clients/phone";
import { createClientAction, type ClientFormState } from "../actions";

/** Nuova cliente al volo (email facoltativa). Se esiste già, propone di scegliere quella. */
export function NewClientForm() {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(createClientAction, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-prugna/5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="firstName" name="firstName" label="Nome" autoComplete="off" defaultValue={values?.firstName} error={errors.firstName} required />
        <TextField id="lastName" name="lastName" label="Cognome" autoComplete="off" defaultValue={values?.lastName} error={errors.lastName} required />
      </div>
      <TextField id="phone" name="phone" label="Cellulare" type="tel" inputMode="tel" autoComplete="off" defaultValue={values?.phone} error={errors.phone} required />
      <TextField
        id="email"
        name="email"
        label="Email (facoltativa)"
        type="email"
        inputMode="email"
        autoComplete="off"
        defaultValue={values?.email}
        error={errors.email}
        hint="Serve per le email di conferma e promemoria e per accedere all'app."
      />

      {state.duplicates?.length ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-oro/15 p-3 text-sm">
          <p className="font-medium">
            {state.emailTaken ? "Questa email è già di una cliente:" : "Questo cellulare è già di:"}
          </p>
          <ul className="flex flex-col gap-1">
            {state.duplicates.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/agenda/nuovo?cliente=${c.id}`} className="font-medium underline underline-offset-2">
                  {c.firstName} {c.lastName}
                </Link>{" "}
                <span className="text-prugna/60">
                  · {formatPhone(c.phone)}
                  {c.email ? ` · ${c.email}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {!state.emailTaken ? (
            <button type="submit" name="force" value="1" disabled={pending} className="w-fit text-left text-prugna/70 underline underline-offset-2">
              No, è un&apos;altra persona: crea comunque
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-prugna px-6 font-medium text-avorio disabled:opacity-60"
      >
        {pending ? "Attendi…" : "Crea e continua"}
      </button>
    </form>
  );
}
