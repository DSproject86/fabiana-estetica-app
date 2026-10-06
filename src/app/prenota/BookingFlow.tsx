"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { roundUpTo } from "@/lib/availability/duration";
import type { CalendarCell } from "@/lib/booking/calendar";
import { bookingQuery } from "@/lib/booking/query";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";

type Service = { id: string; name: string; description: string | null; durationMin: number; priceCents: number };
type Category = { id: string; name: string; services: Service[] };

type Choice = { selected: string[]; month: string; day: string | null; time: string | null };

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

export function BookingFlow(props: {
  categories: Category[];
  roundingMin: number;
  selected: string[];
  month: string;
  monthLabel: string;
  prevMonth: string | null;
  nextMonth: string | null;
  cells: CalendarCell[];
  day: string | null;
  dayLabel: string | null;
  slots: string[];
  time: string | null;
  notices: string[];
  errorTone: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Le scelte cambiano subito a video; giorni e orari si ricalcolano sul server in sottofondo.
  const server: Choice = { selected: props.selected, month: props.month, day: props.day, time: props.time };
  const [choice, setChoice] = useOptimistic(server);

  const go = (next: Choice) => {
    startTransition(() => {
      setChoice(next);
      router.replace(`/prenota${bookingQuery({ services: next.selected, month: next.month, day: next.day, time: next.time })}`, {
        scroll: false,
      });
    });
  };

  const toggle = (id: string, checked: boolean) =>
    go({ ...choice, selected: checked ? [...choice.selected, id] : choice.selected.filter((s) => s !== id) });

  // Riepilogo immediato (durata arrotondata come in calendario e totale).
  const byId = new Map(props.categories.flatMap((c) => c.services).map((s) => [s.id, s]));
  const chosen = choice.selected.map((id) => byId.get(id)).filter((s): s is Service => !!s);
  const rawMin = chosen.reduce((sum, s) => sum + s.durationMin, 0);
  const totalCents = chosen.reduce((sum, s) => sum + s.priceCents, 0);

  const loadingDay = choice.day !== props.day || choice.selected.join() !== props.selected.join();
  const ready = !pending && !!props.day && !!props.time && choice.time === props.time;

  // Scelto un giorno, porta in vista gli orari (sul telefono stanno sotto il calendario).
  const slotsRef = useRef<HTMLElement>(null);
  const lastDay = useRef(props.day);
  useEffect(() => {
    if (props.day && props.day !== lastDay.current) slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    lastDay.current = props.day;
  }, [props.day]);

  const morning = props.slots.filter((t) => t < "13:00");
  const afternoon = props.slots.filter((t) => t >= "13:00");

  return (
    <div className="flex flex-col gap-8 pb-36">
      {/* 1. Servizi */}
      <section aria-labelledby="servizi" className="flex flex-col gap-4">
        <h2 id="servizi" className="text-xl">
          <StepNumber n={1} /> Scegli i servizi
        </h2>
        {props.categories.map((c) => (
          <fieldset key={c.id} className="flex flex-col gap-2">
            <legend className="mb-1.5 font-serif text-lg">{c.name}</legend>
            {c.services.map((s) => {
              const checked = choice.selected.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    checked ? "border-prugna/40 bg-cipria/20" : "border-prugna/10 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggle(s.id, e.target.checked)}
                    className="size-5 shrink-0 accent-[var(--color-prugna)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{s.name}</span>
                    {s.description ? <span className="text-sm text-prugna/60">{s.description}</span> : null}
                    <span className="text-sm text-prugna/60">{formatDuration(s.durationMin)}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatEuro(s.priceCents)}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </section>

      {/* 2. Giorno */}
      <section aria-labelledby="giorno" className="flex flex-col gap-3" aria-busy={pending}>
        <h2 id="giorno" className="text-xl">
          <StepNumber n={2} /> Scegli il giorno
        </h2>
        {chosen.length === 0 ? (
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-prugna/60">Scegli almeno un servizio per vedere i giorni liberi.</p>
        ) : (
          <div className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prugna/5 transition-opacity ${loadingDay ? "opacity-60" : ""}`}>
            <div className="mb-3 flex items-center justify-between">
              <MonthButton
                label="Mese precedente"
                disabled={!props.prevMonth || pending}
                onClick={() => props.prevMonth && go({ ...choice, month: props.prevMonth, day: null, time: null })}
                direction="prev"
              />
              <span className="font-serif text-lg first-letter:uppercase">{props.monthLabel}</span>
              <MonthButton
                label="Mese successivo"
                disabled={!props.nextMonth || pending}
                onClick={() => props.nextMonth && go({ ...choice, month: props.nextMonth, day: null, time: null })}
                direction="next"
              />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center" role="grid">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="pb-1 text-xs font-medium text-prugna/50" aria-hidden>
                  {w}
                </span>
              ))}
              {props.cells.map((cell, i) =>
                cell ? (
                  <button
                    key={cell.day}
                    type="button"
                    disabled={!cell.available || pending}
                    onClick={() => go({ ...choice, day: cell.day, time: null })}
                    aria-pressed={choice.day === cell.day}
                    aria-label={`${cell.n}${cell.available ? "" : ", nessun orario libero"}`}
                    className={`relative mx-auto flex size-10 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors ${
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
            {props.cells.every((c) => !c?.available) && !loadingDay ? (
              <p className="mt-3 text-center text-sm text-prugna/60">
                Nessun giorno libero in questo mese{props.nextMonth ? ": prova il mese successivo." : "."}
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* 3. Orario */}
      <section ref={slotsRef} aria-labelledby="orario" className="flex scroll-mt-4 flex-col gap-3" aria-live="polite">
        <h2 id="orario" className="text-xl">
          <StepNumber n={3} /> Scegli l&apos;orario
        </h2>
        {props.notices.map((n) => (
          <p key={n} role={props.errorTone ? "alert" : "status"} className="rounded-xl bg-cipria/30 px-4 py-3 text-sm">
            {n}
          </p>
        ))}
        {chosen.length === 0 || !choice.day ? (
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-prugna/60">
            {chosen.length === 0 ? "Prima scegli i servizi e il giorno." : "Scegli un giorno nel calendario."}
          </p>
        ) : loadingDay ? (
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-prugna/60">Cerco gli orari liberi…</p>
        ) : (
          <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prugna/5">
            <p className="font-medium first-letter:uppercase">{props.dayLabel}</p>
            {[
              { label: "Mattina", times: morning },
              { label: "Pomeriggio", times: afternoon },
            ]
              .filter((g) => g.times.length > 0)
              .map((g) => (
                <div key={g.label} className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-prugna/50 uppercase">{g.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {g.times.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => go({ ...choice, time: t })}
                        disabled={pending}
                        aria-pressed={choice.time === t}
                        className={`min-h-11 min-w-[4.75rem] rounded-full px-4 text-[15px] tabular-nums transition-colors ${
                          choice.time === t ? "bg-prugna font-semibold text-avorio" : "bg-cipria/25 hover:bg-cipria/50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Riepilogo fisso in basso */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-prugna/10 bg-avorio/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex min-w-0 flex-col">
            {chosen.length ? (
              <>
                <span className="text-sm text-prugna/70">
                  {chosen.length === 1 ? "1 servizio" : `${chosen.length} servizi`} · {formatDuration(roundUpTo(rawMin, props.roundingMin))}
                </span>
                <span className="text-lg font-semibold tabular-nums">{formatEuro(totalCents)}</span>
              </>
            ) : (
              <span className="text-sm text-prugna/60">Nessun servizio scelto</span>
            )}
          </div>
          {ready ? (
            <Link
              href={`/prenota/riepilogo${bookingQuery({ services: props.selected, day: props.day, time: props.time })}`}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-prugna px-6 font-medium text-avorio hover:bg-prugna/90"
            >
              Continua
            </Link>
          ) : (
            <span className="inline-flex min-h-12 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-prugna/30 px-6 font-medium text-avorio">
              {pending ? "Attendi…" : "Continua"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mr-1.5 inline-flex size-7 items-center justify-center rounded-full bg-oro/25 align-[0.15em] font-sans text-sm font-semibold">
      {n}
    </span>
  );
}

function MonthButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "prev" | "next";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full hover:bg-cipria/20 disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d={direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
