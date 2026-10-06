import type { Metadata } from "next";
import Link from "next/link";
import { BackHeader } from "@/components/admin/BackHeader";
import { searchClients } from "@/lib/clients/adminClients";
import { formatPhone } from "@/lib/clients/phone";
import { prisma } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import { coverageOptions } from "@/lib/packages/queries";
import { encodeCoverage } from "@/lib/packages/rules";
import { todayKey } from "@/lib/time/rome";
import { sellPackageAction } from "../actions";
import { PackageForm } from "../_components/PackageForm";

export const metadata: Metadata = { title: "Vendi pacchetto" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function VendiPacchettoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const clientId = first(params.cliente);
  const q = first(params.q).slice(0, 100);
  const client = clientId
    ? await prisma.client.findFirst({ where: { id: clientId, anonymizedAt: null }, select: { id: true, firstName: true, lastName: true } })
    : null;

  if (!client) {
    const results = await searchClients(q);
    return (
      <div className="flex flex-col gap-6">
        <BackHeader back={{ href: "/admin/pacchetti", label: "Pacchetti" }} title="Vendi pacchetto" description="A quale cliente?" />
        <form method="get" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nome, cognome, cellulare o email"
            aria-label="Cerca una cliente"
            autoFocus
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-prugna/15 bg-white px-4 text-base"
          />
          <button type="submit" className="min-h-12 rounded-full bg-prugna px-5 text-sm font-medium text-avorio">
            Cerca
          </button>
        </form>
        {results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-prugna/10 overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
            {!q ? <li className="px-4 py-2 text-xs text-prugna/50">Ultime clienti</li> : null}
            {results.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/pacchetti/nuovo?cliente=${c.id}`} className="flex min-h-14 flex-col justify-center px-4 py-2 hover:bg-cipria/15">
                  <span className="font-medium">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-sm text-prugna/60">
                    {formatPhone(c.phone)}
                    {c.email ? ` · ${c.email}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : q ? (
          <p className="text-sm text-prugna/60">
            Nessuna cliente trovata. Puoi crearla da{" "}
            <Link href="/admin/clienti/nuova" className="underline underline-offset-2">
              Clienti
            </Link>
            .
          </p>
        ) : null}
      </div>
    );
  }

  const [templates, coverage] = await Promise.all([
    prisma.packageTemplate.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, sessions: true, priceCents: true, serviceId: true, categoryId: true },
    }),
    coverageOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <BackHeader
        back={{ href: `/admin/clienti/${client.id}`, label: `${client.firstName} ${client.lastName}` }}
        title="Vendi pacchetto"
        description={`Per ${client.firstName} ${client.lastName}.`}
      />
      <PackageForm
        action={sellPackageAction}
        mode="sell"
        clientId={client.id}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          sessions: String(t.sessions),
          price: centsToInput(t.priceCents),
          coverage: encodeCoverage(t),
        }))}
        coverage={coverage}
        initial={{ name: "", totalSessions: "", price: "", coverage: "", sessionsUsedBefore: "0", notes: "" }}
        today={todayKey()}
        cancelHref={`/admin/clienti/${client.id}`}
      />
    </div>
  );
}
