import Link from "next/link";
import type { ConflictItem } from "@/lib/schedule/queries";

/** Elenco degli appuntamenti toccati dalla modifica, con "Salva comunque" / "Annulla". */
export function ConflictWarning({
  conflicts,
  confirmLabel,
  cancelHref,
  pending,
}: {
  conflicts: ConflictItem[];
  confirmLabel: string;
  cancelHref: string;
  pending: boolean;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-oro/60 bg-oro/10 p-4">
      <p className="font-medium">
        Attenzione: {conflicts.length === 1 ? "c'è 1 appuntamento" : `ci sono ${conflicts.length} appuntamenti`} già
        preso{conflicts.length === 1 ? "" : "i"} che resterebbe{conflicts.length === 1 ? "" : "ro"} fuori orario.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {conflicts.map((c) => (
          <li key={c.id} className="rounded-xl bg-white px-3 py-2">
            <span className="font-medium">{c.when}</span> · {c.client}
            {c.services ? <span className="block text-prugna/60">{c.services}</span> : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-prugna/70">
        Gli appuntamenti non vengono cancellati: se salvi, restano in agenda e potrai spostarli o avvisare le clienti.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium hover:bg-cipria/20">
          Annulla
        </Link>
        <button
          type="submit"
          name="confirm"
          value="1"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90 disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
