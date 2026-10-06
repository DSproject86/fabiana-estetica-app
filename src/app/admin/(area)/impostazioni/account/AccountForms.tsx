"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { changePasswordAction, signOutEverywhereAction, type ChangePasswordState } from "./actions";

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  const err = (field: string) => (state.field === field ? state.error : undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-prugna/5" noValidate>
      {/* Per i gestori di password: a quale account appartiene. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <TextField id="current" name="current" type="password" label="Password attuale" autoComplete="current-password" error={err("current")} required />
      <TextField
        id="next"
        name="next"
        type="password"
        label="Nuova password"
        autoComplete="new-password"
        hint="Almeno 10 caratteri. Una frase lunga è più sicura e più facile da ricordare."
        error={err("next")}
        minLength={10}
        required
      />
      <TextField id="confirm" name="confirm" type="password" label="Ripeti la nuova password" autoComplete="new-password" error={err("confirm")} required />
      {state.error && !state.field ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-xl bg-salvia/25 px-3 py-2 text-sm">
          Password cambiata. Gli altri dispositivi dovranno accedere di nuovo con la nuova password.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvataggio…" : "Cambia password"}
      </Button>
    </form>
  );
}

export function SignOutEverywhere() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-prugna/5">
      <p className="text-sm text-prugna/70">
        Chiude l&apos;accesso su tutti i telefoni e computer collegati a questo account, compreso questo. Utile se hai perso il
        telefono o hai usato un computer non tuo.
      </p>
      {confirming ? (
        <form action={signOutEverywhereAction} className="flex flex-wrap items-center gap-2">
          <span className="basis-full text-sm font-medium">Uscire da tutti i dispositivi?</span>
          <Button type="submit">Sì, esci ovunque</Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
            No
          </Button>
        </form>
      ) : (
        <Button type="button" variant="secondary" className="w-fit" onClick={() => setConfirming(true)}>
          Esci da tutti i dispositivi
        </Button>
      )}
    </div>
  );
}
