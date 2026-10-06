import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { prisma } from "@/lib/db";
import { centsToInput, formatEuro } from "@/lib/money";
import { loadPackage } from "@/lib/packages/queries";
import { remainingLabel } from "@/lib/packages/rules";
import { dayKeyOf, dbDateToDayKey, formatDayShort, formatTime, todayKey } from "@/lib/time/rome";
import { PackageActions } from "../_components/PackageActions";
import { Payments } from "../_components/Payments";

export const metadata: Metadata = { title: "Pacchetto" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PacchettoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const esito = (await searchParams).esito;
  const p = await loadPackage(id);
  if (!p) notFound();

  const [payments, sessions] = await Promise.all([
    prisma.packagePayment.findMany({ where: { packageId: id }, orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }] }),
    prisma.appointmentItem.findMany({
      where: { clientPackageId: id },
      orderBy: { appointment: { startsAt: "asc" } },
      select: { id: true, name: true, appointment: { select: { startsAt: true } } },
    }),
  ]);
  const s = p.summary;

  return (
    <div className="flex flex-col gap-6">
      <BackHeader
        back={{ href: `/admin/clienti/${p.client.id}`, label: `${p.client.firstName} ${p.client.lastName}` }}
        title={p.name}
        description={[p.coverageLabel ? `Valido per ${p.coverageLabel}` : "Non collegato a un servizio", p.closedAt ? "Archiviato" : null]
          .filter(Boolean)
          .join(" · ")}
      />

      {esito === "venduto" ? (
        <p role="status" className="rounded-2xl bg-salvia/25 p-4 text-sm ring-1 ring-salvia/50">
          Pacchetto venduto a {p.client.firstName} {p.client.lastName}.
        </p>
      ) : null}

      {s.completedWithDue ? (
        <p role="alert" className="rounded-2xl bg-oro/20 p-4 text-sm font-medium ring-1 ring-oro/50">
          Sedute finite, ma restano {formatEuro(s.dueCents)} da pagare.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Prezzo" value={formatEuro(p.priceCents)} />
        <Stat label="Pagato" value={formatEuro(s.paidCents)} />
        <Stat label="Residuo" value={formatEuro(s.dueCents)} strong={s.dueCents > 0} />
        <Stat label="Sedute" value={s.completed ? "Finite" : remainingLabel(s.remainingSessions, p.totalSessions)} />
      </dl>

      <section aria-labelledby="pagamenti" className="flex flex-col gap-3">
        <h2 id="pagamenti" className="text-xl">
          Pagamenti
        </h2>
        <Payments
          packageId={p.id}
          dueCents={s.dueCents}
          today={todayKey()}
          payments={payments.map((x) => ({
            id: x.id,
            paidOn: dbDateToDayKey(x.paidOn),
            dayLabel: formatDayShort(dbDateToDayKey(x.paidOn)),
            amountCents: x.amountCents,
            amountInput: centsToInput(x.amountCents),
            method: x.method,
            note: x.note,
          }))}
        />
      </section>

      <section aria-labelledby="sedute" className="flex flex-col gap-3">
        <h2 id="sedute" className="text-xl">
          Sedute
        </h2>
        <ul className="flex flex-col gap-1 rounded-2xl bg-white p-4 text-sm ring-1 ring-prugna/5">
          {p.sessionsUsedBefore > 0 ? (
            <li>{p.sessionsUsedBefore === 1 ? "1 seduta fatta" : `${p.sessionsUsedBefore} sedute fatte`} prima dell&apos;app</li>
          ) : null}
          {sessions.map((x) => (
            <li key={x.id}>
              {formatDayShort(dayKeyOf(x.appointment.startsAt))} alle {formatTime(x.appointment.startsAt)} · {x.name}
            </li>
          ))}
          {p.sessionsUsedBefore === 0 && sessions.length === 0 ? <li className="text-prugna/60">Nessuna seduta ancora.</li> : null}
          <li className="pt-1 font-medium">
            {s.usedSessions} di {p.totalSessions} usate
          </li>
        </ul>
        {!p.closedAt && p.coverageLabel ? (
          <p className="text-xs text-prugna/60">
            Le sedute si scalano dall&apos;agenda quando segni “Fatto” un appuntamento con un servizio coperto dal pacchetto.
          </p>
        ) : null}
      </section>

      {p.notes ? (
        <section className="flex flex-col gap-1">
          <h2 className="text-xl">Note</h2>
          <p className="whitespace-pre-line text-sm">{p.notes}</p>
        </section>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-oro/20 pt-6">
        <Link
          href={`/admin/pacchetti/${p.id}/modifica`}
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-cipria/30 px-5 text-sm font-medium hover:bg-cipria/50"
        >
          Modifica pacchetto
        </Link>
        <PackageActions
          packageId={p.id}
          archived={!!p.closedAt}
          completed={s.completed}
          dueCents={s.dueCents}
          remainingSessions={s.remainingSessions}
          canDelete={payments.length === 0 && sessions.length === 0}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-2xl p-3 ring-1 ${strong ? "bg-oro/15 ring-oro/40" : "bg-white ring-prugna/5"}`}>
      <dt className="text-xs text-prugna/60">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
