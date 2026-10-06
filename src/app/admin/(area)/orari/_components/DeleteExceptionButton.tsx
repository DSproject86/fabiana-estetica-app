"use client";

import { useActionState } from "react";
import type { OrariFormState } from "@/lib/schedule/form";
import { ConflictWarning } from "./ConflictWarning";
import { useSubmit } from "./useSubmit";

export function DeleteExceptionButton({
  action,
}: {
  action: (prev: OrariFormState, formData: FormData) => Promise<OrariFormState>;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const submit = useSubmit(dispatch);

  return (
    <form
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const confirmed = submitter?.name === "confirm";
        if (!confirmed && !window.confirm("Eliminare questa eccezione? Tornerà a valere la settimana tipo.")) {
          event.preventDefault();
          return;
        }
        submit(event);
      }}
      className="flex flex-col gap-3"
    >
      {state.conflicts?.length ? (
        <ConflictWarning
          conflicts={state.conflicts}
          confirmLabel="Elimina comunque"
          cancelHref="/admin/orari?sezione=eccezioni"
          pending={pending}
        />
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-800/30 px-5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? "Eliminazione…" : "Elimina eccezione"}
        </button>
      )}
    </form>
  );
}
