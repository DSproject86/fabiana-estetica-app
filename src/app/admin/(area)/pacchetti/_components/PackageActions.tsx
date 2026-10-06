"use client";

import { useState, useTransition } from "react";
import { formatEuro } from "@/lib/money";
import { archivePackageAction, deletePackageAction } from "../actions";

/** Archivia / Riapri ed Elimina, con conferma (e avviso se resta qualcosa da pagare). */
export function PackageActions({
  packageId,
  archived,
  completed,
  dueCents,
  remainingSessions,
  canDelete,
}: {
  packageId: string;
  archived: boolean;
  completed: boolean;
  dueCents: number;
  remainingSessions: number;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else setConfirm(null);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => archivePackageAction(packageId, false))}
            className="inline-flex min-h-11 items-center rounded-full bg-cipria/30 px-5 text-sm font-medium hover:bg-cipria/50 disabled:opacity-60"
          >
            Riapri
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm("archive")}
            className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium ${
              completed ? "bg-prugna text-avorio hover:bg-prugna/90" : "bg-cipria/30 hover:bg-cipria/50"
            }`}
          >
            Archivia
          </button>
        )}
        {canDelete ? (
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="inline-flex min-h-11 items-center rounded-full border border-red-800/30 px-5 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            Elimina
          </button>
        ) : null}
      </div>

      {confirm === "archive" ? (
        <div role="alertdialog" aria-label="Conferma archiviazione" className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-prugna/15">
          {dueCents > 0 ? (
            <p className="rounded-xl bg-oro/20 p-3 text-sm font-medium">
              Attenzione: restano {formatEuro(dueCents)} da pagare. Archiviandolo il residuo resta registrato, ma il pacchetto non
              comparirà più tra gli attivi.
            </p>
          ) : null}
          <p className="text-sm">
            {remainingSessions > 0
              ? `Restano ancora ${remainingSessions === 1 ? "1 seduta" : `${remainingSessions} sedute`}: archiviandolo non verranno più proposte in agenda. Archiviare?`
              : "Archiviare il pacchetto? Si può sempre riaprire."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => archivePackageAction(packageId, true))}
              className="min-h-11 rounded-full bg-prugna px-5 text-sm font-medium text-avorio disabled:opacity-60"
            >
              {pending ? "Attendi…" : "Sì, archivia"}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-full px-4 text-sm">
              No
            </button>
          </div>
        </div>
      ) : null}

      {confirm === "delete" ? (
        <div role="alertdialog" aria-label="Conferma eliminazione" className="flex flex-col gap-3 rounded-xl bg-red-50 p-4">
          <p className="text-sm">Eliminare il pacchetto? Non ha pagamenti né sedute scalate.</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deletePackageAction(packageId))}
              className="min-h-11 rounded-full bg-red-800 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Elimino…" : "Sì, elimina"}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-full px-4 text-sm">
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
    </div>
  );
}
