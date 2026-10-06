import Link from "next/link";
import { formatEuro } from "@/lib/money";
import type { PackageWithSummary } from "@/lib/packages/queries";
import { remainingLabel } from "@/lib/packages/rules";

/** Riga di un pacchetto: sedute rimaste, residuo e avviso "sedute finite ma da pagare". */
export function PackageRow({ p, showClient = true }: { p: PackageWithSummary; showClient?: boolean }) {
  const s = p.summary;
  return (
    <li>
      <Link href={`/admin/pacchetti/${p.id}`} className="flex min-h-16 flex-col gap-1 px-4 py-3 hover:bg-cipria/10">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-medium">
            {showClient ? `${p.client.firstName} ${p.client.lastName} · ` : ""}
            {p.name}
          </span>
          {s.dueCents > 0 ? (
            <span className="rounded-full bg-oro/25 px-2 py-0.5 text-xs font-medium tabular-nums">Residuo {formatEuro(s.dueCents)}</span>
          ) : (
            <span className="text-xs text-prugna/60">Pagato</span>
          )}
        </span>
        <span className="text-sm text-prugna/70">
          {s.completed ? "Sedute finite" : `Sedute: ${remainingLabel(s.remainingSessions, p.totalSessions)}`}
          {p.coverageLabel ? ` · ${p.coverageLabel}` : ""}
          {p.closedAt ? " · archiviato" : ""}
        </span>
        {s.completedWithDue ? (
          <span className="text-xs font-medium text-red-800">Sedute finite ma restano {formatEuro(s.dueCents)} da pagare</span>
        ) : s.completed && !p.closedAt ? (
          <span className="text-xs text-prugna/60">Completato: si può archiviare</span>
        ) : null}
      </Link>
    </li>
  );
}
