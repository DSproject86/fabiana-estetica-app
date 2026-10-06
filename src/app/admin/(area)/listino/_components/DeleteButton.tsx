"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/listino/validation";

/** Pulsante "Elimina" con conferma; mostra l'eventuale motivo per cui non si può eliminare. */
export function DeleteButton({
  action,
  label,
  confirmMessage,
}: {
  action: () => Promise<FormState>;
  label: string;
  confirmMessage: string;
}) {
  const [state, formAction, pending] = useActionState<FormState>(action, {});

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-800/30 px-5 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Eliminazione…" : label}
      </button>
    </form>
  );
}
