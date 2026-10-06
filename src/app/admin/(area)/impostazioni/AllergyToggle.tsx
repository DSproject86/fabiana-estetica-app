"use client";

import { useOptimistic, useTransition } from "react";
import { setShowAllergyNotesAction } from "./actions";

/** Interruttore "Mostra note allergie": si salva subito. */
export function AllergyToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useOptimistic(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <label htmlFor="show-allergy" className="flex cursor-pointer items-start gap-3 rounded-xl border border-prugna/15 bg-white p-4">
      <input
        id="show-allergy"
        type="checkbox"
        role="switch"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            setOn(next);
            await setShowAllergyNotesAction(next);
          });
        }}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Mostra note allergie</span>
        <span className="text-xs text-prugna/60">
          Campo allergie in agenda e nella scheda cliente. Spento, le note già scritte restano salvate ma non si vedono.
        </span>
      </span>
    </label>
  );
}
