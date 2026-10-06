"use client";

import { useActionState, useState } from "react";
import type { OrariFormState } from "@/lib/schedule/form";
import { WEEKDAY_SHORT } from "@/lib/time/rome";
import { ConflictWarning } from "./ConflictWarning";
import { FormError, SaveBar } from "./FormBits";
import { SlotsEditor, newSlotDraft, type SlotDraft } from "./SlotsEditor";
import { useSubmit } from "./useSubmit";

const BACK = "/admin/orari?sezione=settimana";

export function WeekdayForm({
  weekday,
  initialSlots,
  action,
}: {
  weekday: number;
  initialSlots: { start: string; end: string }[];
  action: (prev: OrariFormState, formData: FormData) => Promise<OrariFormState>;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [slots, setSlots] = useState<SlotDraft[]>(() => initialSlots.map((s) => newSlotDraft(s.start, s.end)));
  const [applyTo, setApplyTo] = useState<number[]>([]);
  const onSubmit = useSubmit(dispatch);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Fasce orarie</h2>
        <SlotsEditor slots={slots} onChange={setSlots} emptyLabel="Nessuna fascia: in questo giorno sei chiusa." />
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-serif">Applica lo stesso orario anche a</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((label, i) => {
            const d = i + 1;
            if (d === weekday) return null;
            const checked = applyTo.includes(d);
            return (
              <label
                key={d}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm capitalize ${
                  checked ? "border-prugna bg-prugna text-avorio" : "border-prugna/15 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  name="applyTo"
                  value={d}
                  checked={checked}
                  onChange={(e) => setApplyTo(e.target.checked ? [...applyTo, d] : applyTo.filter((x) => x !== d))}
                  className="sr-only"
                />
                {label}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-prugna/60">Gli orari dei giorni scelti verranno sostituiti con questi.</p>
      </fieldset>

      <FormError message={state.error} />
      {state.conflicts?.length ? (
        <ConflictWarning conflicts={state.conflicts} confirmLabel="Salva comunque" cancelHref={BACK} pending={pending} />
      ) : (
        <SaveBar pending={pending} label="Salva orario" cancelHref={BACK} />
      )}
    </form>
  );
}
