"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { WhatsAppButton } from "@/components/admin/WhatsAppButton";
import type { AgendaState } from "@/lib/agenda/rules";
import { centsToInput, formatEuro } from "@/lib/money";
import {
  cancelAppointmentAction,
  saveAmountAction,
  setItemPackageAction,
  toggleDoneAction,
  toggleNoShowAction,
} from "../actions";

export type CardData = {
  id: string;
  timeRange: string;
  clientName: string;
  clientId: string;
  /** null se l'impostazione "Mostra note allergie" è spenta. */
  allergyNotes: string | null;
  /** Voci che si possono scalare da un pacchetto della cliente (solo sugli appuntamenti Fatti). */
  packageChoices: {
    itemId: string;
    itemName: string;
    linkedPackageId: string | null;
    options: { id: string; name: string; offerLabel: string; linkedLabel: string }[];
  }[];
  services: string;
  totalCents: number;
  /** Totale senza le voci scalate da un pacchetto (importo precompilato alla spunta "Fatto"). */
  prefillCents: number;
  packageItems: number;
  state: AgendaState;
  amountCents: number | null;
  canOutcome: boolean;
  canEdit: boolean;
  canCancel: boolean;
  noBuffer: boolean;
  online: boolean;
  hasEmail: boolean;
  notifyDefault: boolean;
  /** null per le clienti senza cellulare (eliminate per la privacy). */
  whatsapp: { confirm: string; reminder: string } | null;
};

type Panel = null | "amount" | "more" | "cancel";

export function AppointmentCard({ a }: { a: CardData }) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimisticState] = useOptimistic(a.state);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(a.amountCents !== null ? centsToInput(a.amountCents) : centsToInput(a.prefillCents));
  const [notify, setNotify] = useState(a.notifyDefault);
  const [choices, setOptimisticChoice] = useOptimistic(
    a.packageChoices,
    (current, change: { itemId: string; packageId: string | null }) =>
      current.map((c) => (c.itemId === change.itemId ? { ...c, linkedPackageId: change.packageId } : c)),
  );

  const done = state === "done";
  const noShow = state === "noShow";

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
      else after?.();
    });

  const toggleDone = (next: boolean) =>
    startTransition(async () => {
      setError(null);
      setOptimisticState(next ? "done" : "confirmed");
      const result = await toggleDoneAction(a.id, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (next) {
        setAmount(centsToInput(result.amountCents ?? a.prefillCents));
        setPanel("amount");
      } else setPanel(null);
    });

  return (
    <li
      className={`flex flex-col gap-2 px-4 py-3 transition-colors ${done ? "bg-salvia/20" : ""} ${noShow ? "bg-prugna/5" : ""}`}
      aria-busy={pending}
    >
      <div className="flex gap-3">
        {a.canOutcome && !noShow ? (
          <label className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5 pt-0.5">
            <input
              type="checkbox"
              checked={done}
              disabled={pending}
              onChange={(e) => toggleDone(e.target.checked)}
              className="size-7 accent-[var(--color-salvia)]"
              aria-label={`Fatto: ${a.clientName} ${a.timeRange}`}
            />
            <span className="text-[11px] text-prugna/60">Fatto</span>
          </label>
        ) : null}

        <div className={`flex min-w-0 flex-1 flex-col ${done || noShow ? "text-prugna/70" : ""}`}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={`font-semibold tabular-nums ${done ? "line-through" : ""}`}>{a.timeRange}</span>
            {a.noBuffer ? <span className="text-xs text-prugna/50">senza pausa</span> : null}
            {a.online ? <span className="text-xs text-prugna/50">online</span> : null}
            {noShow ? (
              <span className="rounded-full bg-prugna/10 px-2 py-0.5 text-xs font-medium">Non presentata</span>
            ) : null}
          </div>
          <Link
            href={`/admin/clienti/${a.clientId}`}
            className={`w-fit font-medium underline-offset-2 hover:underline ${done ? "line-through" : ""}`}
          >
            {a.clientName}
          </Link>
          {a.allergyNotes ? <span className="text-xs text-red-800">Allergie: {a.allergyNotes}</span> : null}
          <span className={`text-sm text-prugna/70 ${done ? "line-through" : ""}`}>{a.services}</span>
          <span className="text-sm tabular-nums">
            {formatEuro(a.totalCents)}
            {a.packageItems > 0 ? (
              <span className="text-prugna/60">
                {" "}
                · {a.packageItems === 1 ? "1 voce" : `${a.packageItems} voci`} da pacchetto
              </span>
            ) : null}
            {done && a.amountCents !== null && panel !== "amount" ? (
              <button
                type="button"
                onClick={() => setPanel("amount")}
                className="ml-2 rounded-full bg-salvia/40 px-2 py-0.5 text-xs font-medium"
              >
                Incassato {formatEuro(a.amountCents)} · modifica
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {done && panel === "amount" ? (
        <form
          className="ml-10 flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 ring-1 ring-salvia/50"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveAmountAction(a.id, amount), () => setPanel(null));
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Incassato</span>
            <span className="flex items-center gap-1">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-h-11 w-28 rounded-xl border border-prugna/15 px-3 text-base tabular-nums"
                aria-describedby={`prefill-${a.id}`}
              />
              €
            </span>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-full bg-prugna px-5 text-sm font-medium text-avorio disabled:opacity-60"
          >
            Salva
          </button>
          <button type="button" onClick={() => setPanel(null)} className="min-h-11 px-3 text-sm text-prugna/60">
            Chiudi
          </button>
          <span id={`prefill-${a.id}`} className="basis-full text-xs text-prugna/60">
            Totale {formatEuro(a.prefillCents)}
            {a.packageItems > 0 ? " (escluse le voci da pacchetto)" : ""}: cambialo per sconti o extra.
          </span>
          {choices.length > 0 ? (
            <PackageChoices
              choices={choices}
              disabled={pending}
              onChange={(itemId, packageId) =>
                run(async () => {
                  setOptimisticChoice({ itemId, packageId });
                  const result = await setItemPackageAction(a.id, itemId, packageId);
                  if (result.amountCents !== undefined) setAmount(centsToInput(result.amountCents));
                  return result;
                })
              }
            />
          ) : null}
        </form>
      ) : null}

      <div className={`flex flex-wrap items-center gap-2 ${a.canOutcome && !noShow ? "ml-10" : ""}`}>
        {state === "confirmed" && a.whatsapp ? (
          <>
            <WhatsAppButton compact href={a.whatsapp.confirm} label="Conferma" />
            <WhatsAppButton compact href={a.whatsapp.reminder} label="Promemoria" />
          </>
        ) : null}
        {done ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => toggleDone(false)}
            className="inline-flex min-h-9 items-center rounded-full bg-salvia/50 px-3 text-xs font-medium hover:bg-salvia/70 disabled:opacity-60"
          >
            Fatto ✓ · tocca per annullare
          </button>
        ) : null}
        {noShow ? (
          <SmallButton disabled={pending} onClick={() => run(() => toggleNoShowAction(a.id, false))}>
            Ripristina
          </SmallButton>
        ) : null}
        {state === "confirmed" || done ? (
          <SmallButton disabled={pending} onClick={() => setPanel(panel === "more" ? null : "more")} aria-expanded={panel === "more"}>
            {panel === "more" ? "Chiudi" : "Altro…"}
          </SmallButton>
        ) : null}
      </div>

      {panel === "more" && (state === "confirmed" || done) ? (
        <div className="flex flex-wrap items-center gap-2">
          {a.canEdit ? (
            <>
              <SmallLink href={`/admin/agenda/${a.id}/sposta`}>Sposta</SmallLink>
              <SmallLink href={`/admin/agenda/${a.id}/servizi`}>Servizi</SmallLink>
            </>
          ) : null}
          {a.canOutcome && state === "confirmed" ? (
            <SmallButton disabled={pending} onClick={() => run(() => toggleNoShowAction(a.id, true), () => setPanel(null))}>
              Non presentata
            </SmallButton>
          ) : null}
          {a.canCancel ? (
            <SmallButton disabled={pending} tone="danger" onClick={() => setPanel("cancel")}>
              Annulla appuntamento
            </SmallButton>
          ) : null}
          {done ? (
            <span className="basis-full text-xs text-prugna/60">
              Per spostarlo o cambiare i servizi togli prima la spunta “Fatto”.
            </span>
          ) : null}
        </div>
      ) : null}

      {panel === "cancel" ? (
        <div role="alertdialog" aria-label="Conferma annullamento" className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-red-800/30">
          {done ? (
            <p className="text-sm font-medium">
              Questo appuntamento è segnato come Fatto con {formatEuro(a.amountCents ?? a.prefillCents)} incassati: annullandolo
              l&apos;incasso verrà tolto dalle statistiche. Confermi?
            </p>
          ) : (
            <p className="text-sm font-medium">
              Annullare l&apos;appuntamento di {a.clientName} ({a.timeRange})?
            </p>
          )}
          {a.hasEmail ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="size-5 accent-[var(--color-prugna)]"
              />
              Avvisa la cliente per email
            </label>
          ) : (
            <p className="text-xs text-prugna/60">La cliente non ha l&apos;email: avvisala su WhatsApp dopo l&apos;annullamento.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelAppointmentAction(a.id, a.hasEmail && notify, done))}
              className="min-h-11 rounded-full bg-red-800 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Annullo…" : "Sì, annulla"}
            </button>
            <button type="button" onClick={() => setPanel(null)} className="min-h-11 rounded-full px-4 text-sm hover:bg-cipria/20">
              No
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * "Scala dal pacchetto" per ogni voce coperta: spunta se c'è un solo pacchetto possibile, menu se ce ne
 * sono di più. Si salva subito e l'importo incassato si ricalcola.
 */
function PackageChoices({
  choices,
  disabled,
  onChange,
}: {
  choices: CardData["packageChoices"];
  disabled: boolean;
  onChange: (itemId: string, packageId: string | null) => void;
}) {
  return (
    <fieldset className="flex basis-full flex-col gap-2 border-t border-salvia/40 pt-2">
      <legend className="sr-only">Sedute da pacchetto</legend>
      {choices.map((c) => {
        const linked = c.options.find((o) => o.id === c.linkedPackageId);
        if (c.options.length === 1) {
          const o = c.options[0];
          return (
            <label key={c.itemId} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!linked}
                disabled={disabled}
                onChange={(e) => onChange(c.itemId, e.target.checked ? o.id : null)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-salvia)]"
              />
              <span>
                <span className="font-medium">{c.itemName}</span>: {linked ? o.linkedLabel : o.offerLabel}
              </span>
            </label>
          );
        }
        return (
          <label key={c.itemId} className="flex flex-col gap-1 text-sm">
            <span>
              <span className="font-medium">{c.itemName}</span>
              {linked ? <span className="text-prugna/70">: {linked.linkedLabel}</span> : null}
            </span>
            <select
              value={c.linkedPackageId ?? ""}
              disabled={disabled}
              onChange={(e) => onChange(c.itemId, e.target.value || null)}
              className="min-h-11 rounded-xl border border-prugna/15 bg-white px-3 text-base"
            >
              <option value="">Non scalare (pagata a parte)</option>
              {c.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.offerLabel.replace("Scala dal pacchetto ", "")}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </fieldset>
  );
}

function SmallButton({
  tone = "normal",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "normal" | "danger" }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-medium disabled:opacity-60 ${
        tone === "danger" ? "bg-red-50 text-red-800 hover:bg-red-100" : "bg-cipria/30 hover:bg-cipria/50"
      } ${className}`}
      {...props}
    />
  );
}

function SmallLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-9 items-center rounded-full bg-cipria/30 px-3 text-xs font-medium hover:bg-cipria/50">
      {children}
    </Link>
  );
}
