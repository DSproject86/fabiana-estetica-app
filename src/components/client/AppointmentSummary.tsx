import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { dayKeyOf, formatDayLong, formatTime } from "@/lib/time/rome";

/** Data, ora, servizi e totale di un appuntamento (riepilogo, conferma, elenco). */
export function AppointmentSummary({
  startsAt,
  items,
  totalCents,
  durationMin,
}: {
  startsAt: Date;
  items: { name: string; priceCents: number; durationMin?: number }[];
  totalCents: number;
  durationMin?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <span className="font-serif text-xl first-letter:uppercase">{formatDayLong(dayKeyOf(startsAt))}</span>
        <span className="text-lg">
          ore <strong className="font-semibold tabular-nums">{formatTime(startsAt)}</strong>
          {durationMin ? <span className="text-prugna/60"> · durata {formatDuration(durationMin)}</span> : null}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-prugna/10 border-y border-prugna/10">
        {items.map((item, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2.5">
            <span>{item.name}</span>
            <span className="shrink-0 tabular-nums">{formatEuro(item.priceCents)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">Totale</span>
        <span className="text-xl font-semibold tabular-nums">{formatEuro(totalCents)}</span>
      </div>
    </div>
  );
}
