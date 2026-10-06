import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/money";
import { dayBounds, dayKeyOf, formatDayLong, formatTime, todayKey, type DayKey } from "@/lib/time/rome";

export const metadata: Metadata = { title: "Agenda" };

const LIMIT = 100;

/** Agenda provvisoria in sola lettura: i prossimi appuntamenti. Quella completa arriva con lo step 7. */
export default async function AgendaPage() {
  const appointments = await prisma.appointment.findMany({
    where: { status: "CONFIRMED", startsAt: { gte: dayBounds(todayKey()).start } },
    orderBy: { startsAt: "asc" },
    take: LIMIT,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      bufferMin: true,
      totalPriceCents: true,
      createdBy: true,
      client: { select: { firstName: true, lastName: true } },
      items: { orderBy: { sortOrder: "asc" }, select: { name: true } },
    },
  });

  const byDay = new Map<DayKey, typeof appointments>();
  for (const a of appointments) {
    const day = dayKeyOf(a.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">Agenda</h1>
        <p className="text-prugna/70">Prossimi appuntamenti (sola lettura). L&apos;agenda completa arriva con lo step 7.</p>
      </header>

      {appointments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
          Nessun appuntamento in programma.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay].map(([day, rows]) => (
            <section key={day} aria-label={formatDayLong(day)} className="flex flex-col gap-2">
              <h2 className="text-lg first-letter:uppercase">{formatDayLong(day)}</h2>
              <ul className="flex flex-col divide-y divide-prugna/10 rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
                {rows.map((a) => (
                  <li key={a.id} className="flex gap-4 px-4 py-3">
                    <span className="w-24 shrink-0 font-medium tabular-nums">
                      {formatTime(a.startsAt)}–{formatTime(new Date(a.endsAt.getTime() - a.bufferMin * 60_000))}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">
                        {a.client.firstName} {a.client.lastName}
                      </span>
                      <span className="text-sm text-prugna/70">{a.items.map((i) => i.name).join(" · ")}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end text-sm">
                      <span className="tabular-nums">{formatEuro(a.totalPriceCents)}</span>
                      {a.createdBy === "CLIENT" ? <span className="text-xs text-prugna/50">online</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {appointments.length === LIMIT ? (
            <p className="text-sm text-prugna/60">Sono mostrati i primi {LIMIT} appuntamenti.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
