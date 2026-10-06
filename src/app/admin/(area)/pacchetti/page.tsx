import type { Metadata } from "next";
import Link from "next/link";
import { formatEuro } from "@/lib/money";
import { loadPackages } from "@/lib/packages/queries";
import { PackageRow } from "./_components/PackageRow";

export const metadata: Metadata = { title: "Pacchetti" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VIEWS = {
  attivi: "Attivi",
  residuo: "Con residuo da pagare",
  archiviati: "Archiviati",
} as const;
type View = keyof typeof VIEWS;

export default async function PacchettiPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).vista;
  const view: View = typeof raw === "string" && raw in VIEWS ? (raw as View) : "attivi";

  const all = await loadPackages(view === "archiviati" ? { closedAt: { not: null } } : view === "attivi" ? { closedAt: null } : {});
  // "Con residuo" comprende anche gli archiviati: un residuo non pagato non deve sparire.
  const packages = view === "residuo" ? all.filter((p) => p.summary.dueCents > 0) : all;
  const totalDue = packages.reduce((sum, p) => sum + p.summary.dueCents, 0);
  const completedWithDue = packages.filter((p) => p.summary.completedWithDue).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Pacchetti</h1>
        <Link
          href="/admin/pacchetti/nuovo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90"
        >
          <span aria-hidden className="text-lg leading-none">+</span> Vendi
        </Link>
      </header>

      <nav aria-label="Filtro pacchetti" className="flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={v === "attivi" ? "/admin/pacchetti" : `/admin/pacchetti?vista=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ${
              v === view ? "bg-prugna text-avorio" : "bg-cipria/25 hover:bg-cipria/40"
            }`}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </nav>

      {packages.length > 0 && view !== "archiviati" ? (
        <p className="text-sm text-prugna/70">
          {packages.length === 1 ? "1 pacchetto" : `${packages.length} pacchetti`}
          {totalDue > 0 ? ` · da incassare ${formatEuro(totalDue)}` : ""}
          {completedWithDue > 0 ? (
            <strong className="font-medium text-red-800">
              {" "}
              · {completedWithDue === 1 ? "1 con sedute finite" : `${completedWithDue} con sedute finite`} e residuo
            </strong>
          ) : null}
        </p>
      ) : null}

      {packages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-4 text-sm text-prugna/70">
          {view === "residuo"
            ? "Nessun pacchetto con un residuo da pagare."
            : view === "archiviati"
              ? "Nessun pacchetto archiviato."
              : "Nessun pacchetto attivo. Vendine uno con “+ Vendi” o dalla scheda di una cliente."}
        </p>
      ) : (
        <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
          {packages.map((p) => (
            <PackageRow key={p.id} p={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
