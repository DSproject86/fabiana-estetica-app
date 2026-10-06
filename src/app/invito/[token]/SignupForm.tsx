"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Notice } from "@/components/client/ClientShell";
import { signupAction, type SignupState } from "./actions";

export function SignupForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction.bind(null, token), {});
  const errors = state.fieldErrors ?? {};
  const v = state.values;

  if (state.linkInvalid) {
    return <Notice tone="error">Questo link non è più valido. Chiedi a Fabiana quello nuovo.</Notice>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField label="Nome" id="firstName" name="firstName" autoComplete="given-name" defaultValue={v?.firstName} error={errors.firstName} required />
      <TextField label="Cognome" id="lastName" name="lastName" autoComplete="family-name" defaultValue={v?.lastName} error={errors.lastName} required />
      <TextField
        label="Cellulare"
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="333 123 4567"
        hint="Serve a Fabiana per contattarti su WhatsApp."
        defaultValue={v?.phone}
        error={errors.phone}
        required
      />
      <TextField
        label="Email"
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        hint="Qui riceverai il codice per accedere."
        defaultValue={v?.email}
        error={errors.email}
        required
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="privacy" className="flex cursor-pointer items-start gap-3 rounded-xl border border-prugna/15 bg-white p-4">
          <input id="privacy" name="privacy" type="checkbox" required className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]" />
          <span className="text-sm">
            Ho letto l&apos;
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              informativa sulla privacy
            </Link>{" "}
            e acconsento al trattamento dei miei dati per gestire le prenotazioni.
          </span>
        </label>
        {errors.privacy ? <p className="text-sm text-red-800">{errors.privacy}</p> : null}
      </div>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending} className="mt-1 min-h-12 text-base">
        {pending ? "Iscrizione in corso…" : "Iscriviti"}
      </Button>
    </form>
  );
}
