import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage() {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">Impostazioni</h1>
        <p className="text-prugna/70">Regole delle prenotazioni online.</p>
      </header>

      <section aria-labelledby="prenotazioni" className="flex flex-col gap-4">
        <h2 id="prenotazioni" className="text-xl">Prenotazioni</h2>
        <SettingsForm
          initial={{
            slotGridMin: settings.slotGridMin,
            durationRoundingMin: settings.durationRoundingMin,
            bufferMin: settings.bufferMin,
            minNoticeMin: settings.minNoticeMin,
            bookingHorizonMonths: settings.bookingHorizonMonths,
            reminderHour: settings.reminderHour,
          }}
        />
      </section>

      <Link
        href="/admin/impostazioni/anteprima"
        className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-prugna/5 hover:bg-cipria/10"
      >
        <span className="flex flex-col">
          <span className="font-medium">Anteprima disponibilità</span>
          <span className="text-sm text-prugna/60">Scegli dei servizi e vedi gli orari liberi come li vedrà una cliente.</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      <div className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
        Link d&apos;invito per le clienti e testi dei messaggi arrivano con gli step 5 e 6.
      </div>
    </div>
  );
}
