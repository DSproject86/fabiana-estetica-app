import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadWeekly } from "@/lib/schedule/queries";
import { WEEKDAY_NAMES, minutesToTime } from "@/lib/time/rome";
import { BackLink } from "../../_components/FormBits";
import { WeekdayForm } from "../../_components/WeekdayForm";
import { saveWeekday } from "../../actions";

export const metadata: Metadata = { title: "Settimana tipo" };

export default async function GiornoSettimanaPage({ params }: { params: Promise<{ giorno: string }> }) {
  const { giorno } = await params;
  const weekday = Number(giorno);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) notFound();

  const slots = (await loadWeekly()).filter((w) => w.weekday === weekday);
  const name = WEEKDAY_NAMES[weekday - 1];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackLink href="/admin/orari?sezione=settimana" label="Settimana tipo" />
        <h1 className="text-3xl capitalize">{name}</h1>
        <p className="text-prugna/70">Una o più fasce, per esempio 9:00–13:00 e 15:00–19:30. Senza fasce il giorno è chiuso.</p>
      </header>
      <WeekdayForm
        key={weekday}
        weekday={weekday}
        initialSlots={slots.map((s) => ({ start: minutesToTime(s.startMinute), end: minutesToTime(s.endMinute) }))}
        action={saveWeekday.bind(null, weekday)}
      />
    </div>
  );
}
