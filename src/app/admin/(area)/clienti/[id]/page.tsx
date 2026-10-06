import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { WhatsAppButton } from "@/components/admin/WhatsAppButton";
import { agendaState, type AgendaState } from "@/lib/agenda/rules";
import { loadSettings } from "@/lib/availability/queries";
import { formatPhone } from "@/lib/clients/phone";
import { loadClientTotals } from "@/lib/clients/manage";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/money";
import { loadPackages } from "@/lib/packages/queries";
import { dayKeyOf, formatDayShort, formatTime } from "@/lib/time/rome";
import { whatsappChatLink } from "@/lib/whatsapp";
import { PackageRow } from "../../pacchetti/_components/PackageRow";
import { ClientActions } from "./ClientActions";

export const metadata: Metadata = { title: "Scheda cliente" };

const HISTORY_LIMIT = 100;

const STATE_LABEL: Record<AgendaState, string> = {
  confirmed: "Confermato",
  done: "Fatto",
  noShow: "Non presentata",
  cancelled: "Annullato",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SchedaClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const esito = (await searchParams).esito;
  const now = new Date();
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const [settings, totals, packages, appointments, appointmentCount] = await Promise.all([
    loadSettings(),
    loadClientTotals(id),
    loadPackages({ clientId: id }),
    prisma.appointment.findMany({
      where: { clientId: id },
      orderBy: { startsAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        startsAt: true,
        status: true,
        doneAt: true,
        totalPriceCents: true,
        amountCollectedCents: true,
        items: { orderBy: { sortOrder: "asc" }, select: { name: true, clientPackageId: true } },
      },
    }),
    prisma.appointment.count({ where: { clientId: id } }),
  ]);
  const anonymized = !!client.anonymizedAt;
  const active = packages.filter((p) => !p.closedAt);
  const archived = packages.filter((p) => p.closedAt);
  const upcoming = appointments.filter((a) => a.status === "CONFIRMED" && a.startsAt >= now).reverse();
  const past = appointments.filter((a) => !(a.status === "CONFIRMED" && a.startsAt >= now));
  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <div className="flex flex-col gap-6">
      <BackHeader
        back={{ href: "/admin/clienti", label: "Clienti" }}
        title={anonymized ? "Cliente eliminata" : fullName}
        description={
          anonymized
            ? `Dati personali cancellati il ${formatDayShort(dayKeyOf(client.anonymizedAt!))}: restano solo date, servizi e importi.`
            : client.source === "INVITE"
              ? `Iscritta dal link il ${formatDayShort(dayKeyOf(client.createdAt))}`
              : `Inserita da voi il ${formatDayShort(dayKeyOf(client.createdAt))}`
        }
      />

      {esito === "anonimizzata" ? (
        <p role="status" className="rounded-2xl bg-salvia/25 p-4 text-sm ring-1 ring-salvia/50">
          Dati personali eliminati. Lo storico resta solo per le statistiche.
        </p>
      ) : null}

      {!anonymized ? (
        <section aria-label="Contatti" className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-prugna/5">
          {client.blockedAt ? (
            <p className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
              Bloccata dal {formatDayShort(dayKeyOf(client.blockedAt))}
            </p>
          ) : null}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-prugna/60">Cellulare</dt>
              <dd>
                <a href={`tel:${client.phone}`} className="underline-offset-2 hover:underline">
                  {formatPhone(client.phone)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-prugna/60">Email</dt>
              <dd className="break-all">{client.email ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton href={whatsappChatLink(client.phone)} label="WhatsApp" />
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="inline-flex min-h-11 items-center rounded-full bg-cipria/30 px-4 text-sm font-medium hover:bg-cipria/50"
              >
                Email
              </a>
            ) : null}
            <Link
              href={`/admin/agenda/nuovo?cliente=${client.id}`}
              className="inline-flex min-h-11 items-center rounded-full bg-cipria/30 px-4 text-sm font-medium hover:bg-cipria/50"
            >
              Nuovo appuntamento
            </Link>
            <Link
              href={`/admin/clienti/${client.id}/modifica`}
              className="inline-flex min-h-11 items-center rounded-full bg-cipria/30 px-4 text-sm font-medium hover:bg-cipria/50"
            >
              Modifica dati
            </Link>
          </div>
          {settings.showAllergyNotes && client.allergyNotes ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <strong className="font-medium">Allergie:</strong> {client.allergyNotes}
            </p>
          ) : null}
          {client.adminNotes ? (
            <p className="whitespace-pre-line rounded-xl bg-avorio p-3 text-sm">
              <strong className="font-medium">Note:</strong> {client.adminNotes}
            </p>
          ) : null}
        </section>
      ) : null}

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Totale speso" value={formatEuro(totals.totalCents)} hint={totals.packagesCents > 0 ? `di cui pacchetti ${formatEuro(totals.packagesCents)}` : undefined} />
        <Stat label="Fatti" value={String(totals.doneCount)} />
        <Stat label="Non presentata" value={String(totals.noShows)} strong={totals.noShows > 0} />
      </dl>

      <section aria-labelledby="pacchetti" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="pacchetti" className="text-xl">
            Pacchetti
          </h2>
          {!anonymized ? (
            <Link
              href={`/admin/pacchetti/nuovo?cliente=${client.id}`}
              className="inline-flex min-h-10 items-center rounded-full bg-cipria/30 px-4 text-sm font-medium hover:bg-cipria/50"
            >
              + Vendi pacchetto
            </Link>
          ) : null}
        </div>
        {active.length > 0 ? (
          <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
            {active.map((p) => (
              <PackageRow key={p.id} p={p} showClient={false} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-prugna/60">Nessun pacchetto attivo.</p>
        )}
        {archived.length > 0 ? (
          <details className="rounded-2xl bg-white/60 ring-1 ring-prugna/5">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {archived.length === 1 ? "1 pacchetto archiviato" : `${archived.length} pacchetti archiviati`}
            </summary>
            <ul className="divide-y divide-prugna/5">
              {archived.map((p) => (
                <PackageRow key={p.id} p={p} showClient={false} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="storico" className="flex flex-col gap-3">
        <h2 id="storico" className="text-xl">
          Appuntamenti
        </h2>
        {appointments.length === 0 ? <p className="text-sm text-prugna/60">Nessun appuntamento.</p> : null}
        {upcoming.length > 0 ? <AppointmentList title="In programma" rows={upcoming} /> : null}
        {past.length > 0 ? <AppointmentList title="Storico" rows={past} /> : null}
        {appointmentCount > HISTORY_LIMIT ? (
          <p className="text-xs text-prugna/60">Qui gli ultimi {HISTORY_LIMIT} di {appointmentCount}.</p>
        ) : null}
      </section>

      {!anonymized ? (
        <section aria-label="Azioni" className="flex flex-col gap-3 border-t border-oro/20 pt-6">
          <ClientActions
            clientId={client.id}
            lastName={client.lastName}
            blocked={!!client.blockedAt}
            hasHistory={appointmentCount > 0 || packages.length > 0}
            futureCount={upcoming.length}
          />
        </section>
      ) : null}
    </div>
  );
}

type Row = {
  id: string;
  startsAt: Date;
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW";
  doneAt: Date | null;
  totalPriceCents: number;
  amountCollectedCents: number | null;
  items: { name: string; clientPackageId: string | null }[];
};

function AppointmentList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-prugna/70">{title}</h3>
      <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
        {rows.map((a) => {
          const state = agendaState(a);
          return (
            <li key={a.id} className={`flex flex-col gap-0.5 px-4 py-2.5 text-sm ${state === "cancelled" ? "text-prugna/50" : ""}`}>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <Link href={`/admin/agenda?mese=${dayKeyOf(a.startsAt).slice(0, 7)}`} className="font-medium underline-offset-2 hover:underline">
                  {formatDayShort(dayKeyOf(a.startsAt))} · {formatTime(a.startsAt)}
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    state === "done" ? "bg-salvia/40" : state === "noShow" ? "bg-prugna/10" : state === "cancelled" ? "" : "bg-cipria/30"
                  }`}
                >
                  {STATE_LABEL[state]}
                  {state === "done" && a.amountCollectedCents !== null ? ` · ${formatEuro(a.amountCollectedCents)}` : ""}
                </span>
              </span>
              <span className="text-prugna/70">
                {a.items.map((i) => (i.clientPackageId ? `${i.name} (pacchetto)` : i.name)).join(" · ")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, hint, strong = false }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-2xl p-3 ring-1 ${strong ? "bg-oro/15 ring-oro/40" : "bg-white ring-prugna/5"}`}>
      <dt className="text-xs text-prugna/60">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-[11px] text-prugna/60">{hint}</dd> : null}
    </div>
  );
}
