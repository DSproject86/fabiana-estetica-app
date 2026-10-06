"use client";

import { useActionState, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import type { OrariFormState } from "@/lib/schedule/form";
import { ConflictWarning } from "./ConflictWarning";
import { FormError, SaveBar } from "./FormBits";
import { useSubmit } from "./useSubmit";

const BACK = "/admin/orari?sezione=blocchi";

/** Ora attuale a Roma arrotondata ai 5 minuti successivi, in minuti dalla mezzanotte. */
function nowRomeMinutes(): number {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return Math.ceil((h * 60 + m) / 5) * 5;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function BlockForm({
  action,
  today,
  initialDate,
}: {
  action: (prev: OrariFormState, formData: FormData) => Promise<OrariFormState>;
  today: string;
  initialDate: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const onSubmit = useSubmit(dispatch);

  const quick = (minutes: number) => {
    const from = Math.min(nowRomeMinutes(), 1435);
    const to = Math.min(from + minutes, 1435);
    setDate(today);
    setStart(hhmm(from));
    setEnd(hhmm(to));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Da adesso per…</p>
        <div className="flex flex-wrap gap-2">
          {[
            [30, "30 min"],
            [60, "1 ora"],
            [120, "2 ore"],
          ].map(([minutes, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => quick(Number(minutes))}
              className="inline-flex min-h-11 items-center rounded-full bg-cipria/25 px-4 text-sm font-medium hover:bg-cipria/40"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <TextField
        id="date"
        name="date"
        type="date"
        label="Data"
        min={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={state.fieldErrors?.date}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField id="start" name="start" type="time" step={300} label="Dalle" value={start} onChange={(e) => setStart(e.target.value)} required />
        <TextField id="end" name="end" type="time" step={300} label="Alle" value={end} onChange={(e) => setEnd(e.target.value)} required />
      </div>
      <TextField
        id="reason"
        name="reason"
        label="Motivo (facoltativo)"
        placeholder="es. commissione, visita medica"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={state.fieldErrors?.reason}
        maxLength={120}
      />

      <FormError message={state.error} />
      {state.conflicts?.length ? (
        <ConflictWarning conflicts={state.conflicts} confirmLabel="Blocca comunque" cancelHref={BACK} pending={pending} />
      ) : (
        <SaveBar pending={pending} label="Blocca fascia" cancelHref={BACK} />
      )}
    </form>
  );
}
