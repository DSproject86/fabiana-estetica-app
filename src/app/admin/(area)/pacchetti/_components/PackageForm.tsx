"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CoverageSelect, type CoverageGroup } from "@/components/admin/CoverageSelect";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/TextField";
import type { PackageFormState } from "../actions";

export type TemplateOption = { id: string; name: string; sessions: string; price: string; coverage: string };

export type PackageFormInitial = {
  name: string;
  totalSessions: string;
  price: string;
  coverage: string;
  sessionsUsedBefore: string;
  notes: string;
};

/**
 * Vendita (da un pacchetto a listino o personalizzato, con acconto facoltativo) e modifica di un pacchetto.
 * Scegliendo un pacchetto a listino i campi si riempiono, ma restano modificabili.
 */
export function PackageForm({
  action,
  mode,
  clientId,
  templates = [],
  coverage,
  initial,
  today,
  cancelHref,
}: {
  action: (prev: PackageFormState, formData: FormData) => Promise<PackageFormState>;
  mode: "sell" | "edit";
  clientId?: string;
  templates?: TemplateOption[];
  coverage: CoverageGroup[];
  initial: PackageFormInitial;
  today: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const [templateId, setTemplateId] = useState(v?.templateId ?? "");
  const [fields, setFields] = useState({
    name: v?.name ?? initial.name,
    totalSessions: v?.totalSessions ?? initial.totalSessions,
    price: v?.price ?? initial.price,
    coverage: v?.coverage ?? initial.coverage,
  });
  const set = (key: keyof typeof fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setFields({ name: t.name, totalSessions: t.sessions, price: t.price, coverage: t.coverage });
  };

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}

      {mode === "sell" && templates.length > 0 ? (
        <SelectField
          id="templateId"
          name="templateId"
          label="Dal listino"
          hint="Scegli un pacchetto a listino per riempire i campi, oppure lascia “Personalizzato”."
          value={templateId}
          onChange={(ev) => chooseTemplate(ev.target.value)}
        >
          <option value="">Personalizzato</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <TextField
        id="name"
        name="name"
        label="Nome del pacchetto"
        placeholder="es. 5 massaggi"
        value={fields.name}
        onChange={(ev) => set("name")(ev.target.value)}
        error={e.name}
        maxLength={80}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          id="totalSessions"
          name="totalSessions"
          label="Sedute"
          inputMode="numeric"
          value={fields.totalSessions}
          onChange={(ev) => set("totalSessions")(ev.target.value)}
          error={e.totalSessions}
          required
        />
        <TextField
          id="price"
          name="price"
          label="Prezzo totale (€)"
          inputMode="decimal"
          value={fields.price}
          onChange={(ev) => set("price")(ev.target.value)}
          error={e.price}
          required
        />
      </div>
      <CoverageSelect groups={coverage} value={fields.coverage} onChange={set("coverage")} error={e.coverage} />
      <TextField
        id="sessionsUsedBefore"
        name="sessionsUsedBefore"
        label="Sedute già fatte prima dell'app"
        inputMode="numeric"
        defaultValue={v?.sessionsUsedBefore ?? initial.sessionsUsedBefore}
        error={e.sessionsUsedBefore}
        hint="Per i pacchetti iniziati su carta. 0 se è nuovo."
      />
      <TextAreaField
        id="notes"
        name="notes"
        label="Note (facoltative)"
        defaultValue={v?.notes ?? initial.notes}
        error={e.notes}
        maxLength={300}
      />

      {mode === "sell" ? (
        <fieldset className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-prugna/10">
          <legend className="px-1 text-sm font-medium">Acconto oggi (facoltativo)</legend>
          <div className="grid grid-cols-2 gap-4">
            <TextField id="amount" name="amount" label="Importo (€)" inputMode="decimal" defaultValue={v?.amount ?? ""} error={e.amount} />
            <SelectField id="method" name="method" label="Pagato con" defaultValue={v?.method ?? "CASH"} error={e.method}>
              <option value="CASH">Contanti</option>
              <option value="CARD">Carta</option>
            </SelectField>
          </div>
          <TextField id="paidOn" name="paidOn" label="Data" type="date" max={today} defaultValue={v?.paidOn ?? today} error={e.paidOn} />
          <TextField id="note" name="note" label="Nota del pagamento" defaultValue={v?.note ?? ""} error={e.note} maxLength={200} />
        </fieldset>
      ) : null}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium hover:bg-cipria/20">
          Annulla
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : mode === "sell" ? "Vendi pacchetto" : "Salva modifiche"}
        </Button>
      </div>
    </form>
  );
}
