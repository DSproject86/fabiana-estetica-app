"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/TextField";
import { sendTestEmailAction, type TestEmailState } from "./actions";

/** "Invia email di prova" all'indirizzo dell'admin collegato, coi dati di esempio e il testo salvato. */
export function TestEmailForm({
  adminEmail,
  options,
  fixedKind,
}: {
  adminEmail: string;
  options: { kind: string; label: string }[];
  fixedKind?: string;
}) {
  const [state, formAction, pending] = useActionState<TestEmailState, FormData>(sendTestEmailAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-prugna/5">
      <div className="flex flex-col gap-1">
        <span className="font-medium">Invia email di prova</span>
        <span className="text-xs text-prugna/60">
          Arriva a {adminEmail} con dati di esempio e il testo salvato (salva prima le modifiche).
        </span>
      </div>
      {fixedKind ? (
        <input type="hidden" name="kind" value={fixedKind} />
      ) : (
        <SelectField id="test-kind" name="kind" label="Quale email" defaultValue={options[0]?.kind}>
          {options.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label}
            </option>
          ))}
        </SelectField>
      )}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}
      {state.info && !pending ? (
        <p role="status" className="rounded-xl bg-salvia/25 px-4 py-3 text-sm">
          {state.info}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending} className="w-fit">
        {pending ? "Invio…" : "Invia email di prova"}
      </Button>
    </form>
  );
}
