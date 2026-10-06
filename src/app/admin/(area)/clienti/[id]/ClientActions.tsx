"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteClientAction, setClientBlockedAction, type DeleteClientState } from "../actions";

/** Blocca/sblocca e "Elimina cliente" (privacy) con conferma scrivendo il cognome. */
export function ClientActions({
  clientId,
  lastName,
  blocked,
  hasHistory,
  futureCount,
}: {
  clientId: string;
  lastName: string;
  blocked: boolean;
  hasHistory: boolean;
  futureCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [blockError, setBlockError] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [state, formAction, deleting] = useActionState<DeleteClientState, FormData>(deleteClientAction.bind(null, clientId), {});

  const toggleBlock = (next: boolean) =>
    startTransition(async () => {
      setBlockError(null);
      const r = await setClientBlockedAction(clientId, next);
      if (r.error) setBlockError(r.error);
      setConfirmBlock(false);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {blocked ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => toggleBlock(false)}
            className="inline-flex min-h-11 w-fit items-center rounded-full bg-cipria/30 px-5 text-sm font-medium hover:bg-cipria/50 disabled:opacity-60"
          >
            Sblocca
          </button>
        ) : confirmBlock ? (
          <div role="alertdialog" aria-label="Conferma blocco" className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-prugna/15">
            <p className="text-sm">
              Bloccandola esce subito dall&apos;app e non può più prenotare online. Gli appuntamenti già presi restano: se serve
              annullali dall&apos;agenda.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => toggleBlock(true)}
                className="min-h-11 rounded-full bg-prugna px-5 text-sm font-medium text-avorio disabled:opacity-60"
              >
                {pending ? "Attendi…" : "Sì, blocca"}
              </button>
              <button type="button" onClick={() => setConfirmBlock(false)} className="min-h-11 rounded-full px-4 text-sm">
                No
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmBlock(true)}
            className="inline-flex min-h-11 w-fit items-center rounded-full bg-cipria/30 px-5 text-sm font-medium hover:bg-cipria/50"
          >
            Blocca
          </button>
        )}
        {blockError ? (
          <p role="alert" className="text-sm text-red-800">
            {blockError}
          </p>
        ) : null}
      </div>

      {showDelete ? (
        <form action={formAction} className="flex flex-col gap-3 rounded-xl bg-red-50 p-4">
          <p className="text-sm font-medium">Elimina cliente (richiesta privacy)</p>
          {futureCount > 0 ? (
            <p className="text-sm">
              Ha {futureCount === 1 ? "1 appuntamento" : `${futureCount} appuntamenti`} in programma: annullali prima dall&apos;agenda.
            </p>
          ) : (
            <p className="text-sm">
              {hasHistory
                ? "Ha uno storico: nome, cellulare, email, note e allergie verranno cancellati per sempre; restano solo date, servizi e importi per le statistiche, a nome “Cliente eliminata”."
                : "Non ha appuntamenti né pacchetti: verrà cancellata del tutto."}{" "}
              Non si può tornare indietro.
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Per confermare scrivi il cognome: <strong>{lastName}</strong>
            </span>
            <input
              name="conferma"
              autoComplete="off"
              className="min-h-11 rounded-xl border border-red-800/30 bg-white px-3 text-base"
              disabled={futureCount > 0}
            />
          </label>
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-red-800">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={deleting || futureCount > 0}
              className="min-h-11 rounded-full bg-red-800 px-5 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleting ? "Elimino…" : "Elimina per sempre"}
            </button>
            <button type="button" onClick={() => setShowDelete(false)} className="min-h-11 rounded-full px-4 text-sm">
              Annulla
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="inline-flex min-h-11 w-fit items-center rounded-full border border-red-800/30 px-5 text-sm font-medium text-red-800 hover:bg-red-50"
        >
          Elimina cliente…
        </button>
      )}
    </div>
  );
}
