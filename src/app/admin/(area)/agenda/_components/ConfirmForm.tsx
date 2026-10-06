"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "../actions";

/**
 * Riquadro finale di Nuovo / Sposta / Servizi: riepilogo, interruttore email, conferma esplicita
 * per "Fuori orario" e pulsante. I valori viaggiano in campi nascosti; il server ricontrolla tutto.
 */
export function ConfirmForm(props: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  title: string;
  lines: string[];
  submitLabel: string;
  email: { label: string; defaultChecked: boolean; address: string } | null;
  noEmailNote?: string;
  outside: boolean;
}) {
  const [state, formAction, pending] = useActionState(props.action, {});
  return (
    <form
      // Invio senza il reset automatico di React: dopo un errore spunte e interruttori restano come erano.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prugna/10">
      {Object.entries(props.hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <h2 className="text-xl">{props.title}</h2>
      <ul className="flex flex-col gap-0.5 text-sm">
        {props.lines.map((l) => (
          <li key={l} className="first-letter:uppercase">
            {l}
          </li>
        ))}
      </ul>

      {props.outside ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-oro/15 p-3 text-sm">
          <input type="checkbox" name="confermaFuori" value="1" required className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]" />
          <span>
            <strong className="font-medium">Confermo: è fuori dall&apos;orario di lavoro.</strong>
            <span className="block text-xs text-prugna/70">Le sovrapposizioni con altri appuntamenti restano comunque vietate.</span>
          </span>
        </label>
      ) : null}

      {props.email ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-prugna/15 p-3 text-sm">
          <input
            type="checkbox"
            name="email"
            defaultChecked={props.email.defaultChecked}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]"
          />
          <span>
            <span className="font-medium">{props.email.label}</span>
            <span className="block text-xs text-prugna/60">{props.email.address}</span>
          </span>
        </label>
      ) : props.noEmailNote ? (
        <p className="text-xs text-prugna/60">{props.noEmailNote}</p>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-prugna px-6 font-medium text-avorio hover:bg-prugna/90 disabled:opacity-60"
      >
        {pending ? "Attendi…" : props.submitLabel}
      </button>
    </form>
  );
}
