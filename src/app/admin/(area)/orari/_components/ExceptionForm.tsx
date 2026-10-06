"use client";

import { useActionState, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import type { OrariFormState } from "@/lib/schedule/form";
import { ConflictWarning } from "./ConflictWarning";
import { FormError, SaveBar } from "./FormBits";
import { SlotsEditor, newSlotDraft, type SlotDraft } from "./SlotsEditor";
import { useSubmit } from "./useSubmit";

const BACK = "/admin/orari?sezione=eccezioni";

export function ExceptionForm({
  action,
  initial,
  minDate,
  submitLabel,
}: {
  action: (prev: OrariFormState, formData: FormData) => Promise<OrariFormState>;
  initial: { date: string; closed: boolean; note: string; slots: { start: string; end: string }[] };
  minDate: string;
  submitLabel: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [date, setDate] = useState(initial.date);
  const [closed, setClosed] = useState(initial.closed);
  const [note, setNote] = useState(initial.note);
  const [slots, setSlots] = useState<SlotDraft[]>(() => initial.slots.map((s) => newSlotDraft(s.start, s.end)));
  const onSubmit = useSubmit(dispatch);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <TextField
        id="date"
        name="date"
        type="date"
        label="Data"
        min={minDate}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={state.fieldErrors?.date}
        required
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-prugna/15 bg-white p-4">
        <input
          type="checkbox"
          name="closed"
          checked={closed}
          onChange={(e) => setClosed(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Chiuso tutto il giorno</span>
          <span className="text-xs text-prugna/60">Nessuna prenotazione possibile in questa data.</span>
        </span>
      </label>

      {!closed ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Orario di questo giorno</h2>
          <SlotsEditor slots={slots} onChange={setSlots} emptyLabel="Aggiungi almeno una fascia." />
        </section>
      ) : null}

      <TextField
        id="note"
        name="note"
        label="Nota (facoltativa)"
        placeholder="es. ferie, corso di aggiornamento"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={state.fieldErrors?.note}
        maxLength={120}
      />

      <FormError message={state.error} />
      {state.conflicts?.length ? (
        <ConflictWarning conflicts={state.conflicts} confirmLabel="Salva comunque" cancelHref={BACK} pending={pending} />
      ) : (
        <SaveBar pending={pending} label={submitLabel} cancelHref={BACK} />
      )}
    </form>
  );
}

