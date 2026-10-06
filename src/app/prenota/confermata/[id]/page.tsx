import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentSummary } from "@/components/client/AppointmentSummary";
import { ClientShell, cardClass, linkButtonClass } from "@/components/client/ClientShell";
import { requireClient } from "@/lib/auth/client";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Prenotazione confermata", robots: { index: false } };

export default async function ConfermataPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await requireClient();
  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, clientId: client.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!appointment) notFound();

  return (
    <ClientShell loggedIn>
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-salvia/35" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 className="text-3xl">Prenotazione confermata!</h1>
        <p className="text-prugna/70">Ti aspettiamo, {client.firstName}.</p>
      </div>
      <div className={cardClass}>
        <AppointmentSummary
          startsAt={appointment.startsAt}
          items={appointment.items}
          totalCents={appointment.totalPriceCents}
          durationMin={appointment.durationMin}
        />
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/appuntamenti" className={linkButtonClass.primary}>
          I miei appuntamenti
        </Link>
        <Link href="/" className={linkButtonClass.secondary}>
          Torna alla home
        </Link>
      </div>
    </ClientShell>
  );
}
