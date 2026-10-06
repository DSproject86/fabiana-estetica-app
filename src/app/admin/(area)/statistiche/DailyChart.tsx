"use client";

import { useState } from "react";
import { brand } from "@/config/brand";
import { formatEuro } from "@/lib/money";

export type ChartDay = { day: string; n: number; label: string; appointmentsCents: number; packagesCents: number };

const HEIGHT = 160;

/**
 * Incassato giorno per giorno: barre impilate (appuntamenti sotto, pacchetti sopra), una sola scala.
 * Tocca o passa sopra una barra per vedere i valori; la tabella completa è sotto il grafico.
 */
export function DailyChart({ days }: { days: ChartDay[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(...days.map((d) => d.appointmentsCents + d.packagesCents), 0);
  const current = days.find((d) => d.day === selected) ?? null;
  const scale = (cents: number) => (max > 0 ? (cents / max) * HEIGHT : 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-prugna/80">
        <Legend color={brand.chart.appointments} label="Appuntamenti" />
        <Legend color={brand.chart.packages} label="Pacchetti" />
      </div>

      <div className="relative" style={{ height: HEIGHT + 20 }}>
        {max > 0 ? (
          <>
            <span className="absolute top-0 right-0 -translate-y-1/2 bg-white pl-1 text-[11px] text-prugna/50 tabular-nums">
              {formatEuro(max)}
            </span>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-prugna/10" aria-hidden />
          </>
        ) : null}
        <div className="absolute inset-x-0 border-t border-prugna/20" style={{ top: HEIGHT }} aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-end gap-[2px]" style={{ height: HEIGHT }} onMouseLeave={() => setSelected(null)}>
          {days.map((d) => {
            const total = d.appointmentsCents + d.packagesCents;
            const active = selected === d.day;
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => setSelected(active ? null : d.day)}
                onMouseEnter={() => setSelected(d.day)}
                onFocus={() => setSelected(d.day)}
                aria-label={`${d.label}: ${formatEuro(total)}`}
                className={`flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-[3px] ${active ? "bg-prugna/5" : ""}`}
              >
                {d.packagesCents > 0 ? (
                  <span
                    className="block w-full rounded-t-[3px]"
                    style={{ height: scale(d.packagesCents), background: brand.chart.packages, marginBottom: d.appointmentsCents > 0 ? 2 : 0 }}
                  />
                ) : null}
                {d.appointmentsCents > 0 ? (
                  <span
                    className={`block w-full ${d.packagesCents > 0 ? "" : "rounded-t-[3px]"}`}
                    style={{ height: scale(d.appointmentsCents), background: brand.chart.appointments }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="absolute inset-x-0 flex gap-[2px] text-[10px] text-prugna/50" style={{ top: HEIGHT + 4 }} aria-hidden>
          {days.map((d) => (
            <span key={d.day} className="min-w-0 flex-1 text-center tabular-nums">
              {d.n === 1 || d.n % 7 === 1 ? d.n : ""}
            </span>
          ))}
        </div>
      </div>

      <p className="min-h-10 text-sm" aria-live="polite">
        {current ? (
          <>
            <span className="font-medium first-letter:uppercase">{current.label}</span>:{" "}
            <strong className="tabular-nums">{formatEuro(current.appointmentsCents + current.packagesCents)}</strong>
            <span className="text-prugna/70">
              {" "}
              (appuntamenti {formatEuro(current.appointmentsCents)}, pacchetti {formatEuro(current.packagesCents)})
            </span>
          </>
        ) : (
          <span className="text-prugna/50">Tocca una barra per vedere il giorno.</span>
        )}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-3 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
