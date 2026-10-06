import type { Metadata } from "next";
import Link from "next/link";
import { ClientShell, PageTitle, cardClass, linkButtonClass } from "@/components/client/ClientShell";
import { WhatsAppIcon } from "@/components/client/WhatsAppIcon";
import { requireClient } from "@/lib/auth/client";
import { loadSettings } from "@/lib/availability/queries";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/money";
import { dayKeyOf, formatDayLong, formatTime } from "@/lib/time/rome";
import { whatsappChatLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "I miei appuntamenti", robots: { index: false } };

const PAST_LIMIT = 30;

type Row = {
  id: string;
  startsAt: Date;
  totalPriceCents: number;
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW";
  items: { name: string }[];
};

export default async function AppuntamentiPage() {
  const client = await requireClient();
  const now = new Date();
  const include = { items: { orderBy: { sortOrder: "asc" as const }, select: { name: true } } };

  const [upcoming, past, settings] = await Promise.all([
    prisma.appointment.findMany({
      where: { clientId: client.id, status: "CONFIRMED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      include,
    }),
    prisma.appointment.findMany({
      where: { clientId: client.id, OR: [{ startsAt: { lt: now } }, { status: { not: "CONFIRMED" } }] },
      orderBy: { startsAt: "desc" },
      take: PAST_LIMIT,
      include,
    }),
    loadSettings(),
  ]);

  const whatsapp = settings.businessWhatsapp
    ? whatsappChatLink(
        settings.businessWhatsapp,
        `Ciao Fabiana, sono ${client.firstName} ${client.lastName}. Vorrei spostare o disdire un appuntamento.`,
      )
    : null;

  return (
    <ClientShell loggedIn>
      <PageTitle title="I miei appuntamenti" back={{ href: "/", label: "Home" }} />

      <section aria-labelledby="prossimi" className="flex flex-col gap-3">
        <h2 id="prossimi" className="text-xl">
          Prossimi
        </h2>
        {upcoming.length ? (
          <ul className="flex flex-col gap-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </ul>
        ) : (
          <div className={`${cardClass} flex flex-col items-start gap-3`}>
            <p className="text-prugna/70">Non hai appuntamenti in programma.</p>
            <Link href="/prenota" className={linkButtonClass.primary}>
              Prenota
            </Link>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 rounded-3xl bg-cipria/15 p-5">
        <p>Per spostare o disdire un appuntamento scrivi a Fabiana.</p>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkButtonClass.whatsapp}>
            <WhatsAppIcon />
            Scrivi a Fabiana su WhatsApp
          </a>
        ) : null}
      </div>

      {past.length ? (
        <section aria-labelledby="passati" className="flex flex-col gap-3">
          <h2 id="passati" className="text-xl">
            Passati
          </h2>
          <ul className="flex flex-col gap-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} muted />
            ))}
          </ul>
        </section>
      ) : null}
    </ClientShell>
  );
}

const STATUS_LABEL: Partial<Record<Row["status"], string>> = { CANCELLED: "Annullato", NO_SHOW: "Non effettuato" };

function AppointmentCard({ appointment: a, muted = false }: { appointment: Row; muted?: boolean }) {
  const label = STATUS_LABEL[a.status];
  return (
    <li className={`${cardClass} flex flex-col gap-2 ${muted ? "bg-white/60 shadow-none" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className={`font-medium first-letter:uppercase ${label ? "line-through decoration-prugna/40" : ""}`}>
            {formatDayLong(dayKeyOf(a.startsAt))}
          </span>
          <span className="text-prugna/70 tabular-nums">ore {formatTime(a.startsAt)}</span>
        </div>
        {label ? (
          <span className="shrink-0 rounded-full bg-prugna/10 px-3 py-1 text-xs font-medium">{label}</span>
        ) : (
          <span className="shrink-0 font-semibold tabular-nums">{formatEuro(a.totalPriceCents)}</span>
        )}
      </div>
      <p className="text-sm text-prugna/70">{a.items.map((i) => i.name).join(" · ")}</p>
    </li>
  );
}
