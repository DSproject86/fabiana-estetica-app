import type { Metadata } from "next";
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

      <div className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
        Link d&apos;invito per le clienti e testi dei messaggi arrivano con gli step 5 e 6.
      </div>
    </div>
  );
}
