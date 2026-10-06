"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useTransition, type ReactNode } from "react";
import { roundUpTo } from "@/lib/availability/duration";
import type { CalendarCell } from "@/lib/booking/calendar";
import { pickerQuery, type PickerChoice } from "@/lib/agenda/pickerQuery";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";

type Service = { id: string; name: string; durationMin: number; priceCents: number; hidden: boolean };
type Category = { id: string; name: string; services: Service[] };
type Orphan = { id: string; name: string; durationMin: number; priceCents: number };

export type PlannerCalendar = {
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  cells: CalendarCell[];
  day: string | null;
  dayLabel: string | null;
  slots: string[];
  dayFull: boolean;
};

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

/**
 * Scelte di Nuovo / Sposta / Servizi: servizi, "Senza pausa", "Fuori orario", giorno e ora.
 * Ogni scelta aggiorna l'indirizzo; giorni e orari liberi li ricalcola il server (motore delle disponibilità).
 */
export function Planner(props: {
  basePath: string;
  choice: PickerChoice;
  categories?: Category[];
  orphans?: Orphan[];
  /** Servizi già nell'appuntamento (Servizi): prezzo e durata originali. */
  keptPrices?: Record<string, { durationMin: number; priceCents: number }>;
  roundingMin: number;
  bufferMin: number; // pausa che si applicherebbe senza "Senza pausa"
  noBufferDefault: boolean;
  calendar?: PlannerCalendar;
  showOutsideToggle?: boolean;
  notices?: string[];
  children?: ReactNode; // modulo di conferma (dal server)
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useOptimistic(props.choice);
  const noBuffer = choice.noBuffer ?? props.noBufferDefault;

  const go = (next: PickerChoice) =>
    startTransition(() => {
      setChoice(next);
      router.replace(`${props.basePath}${pickerQuery(next, !!props.categories)}`, { scroll: false });
    });

  const toggleService = (id: string, on: boolean) =>
    go({ ...choice, services: on ? [...choice.services, id] : choice.services.filter((s) => s !== id), time: choice.outside ? choice.time : null });
  const toggleOrphan = (id: string, on: boolean) =>
    go({ ...choice, keep: on ? [...choice.keep, id] : choice.keep.filter((s) => s !== id) });

  // Riepilogo immediato.
  const byId = new Map((props.categories ?? []).flatMap((c) => c.services).map((s) => [s.id, s]));
  const chosen = choice.services
    .map((id) => {
      const s = byId.get(id);
      if (!s) return null;
      const kept = props.keptPrices?.[id];
      return kept ? { ...s, ...kept } : s;
    })
    .filter((s): s is Service => !!s);
  const orphansKept = (props.orphans ?? []).filter((o) => choice.keep.includes(o.id));
  const parts = [...orphansKept, ...chosen];
  const rawMin = parts.reduce((sum, s) => sum + s.durationMin, 0);
  const totalCents = parts.reduce((sum, s) => sum + s.priceCents, 0);
  const durationMin = roundUpTo(rawMin, props.roundingMin);

  const cal = props.calendar;
  const loading = pending;

  const confirmRef = useRef<HTMLDivElement>(null);
  const lastTime = useRef(props.choice.time);
  useEffect(() => {
    if (props.choice.time && props.choice.time !== lastTime.current) {
      confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    lastTime.current = props.choice.time;
  }, [props.choice.time]);

  return (
    <div className="flex flex-col gap-6">
      {props.categories ? (
        <section aria-labelledby="servizi" className="flex flex-col gap-3">
          <h2 id="servizi" className="text-xl">Servizi</h2>
          {props.orphans && props.orphans.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-prugna/70">Non più in listino</legend>
              {props.orphans.map((o) => (
                <ServiceRow
                  key={o.id}
                  name={o.name}
                  detail={`${formatDuration(o.durationMin)} · ${formatEuro(o.priceCents)}`}
                  checked={choice.keep.includes(o.id)}
                  onChange={(on) => toggleOrphan(o.id, on)}
                />
              ))}
            </fieldset>
          ) : null}
          {props.categories.map((c) => (
            <fieldset key={c.id} className="flex flex-col gap-2">
              <legend className="mb-1 font-serif text-lg">{c.name}</legend>
              {c.services.map((s) => {
                const kept = props.keptPrices?.[s.id];
                const price = kept?.priceCents ?? s.priceCents;
                const duration = kept?.durationMin ?? s.durationMin;
                return (
                  <ServiceRow
                    key={s.id}
                    name={s.name}
                    tag={s.hidden ? "nascosto" : kept ? "già nell'appuntamento" : undefined}
                    detail={`${formatDuration(duration)} · ${formatEuro(price)}`}
                    checked={choice.services.includes(s.id)}
                    onChange={(on) => toggleService(s.id, on)}
                  />
                );
              })}
            </fieldset>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="opzioni" className="flex flex-col gap-2">
        <h2 id="opzioni" className="sr-only">Opzioni</h2>
        <p className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-prugna/5">
          {parts.length > 0 || !props.categories ? (
            <>
              {props.categories ? (
                <>
                  {formatDuration(durationMin)} · <strong className="tabular-nums">{formatEuro(totalCents)}</strong> ·{" "}
                </>
              ) : null}
              {noBuffer ? "senza pausa" : `pausa ${props.bufferMin} min`}
            </>
          ) : (
            "Scegli almeno un servizio."
          )}
        </p>
        <OptionToggle
          label="Senza pausa"
          description="Nessuna pausa dopo questo appuntamento."
          checked={noBuffer}
          disabled={pending}
          onChange={(on) => go({ ...choice, noBuffer: on, time: choice.outside ? choice.time : null })}
        />
        {props.showOutsideToggle !== false ? (
          <OptionToggle
            label="Fuori orario di lavoro"
            description="Ignora orari e blocchi: scrivi tu l'ora. Le sovrapposizioni con altri appuntamenti restano vietate."
            checked={choice.outside}
            disabled={pending}
            onChange={(on) => go({ ...choice, outside: on, time: null })}
          />
        ) : null}
      </section>

      {cal ? (
        <section aria-labelledby="giorno" className="flex flex-col gap-3" aria-busy={loading}>
          <h2 id="giorno" className="text-xl">Giorno e ora</h2>
          <div className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prugna/5 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="mb-3 flex items-center justify-between">
              <ArrowButton dir="prev" disabled={pending} onClick={() => go({ ...choice, month: cal.prevMonth, day: null, time: null })} />
              <span className="font-serif text-lg first-letter:uppercase">{cal.monthLabel}</span>
              <ArrowButton dir="next" disabled={pending} onClick={() => go({ ...choice, month: cal.nextMonth, day: null, time: null })} />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="pb-1 text-xs font-medium text-prugna/50" aria-hidden>
                  {w}
                </span>
              ))}
              {cal.cells.map((cell, i) =>
                cell ? (
                  <button
                    key={cell.day}
                    type="button"
                    disabled={!cell.available || pending}
                    onClick={() => go({ ...choice, month: cal.month, day: cell.day, time: null })}
                    aria-pressed={choice.day === cell.day}
                    aria-label={`${cell.n}${cell.available ? "" : ", nessun orario libero"}`}
                    className={`mx-auto flex size-10 items-center justify-center rounded-full text-[15px] tabular-nums ${
                      choice.day === cell.day
                        ? "bg-prugna font-semibold text-avorio"
                        : cell.available
                          ? "bg-cipria/25 font-medium hover:bg-cipria/50"
                          : "text-prugna/25"
                    } ${cell.today && choice.day !== cell.day ? "ring-1 ring-oro" : ""}`}
                  >
                    {cell.n}
                  </button>
                ) : (
                  <span key={`vuoto-${i}`} />
                ),
              )}
            </div>
          </div>

          {props.notices?.map((n) => (
            <p key={n} role="status" className="rounded-xl bg-cipria/30 px-4 py-3 text-sm">
              {n}
            </p>
          ))}

          {choice.day && !loading ? (
            <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prugna/5">
              <p className="font-medium first-letter:uppercase">{cal.dayLabel}</p>
              {choice.outside ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Ora d&apos;inizio (a passi di 5 minuti)</span>
                  <input
                    type="time"
                    step={300}
                    defaultValue={choice.time ?? ""}
                    key={`${choice.day}-${props.choice.time ?? ""}`}
                    onChange={(e) => {
                      if (/^\d{2}:\d{2}$/.test(e.target.value)) go({ ...choice, time: e.target.value });
                    }}
                    className="min-h-12 w-40 rounded-xl border border-prugna/15 bg-white px-4 text-base tabular-nums"
                  />
                </label>
              ) : cal.slots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {cal.slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={pending}
                      onClick={() => go({ ...choice, time: t })}
                      aria-pressed={choice.time === t}
                      className={`min-h-11 min-w-[4.75rem] rounded-full px-4 text-[15px] tabular-nums ${
                        choice.time === t ? "bg-prugna font-semibold text-avorio" : "bg-cipria/25 hover:bg-cipria/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-prugna/60">
                  Nessun orario libero con questa durata. Scegli un altro giorno o attiva “Fuori orario”.
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : (
        props.notices?.map((n) => (
          <p key={n} role="status" className="rounded-xl bg-cipria/30 px-4 py-3 text-sm">
            {n}
          </p>
        ))
      )}

      <div ref={confirmRef} className={`scroll-mt-4 ${pending ? "pointer-events-none opacity-50" : ""}`} aria-busy={pending}>
        {props.children}
      </div>
    </div>
  );
}

function ServiceRow(props: { name: string; detail: string; tag?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 ${
        props.checked ? "border-prugna/40 bg-cipria/20" : "border-prugna/10 bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--color-prugna)]"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">
          {props.name}
          {props.tag ? <span className="ml-2 text-xs font-normal text-prugna/50">{props.tag}</span> : null}
        </span>
        <span className="text-sm text-prugna/60">{props.detail}</span>
      </span>
    </label>
  );
}

function OptionToggle(props: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-prugna/15 bg-white p-3">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{props.label}</span>
        <span className="text-xs text-prugna/60">{props.description}</span>
      </span>
    </label>
  );
}

function ArrowButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Mese precedente" : "Mese successivo"}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full hover:bg-cipria/20 disabled:opacity-25"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
