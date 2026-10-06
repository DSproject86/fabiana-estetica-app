import type { AgendaDay } from "@/lib/agenda/queries";
import { formatSlot } from "@/lib/schedule/slots";
import { dayBounds, formatDayLong, formatTime } from "@/lib/time/rome";
import { AppointmentCard, type CardData } from "./AppointmentCard";

/** Un giorno dell'agenda: orario effettivo, blocchi, appuntamenti (gli annullati restano chiusi). */
export function DaySection({
  agendaDay,
  isToday,
  cards,
  cancelled,
}: {
  agendaDay: AgendaDay;
  isToday: boolean;
  cards: CardData[];
  cancelled: { id: string; label: string }[];
}) {
  const { day } = agendaDay;
  const { start, end } = dayBounds(day.day);
  const closed = day.slots.length === 0;
  const empty = cards.length === 0 && cancelled.length === 0;

  const blockLabel = (b: { startsAt: Date; endsAt: Date }) => {
    if (b.startsAt <= start && b.endsAt >= end) return "tutto il giorno";
    const from = b.startsAt <= start ? "00:00" : formatTime(b.startsAt);
    const to = b.endsAt >= end ? "24:00" : formatTime(b.endsAt);
    return `${from}–${to}`;
  };

  // Giorni senza appuntamenti né blocchi: una riga sola, per scorrere il mese in fretta.
  if (empty && day.blocks.length === 0) {
    return (
      <section
        id={`giorno-${day.day}`}
        aria-label={formatDayLong(day.day)}
        className="flex scroll-mt-20 flex-wrap items-baseline gap-x-2 border-b border-prugna/5 pb-2 text-sm text-prugna/50"
      >
        <h2 className="font-sans text-sm font-medium text-prugna/70 first-letter:uppercase">{formatDayLong(day.day)}</h2>
        {isToday ? <span className="rounded-full bg-oro/25 px-2 py-0.5 text-xs font-semibold text-prugna">Oggi</span> : null}
        <span>
          {closed ? "Chiuso" : `${day.slots.map(formatSlot).join(" · ")} · libero`}
          {day.source === "exception" ? ` · orario speciale${day.exception?.note ? ` (${day.exception.note})` : ""}` : ""}
        </span>
      </section>
    );
  }

  return (
    <section id={`giorno-${day.day}`} aria-label={formatDayLong(day.day)} className="flex scroll-mt-20 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className={`text-lg first-letter:uppercase ${closed && empty ? "text-prugna/50" : ""}`}>
          {formatDayLong(day.day)}
          {isToday ? <span className="ml-2 rounded-full bg-oro/25 px-2 py-0.5 align-middle font-sans text-xs font-semibold">Oggi</span> : null}
        </h2>
        <p className="text-sm text-prugna/60">
          {closed ? "Chiuso" : day.slots.map(formatSlot).join(" · ")}
          {day.source === "exception" ? (
            <span className="ml-1 text-prugna/80">· orario speciale{day.exception?.note ? ` (${day.exception.note})` : ""}</span>
          ) : null}
        </p>
        {day.blocks.map((b) => (
          <p key={b.id} className="text-sm text-prugna/70">
            <span className="mr-1 rounded bg-prugna/10 px-1.5 py-0.5 text-xs font-medium">Blocco</span>
            {blockLabel(b)}
            {b.reason ? ` · ${b.reason}` : ""}
          </p>
        ))}
      </div>

      {cards.length > 0 ? (
        <ul className="flex flex-col divide-y divide-prugna/10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
          {cards.map((c) => (
            <AppointmentCard key={c.id} a={c} />
          ))}
        </ul>
      ) : !closed ? (
        <p className="text-sm text-prugna/40">Nessun appuntamento</p>
      ) : null}

      {cancelled.length > 0 ? (
        <details className="text-sm text-prugna/60">
          <summary className="cursor-pointer py-1">
            {cancelled.length === 1 ? "1 annullato" : `${cancelled.length} annullati`} · mostra
          </summary>
          <ul className="mt-1 flex flex-col gap-1 pl-4">
            {cancelled.map((c) => (
              <li key={c.id} className="line-through">
                {c.label}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
