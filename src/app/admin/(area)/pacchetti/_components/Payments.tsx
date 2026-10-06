"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/TextField";
import { formatEuro } from "@/lib/money";
import { addPaymentAction, deletePaymentAction, updatePaymentAction, type PackageFormState } from "../actions";

export type PaymentRow = {
  id: string;
  dayLabel: string;
  paidOn: string;
  amountCents: number;
  amountInput: string;
  method: "CASH" | "CARD";
  note: string | null;
};

const METHOD = { CASH: "Contanti", CARD: "Carta" } as const;

/** Registro dei pagamenti: aggiungi, modifica ed elimina (con conferma). */
export function Payments({
  packageId,
  payments,
  dueCents,
  today,
}: {
  packageId: string;
  payments: PaymentRow[];
  dueCents: number;
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {payments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-4 text-sm text-prugna/70">Nessun pagamento registrato.</p>
      ) : (
        <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
          {payments.map((p) =>
            editing === p.id ? (
              <li key={p.id} className="p-4">
                <PaymentForm
                  action={updatePaymentAction.bind(null, p.id)}
                  initial={{ amount: p.amountInput, method: p.method, paidOn: p.paidOn, note: p.note ?? "" }}
                  today={today}
                  submitLabel="Salva"
                  onDone={() => setEditing(null)}
                  idPrefix={`pay-${p.id}`}
                />
              </li>
            ) : (
              <PaymentItem key={p.id} payment={p} onEdit={() => setEditing(p.id)} />
            ),
          )}
        </ul>
      )}

      {adding ? (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-prugna/10">
          <PaymentForm
            action={addPaymentAction.bind(null, packageId)}
            initial={{ amount: "", method: "CASH", paidOn: today, note: "" }}
            today={today}
            submitLabel="Registra pagamento"
            hint={dueCents > 0 ? `Residuo da pagare: ${formatEuro(dueCents)}.` : undefined}
            onDone={() => setAdding(false)}
            idPrefix="pay-new"
          />
        </div>
      ) : dueCents > 0 ? (
        <Button type="button" variant="secondary" className="w-fit" onClick={() => setAdding(true)}>
          + Registra un pagamento
        </Button>
      ) : null}
    </div>
  );
}

function PaymentItem({ payment: p, onEdit }: { payment: PaymentRow; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-medium tabular-nums">{formatEuro(p.amountCents)}</span>
          <span className="text-sm text-prugna/60">
            {p.dayLabel} · {METHOD[p.method]}
            {p.note ? ` · ${p.note}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onEdit} className="min-h-9 rounded-full bg-cipria/30 px-3 text-xs font-medium hover:bg-cipria/50">
            Modifica
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-9 rounded-full bg-red-50 px-3 text-xs font-medium text-red-800 hover:bg-red-100"
          >
            Elimina
          </button>
        </div>
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label="Conferma eliminazione" className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-3 text-sm">
          <span className="basis-full">
            Eliminare il pagamento di {formatEuro(p.amountCents)} del {p.dayLabel}? Il residuo e le statistiche si aggiornano.
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await deletePaymentAction(p.id);
                if (r.error) setError(r.error);
              })
            }
            className="min-h-10 rounded-full bg-red-800 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Elimino…" : "Sì, elimina"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-full px-3 text-sm">
            No
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function PaymentForm({
  action,
  initial,
  today,
  submitLabel,
  hint,
  onDone,
  idPrefix,
}: {
  action: (prev: PackageFormState, formData: FormData) => Promise<PackageFormState>;
  initial: { amount: string; method: string; paidOn: string; note: string };
  today: string;
  submitLabel: string;
  hint?: string;
  onDone: () => void;
  idPrefix: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const e = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <TextField id={`${idPrefix}-amount`} name="amount" label="Importo (€)" inputMode="decimal" defaultValue={v?.amount ?? initial.amount} error={e.amount} hint={hint} autoFocus />
        <SelectField id={`${idPrefix}-method`} name="method" label="Pagato con" defaultValue={v?.method ?? initial.method} error={e.method}>
          <option value="CASH">Contanti</option>
          <option value="CARD">Carta</option>
        </SelectField>
      </div>
      <TextField id={`${idPrefix}-paidOn`} name="paidOn" label="Data" type="date" max={today} defaultValue={v?.paidOn ?? initial.paidOn} error={e.paidOn} />
      <TextField id={`${idPrefix}-note`} name="note" label="Nota (facoltativa)" defaultValue={v?.note ?? initial.note} error={e.note} maxLength={200} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
