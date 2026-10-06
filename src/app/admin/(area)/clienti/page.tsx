import type { Metadata } from "next";
import Link from "next/link";
import { listClients } from "@/lib/clients/adminClients";
import { formatPhone } from "@/lib/clients/phone";

export const metadata: Metadata = { title: "Clienti" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ClientiPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = first(params.q).slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number.parseInt(first(params.pagina), 10) || 1));
  const { clients, total, pages } = await listClients(q, page);
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (n > 1) sp.set("pagina", String(n));
    const s = sp.toString();
    return s ? `/admin/clienti?${s}` : "/admin/clienti";
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Clienti</h1>
        <Link
          href="/admin/clienti/nuova"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90"
        >
          <span aria-hidden className="text-lg leading-none">+</span> Nuova
        </Link>
      </header>

      {first(params.esito) === "eliminata" ? (
        <p role="status" className="rounded-2xl bg-salvia/25 p-4 text-sm ring-1 ring-salvia/50">
          Cliente eliminata: non aveva appuntamenti né pacchetti, quindi non è rimasto niente.
        </p>
      ) : null}

      <form method="get" className="flex gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nome, cognome, cellulare o email"
          aria-label="Cerca una cliente"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-prugna/15 bg-white px-4 text-base"
        />
        <button type="submit" className="min-h-12 rounded-full bg-prugna px-5 text-sm font-medium text-avorio">
          Cerca
        </button>
      </form>

      <p className="text-sm text-prugna/60">
        {total === 0
          ? q
            ? "Nessuna cliente trovata."
            : "Nessuna cliente ancora."
          : `${total === 1 ? "1 cliente" : `${total} clienti`}${q ? ` per “${q}”` : ""}`}
        {q ? (
          <>
            {" · "}
            <Link href="/admin/clienti" className="underline underline-offset-2">
              mostra tutte
            </Link>
          </>
        ) : null}
      </p>

      {clients.length > 0 ? (
        <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clienti/${c.id}`} className="flex min-h-14 flex-col justify-center px-4 py-2 hover:bg-cipria/10">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {c.lastName} {c.firstName}
                  {c.blockedAt ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">bloccata</span> : null}
                  {c._count.packages > 0 ? (
                    <span className="rounded-full bg-oro/20 px-2 py-0.5 text-xs font-medium">
                      {c._count.packages === 1 ? "1 pacchetto" : `${c._count.packages} pacchetti`}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-prugna/60">
                  {formatPhone(c.phone)}
                  {c.email ? ` · ${c.email}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {pages > 1 ? (
        <nav aria-label="Pagine" className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="inline-flex min-h-11 items-center rounded-full bg-cipria/25 px-4 font-medium">
              ← Precedenti
            </Link>
          ) : (
            <span />
          )}
          <span className="text-prugna/60">
            Pagina {page} di {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="inline-flex min-h-11 items-center rounded-full bg-cipria/25 px-4 font-medium">
              Successive →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
