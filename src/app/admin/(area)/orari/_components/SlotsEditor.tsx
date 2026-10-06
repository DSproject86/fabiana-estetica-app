"use client";

export type SlotDraft = { key: number; start: string; end: string };

let nextKey = 1;
export function newSlotDraft(start = "", end = ""): SlotDraft {
  return { key: nextKey++, start, end };
}

const timeClass =
  "min-h-12 w-full min-w-0 rounded-xl border border-prugna/15 bg-white px-3 text-base outline-none focus:border-oro focus:ring-2 focus:ring-oro/30";

/** Elenco di fasce "dalle–alle" con aggiungi/rimuovi. I campi si chiamano start/end. */
export function SlotsEditor({
  slots,
  onChange,
  emptyLabel = "Nessuna fascia: chiuso.",
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
  emptyLabel?: string;
}) {
  const update = (key: number, patch: Partial<SlotDraft>) =>
    onChange(slots.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-3">
      {slots.length === 0 ? <p className="rounded-xl bg-white/70 px-4 py-3 text-sm text-prugna/60">{emptyLabel}</p> : null}
      {slots.map((slot, i) => (
        <div key={slot.key} className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-prugna/70">
            Dalle
            <input
              type="time"
              step={300}
              name="start"
              value={slot.start}
              onChange={(e) => update(slot.key, { start: e.target.value })}
              className={timeClass}
              aria-label={`Fascia ${i + 1}: inizio`}
            />
          </label>
          <span className="pb-3 text-prugna/40">–</span>
          <label className="flex flex-1 flex-col gap-1 text-xs text-prugna/70">
            Alle
            <input
              type="time"
              step={300}
              name="end"
              value={slot.end}
              onChange={(e) => update(slot.key, { end: e.target.value })}
              className={timeClass}
              aria-label={`Fascia ${i + 1}: fine`}
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(slots.filter((s) => s.key !== slot.key))}
            className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-prugna/60 hover:bg-cipria/20"
            aria-label={`Rimuovi fascia ${i + 1}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      ))}
      {slots.length < 6 ? (
        <button
          type="button"
          onClick={() => {
            const last = slots[slots.length - 1];
            onChange([...slots, last ? newSlotDraft() : newSlotDraft("09:00", "13:00")]);
          }}
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-cipria/25 px-4 text-sm font-medium hover:bg-cipria/40"
        >
          + Aggiungi fascia
        </button>
      ) : null}
    </div>
  );
}
