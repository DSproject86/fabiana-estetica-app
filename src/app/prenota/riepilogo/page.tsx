import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppointmentSummary } from "@/components/client/AppointmentSummary";
import { ClientShell, PageTitle, cardClass } from "@/components/client/ClientShell";
import { requireClient } from "@/lib/auth/client";
import { bookingQuery, parseBookingParams } from "@/lib/booking/params";
import { checkBooking } from "@/lib/booking/server";
import { confirmBookingAction } from "../actions";
import { ConfirmButton } from "./ConfirmButton";

export const metadata: Metadata = { title: "Riepilogo", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RiepilogoPage({ searchParams }: { searchParams: SearchParams }) {
  await requireClient();
  const { services, day, time } = parseBookingParams(await searchParams);
  if (!day || !time || services.length === 0) redirect(`/prenota${bookingQuery({ services, day })}`);

  const checked = await checkBooking(services, day, time);
  if (!checked.ok) redirect(`/prenota${bookingQuery({ services, day, error: checked.error })}`);
  const { booking } = checked;
  const back = `/prenota${bookingQuery({ services, day, time })}`;

  return (
    <ClientShell loggedIn>
      <PageTitle title="Riepilogo" subtitle="Controlla e conferma." back={{ href: back, label: "Modifica" }} />
      <div className={cardClass}>
        <AppointmentSummary
          startsAt={booking.startsAt}
          items={booking.services}
          totalCents={booking.totalCents}
          durationMin={booking.duration.durationMin}
        />
      </div>
      <form action={confirmBookingAction} className="flex flex-col gap-3">
        <input type="hidden" name="s" value={services.join(",")} />
        <input type="hidden" name="giorno" value={day} />
        <input type="hidden" name="ora" value={time} />
        <ConfirmButton />
        <Link href={back} className="mx-auto min-h-11 px-4 py-3 text-sm text-prugna/70 hover:text-prugna">
          Torna indietro
        </Link>
      </form>
    </ClientShell>
  );
}
