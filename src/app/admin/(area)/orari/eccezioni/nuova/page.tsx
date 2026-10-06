import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { loadWeekly } from "@/lib/schedule/queries";
import { dayKeyToDbDate, isValidDayKey, minutesToTime, todayKey, weekdayOf } from "@/lib/time/rome";
import { ExceptionForm } from "../../_components/ExceptionForm";
import { BackLink } from "../../_components/FormBits";
import { saveException } from "../../actions";

export const metadata: Metadata = { title: "Nuova eccezione" };

export default async function NuovaEccezionePage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  await requireAdmin();
  const { data } = await searchParams;
  const today = todayKey();
  const date = data && isValidDayKey(data) && data >= today ? data : today;

  // Se per quella data esiste già un'eccezione, si apre quella.
  const existing = await prisma.dateOverride.findUnique({ where: { date: dayKeyToDbDate(date) }, select: { id: true } });
  if (data && existing) redirect(`/admin/orari/eccezioni/${existing.id}`);

  // Proposta iniziale: l'orario della settimana tipo di quel giorno.
  const weekly = (await loadWeekly()).filter((w) => w.weekday === weekdayOf(date));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackLink href="/admin/orari?sezione=eccezioni" label="Eccezioni" />
        <h1 className="text-3xl">Nuova eccezione</h1>
        <p className="text-prugna/70">Un orario diverso, o la chiusura, solo per una data.</p>
      </header>
      <ExceptionForm
        action={saveException.bind(null, null)}
        minDate={today}
        initial={{
          date,
          closed: false,
          note: "",
          slots: weekly.map((s) => ({ start: minutesToTime(s.startMinute), end: minutesToTime(s.endMinute) })),
        }}
        submitLabel="Salva eccezione"
      />
    </div>
  );
}
