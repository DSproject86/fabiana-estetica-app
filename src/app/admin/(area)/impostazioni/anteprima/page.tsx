import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { bookingDuration } from "@/lib/availability/duration";
import { clientLimits, getDailySlots, loadSettings } from "@/lib/availability/queries";
import { formatNotice } from "@/lib/settings/schema";
import { addDays, formatDayShort, formatTime, todayKey } from "@/lib/time/rome";
import { ServicePicker } from "./ServicePicker";

export const metadata: Metadata = { title: "Anteprima disponibilità" };

const DAYS = 7;

export default async function AnteprimaPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const requested = (s ?? "").split(",").filter(Boolean);

  // Stessi servizi che vedrà la cliente: attivi, in categorie attive.
  const [settings, categories] = await Promise.all([
    loadSettings(),
    prisma.serviceCategory.findMany({
      where: { active: true, services: { some: { active: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { services: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    }),
  ]);
  const bookable = new Map(categories.flatMap((c) => c.services).map((sv) => [sv.id, sv]));
  const selected = [...new Set(requested)].filter((id) => bookable.has(id));
  const services = selected.map((id) => bookable.get(id)!);

  const duration = bookingDuration(services.map((sv) => sv.durationMin), settings.durationRoundingMin, settings.bufferMin);
  const total = services.reduce((sum, sv) => sum + sv.priceCents, 0);
  const today = todayKey();
  const daily = services.length
    ? await getDailySlots(today, DAYS, {
        durationMin: duration.durationMin,
        bufferMin: duration.bufferMin,
        gridMin: settings.slotGridMin,
        limits: clientLimits(settings),
      })
    : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin/impostazioni" className="inline-flex w-fit items-center gap-1 text-sm text-prugna/60 hover:text-prugna">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Impostazioni
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">Anteprima disponibilità</h1>
          <span className="rounded-full bg-oro/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">Vista cliente</span>
        </div>
        <p className="text-prugna/70">
          Scegli dei servizi e vedi gli orari che una cliente troverebbe liberi nei prossimi {DAYS} giorni.
        </p>
        <p className="rounded-xl bg-white/70 px-4 py-3 text-sm text-prugna/70">
          Qui valgono le regole delle clienti: preavviso minimo di {formatNotice(settings.minNoticeMin).toLowerCase()} e
          prenotazioni fino a {settings.bookingHorizonMonths} {settings.bookingHorizonMonths === 1 ? "mese" : "mesi"}.
          Quando inserisci tu un appuntamento come admin, preavviso e limite dei mesi non valgono.
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
          Nessun servizio visibile alle clienti. Aggiungili dal <Link href="/admin/listino" className="underline">Listino</Link>.
        </p>
      ) : (
        <ServicePicker
          initial={selected}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            services: c.services.map((sv) => ({
              id: sv.id,
              name: sv.name,
              detail: `${formatDuration(sv.durationMin)} · ${formatEuro(sv.priceCents)}`,
            })),
          }))}
        />
      )}

      {services.length > 0 ? (
        <section aria-labelledby="orari" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-prugna/5">
            <h2 id="orari" className="text-xl">Riepilogo</h2>
            <p className="text-sm">
              Durata {formatDuration(duration.rawMin)}
              {duration.durationMin !== duration.rawMin ? ` → ${formatDuration(duration.durationMin)} in calendario` : ""}
              {duration.bufferMin ? ` + pausa ${duration.bufferMin} min` : ""} · Totale {formatEuro(total)}
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {daily.map(({ day, slots }) => {
              const label = day.day === today ? "Oggi" : day.day === addDays(today, 1) ? "Domani" : formatDayShort(day.day);
              return (
                <li key={day.day} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-prugna/5">
                  <span className="inline-block font-medium first-letter:uppercase">{label}</span>
                  {slots.length ? (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((t) => (
                        <span key={t.toISOString()} className="rounded-full bg-cipria/25 px-3 py-1.5 text-sm tabular-nums">
                          {formatTime(t)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-prugna/50">{day.slots.length === 0 ? "Chiuso" : "Nessun orario libero"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
