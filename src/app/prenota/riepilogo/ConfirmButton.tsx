"use client";

import { useFormStatus } from "react-dom";

export function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-prugna px-6 py-3 text-base font-medium text-avorio transition-colors hover:bg-prugna/90 disabled:opacity-60"
    >
      {pending ? "Prenotazione in corso…" : "Conferma prenotazione"}
    </button>
  );
}
