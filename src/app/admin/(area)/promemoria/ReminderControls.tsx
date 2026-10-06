"use client";

import { useOptimistic, useState, useTransition } from "react";
import { retryReminderAction, setWhatsappSentAction } from "./actions";

/** Spunta "WhatsApp inviato" (reversibile), salvata subito. */
export function WhatsappSentToggle({ appointmentId, sent }: { appointmentId: string; sent: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(sent);
  const [pending, startTransition] = useTransition();
  const toggle = (next: boolean) =>
    startTransition(async () => {
      setOptimistic(next);
      await setWhatsappSentAction(appointmentId, next);
    });

  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={optimistic}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
        className="size-5 accent-[var(--color-salvia)]"
      />
      WhatsApp inviato
    </label>
  );
}

/** "Riprova" su un promemoria email non riuscito (un solo invio anche con più clic). */
export function RetryReminderButton({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const retry = () =>
    startTransition(async () => {
      setError(null);
      const result = await retryReminderAction(appointmentId);
      if (result.error) setError(result.error);
    });

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="inline-flex min-h-9 w-fit items-center rounded-full bg-cipria/30 px-3 text-xs font-medium hover:bg-cipria/50 disabled:opacity-60"
      >
        {pending ? "Invio…" : "Riprova"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-800">
          {error}
        </span>
      ) : null}
    </span>
  );
}
