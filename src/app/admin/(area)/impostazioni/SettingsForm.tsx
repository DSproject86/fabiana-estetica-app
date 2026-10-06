"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/TextField";
import { SETTINGS_OPTIONS, formatNotice, type SettingsValues } from "@/lib/settings/schema";
import { saveSettings, type SettingsFormState } from "./actions";

const minutes = (v: number) => (v === 0 ? "Nessuna" : `${v} minuti`);

const FIELDS: {
  key: keyof SettingsValues;
  label: string;
  hint: string;
  format: (v: number) => string;
}[] = [
  {
    key: "slotGridMin",
    label: "Griglia degli orari d'inizio",
    hint: "Ogni quanto può iniziare un appuntamento (es. 30 → 9:00, 9:30, 10:00…).",
    format: (v) => `Ogni ${v} minuti`,
  },
  {
    key: "durationRoundingMin",
    label: "Arrotondamento della durata",
    hint: "La somma dei servizi scelti viene arrotondata per eccesso a questo multiplo (es. 50 min → 60).",
    format: (v) => `${v} minuti`,
  },
  {
    key: "bufferMin",
    label: "Pausa dopo ogni appuntamento",
    hint: "Tempo libero tra un appuntamento e il successivo. L'ultimo può finire all'orario di chiusura.",
    format: minutes,
  },
  {
    key: "minNoticeMin",
    label: "Preavviso minimo",
    hint: "Quanto prima, al minimo, si può prenotare.",
    format: formatNotice,
  },
  {
    key: "bookingHorizonMonths",
    label: "Prenotabile fino a",
    hint: "Quanti mesi avanti le clienti vedono gli orari liberi.",
    format: (v) => (v === 1 ? "1 mese" : `${v} mesi`),
  },
  {
    key: "reminderHour",
    label: "Ora del promemoria",
    hint: "A che ora parte l'email di promemoria il giorno prima dell'appuntamento.",
    format: (v) => `${String(v).padStart(2, "0")}:00`,
  },
];

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(saveSettings, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {FIELDS.map((f) => (
        <SelectField key={f.key} id={f.key} name={f.key} label={f.label} hint={f.hint} defaultValue={String(initial[f.key])}>
          {SETTINGS_OPTIONS[f.key].map((v) => (
            <option key={v} value={v}>
              {f.format(v)}
            </option>
          ))}
        </SelectField>
      ))}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}
      {state.saved && !pending ? (
        <p role="status" className="rounded-xl bg-salvia/25 px-4 py-3 text-sm">
          Impostazioni salvate.
        </p>
      ) : null}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva impostazioni"}
        </Button>
      </div>
    </form>
  );
}
