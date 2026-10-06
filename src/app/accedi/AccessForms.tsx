"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Notice } from "@/components/client/ClientShell";
import {
  changeEmailAction,
  requestCodeAction,
  resendCodeAction,
  verifyCodeAction,
  type AccessState,
} from "./actions";

export function EmailForm() {
  const [state, formAction, pending] = useActionState<AccessState, FormData>(requestCodeAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        label="La tua email"
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        defaultValue={state.email}
        error={state.error}
        required
      />
      <Button type="submit" disabled={pending} className="min-h-12 text-base">
        {pending ? "Invio in corso…" : "Ricevi il codice"}
      </Button>
    </form>
  );
}

export function CodeForm() {
  const [state, formAction, pending] = useActionState<AccessState, FormData>(verifyCodeAction, {});
  const [resent, resendAction, resending] = useActionState<AccessState>(resendCodeAction, {});

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-sm font-medium">
            Codice di 6 cifre
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            autoFocus
            required
            aria-invalid={state.error ? true : undefined}
            className="min-h-14 w-full rounded-xl border border-prugna/15 bg-white px-4 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-oro focus:ring-2 focus:ring-oro/30"
          />
        </div>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending} className="min-h-12 text-base">
          {pending ? "Controllo…" : "Accedi"}
        </Button>
      </form>

      {resent.info && !resending ? <Notice tone="ok">{resent.info}</Notice> : null}
      <div className="flex flex-wrap justify-center gap-2">
        <form action={resendAction}>
          <Button type="submit" variant="ghost" disabled={resending}>
            {resending ? "Invio…" : "Rinvia il codice"}
          </Button>
        </form>
        <form action={changeEmailAction}>
          <Button type="submit" variant="ghost">
            Cambia email
          </Button>
        </form>
      </div>
    </div>
  );
}
