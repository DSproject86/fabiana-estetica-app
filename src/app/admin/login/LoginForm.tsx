"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        label="Email"
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        defaultValue={state.email}
        required
      />
      <TextField
        label="Password"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Accesso in corso…" : "Accedi"}
      </Button>
    </form>
  );
}
