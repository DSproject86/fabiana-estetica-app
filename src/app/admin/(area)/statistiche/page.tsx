import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { parseMonth } from "@/lib/agenda/rules";
import { requireAdmin } from "@/lib/auth/admin";
import { addMonthsToMonth, formatMonth, monthOf } from "@/lib/booking/calendar";
import { formatEuro } from "@/lib/money";
import { loadMonthReport } from "@/lib/stats/queries";
import { formatDayLong, formatDayShort, todayKey } from "@/lib/time/rome";
import { MonthNav } from "../agenda/_components/MonthNav";
import { UnmarkedNotice } from "../agenda/_components/UnmarkedNotice";
import { DailyChart } from "./DailyChart";

export const metadata: Metadata = { title: "Statistiche" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function signedEuro(cents: number): string {
  return cents > 0 ? `+${formatEuro(cents)}` : cents < 0 ? `−${formatEuro(-cents)}` : formatEuro(0);
}

function signedPercent(value: number): string {
  const text = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${text}%`;
}

export default async function StatistichePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const now = new Date();
  const today = todayKey(now);
  const month = parseMonth(first((await searchParams).mese), today);
  const { current, previous, comparison } = await loadMonthReport(month, now);
  const previousLabel = formatMonth(previous.month);
  const incomeDays = current.days.filter((d) => d.totalCents > 0);

  return (
    <div className="flex flex-col gap-6 pb-12">
      <h1 className="text-3xl">Statistiche</h1>

      <MonthNav
        label={formatMonth(month)}
        prev={`/admin/statistiche?mese=${addMonthsToMonth(month, -1)}`}
        next={`/admin/statistiche?mese=${addMonthsToMonth(month, 1)}`}
        today={month !== monthOf(today) ? "/admin/statistiche" : null}
      />

      <UnmarkedNotice count={current.counts.unmarked} />

      <section aria-labelledby="totale" className="flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prugna/5">
        <h2 id="totale" className="font-sans text-sm font-medium text-prugna/60">
          Incassato a {formatMonth(month)}
        </h2>
        <p className="font-serif text-4xl tabular-nums">{formatEuro(current.totalCents)}</p>
        <p className="text-sm">
          <span className={comparison.diffCents < 0 ? "text-red-800" : comparison.diffCents > 0 ? "text-green-800" : ""}>
            {signedEuro(comparison.diffCents)}
            {comparison.percent !== null ? ` (${signedPercent(comparison.percent)})` : ""}
          </span>{" "}
          <span className="text-prugna/60">
            rispetto a {previousLabel} ({formatEuro(previous.totalCents)})
          </span>
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-avorio p-3">
            <dt className="flex items-center gap-1.5 text-prugna/70">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: brand.chart.appointments }} aria-hidden />
              Appuntamenti fatti
            </dt>
            <dd className="text-lg font-semibold tabular-nums">{formatEuro(current.appointmentsCents)}</dd>
          </div>
          <div className="rounded-xl bg-avorio p-3">
            <dt className="flex items-center gap-1.5 text-prugna/70">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: brand.chart.packages }} aria-hidden />
              Pagamenti pacchetti
            </dt>
            <dd className="text-lg font-semibold tabular-nums">{formatEuro(current.packagesCents)}</dd>
          </div>
        </dl>
        <p className="text-xs text-prugna/50">
          Le sedute scalate da un pacchetto non si contano negli appuntamenti: i loro soldi sono nei pagamenti dei pacchetti.
        </p>
      </section>

      <section aria-labelledby="giorni" className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prugna/5">
        <h2 id="giorni" className="text-xl">Giorno per giorno</h2>
        <DailyChart
          days={current.days.map((d) => ({
            day: d.day,
            n: Number(d.day.slice(8)),
            label: formatDayLong(d.day),
            appointmentsCents: d.appointmentsCents,
            packagesCents: d.packagesCents,
          }))}
        />
        {incomeDays.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer py-1 text-prugna/70">Tabella dei giorni con incasso</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead className="text-left text-xs text-prugna/60">
                <tr>
                  <th className="py-1 font-medium">Giorno</th>
                  <th className="py-1 text-right font-medium">Appunt.</th>
                  <th className="py-1 text-right font-medium">Pacchetti</th>
                  <th className="py-1 text-right font-medium">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-prugna/10">
                {incomeDays.map((d) => (
                  <tr key={d.day}>
                    <td className="py-1.5">{formatDayShort(d.day)}</td>
                    <td className="py-1.5 text-right">{formatEuro(d.appointmentsCents)}</td>
                    <td className="py-1.5 text-right">{formatEuro(d.packagesCents)}</td>
                    <td className="py-1.5 text-right font-medium">{formatEuro(d.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : (
          <p className="text-sm text-prugna/50">Nessun incasso registrato in questo mese.</p>
        )}
      </section>

      <section aria-labelledby="appuntamenti" className="flex flex-col gap-3">
        <h2 id="appuntamenti" className="text-xl">Appuntamenti</h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Fatti", value: current.counts.done },
            { label: "Non presentate", value: current.counts.noShow },
            { label: "Annullati", value: current.counts.cancelled },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl bg-white p-3 ring-1 ring-prugna/5">
              <dd className="font-serif text-2xl tabular-nums">{t.value}</dd>
              <dt className="text-xs text-prugna/60">{t.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="servizi" className="flex flex-col gap-3">
        <h2 id="servizi" className="text-xl">Per servizio</h2>
        {current.services.length === 0 ? (
          <p className="text-sm text-prugna/50">Nessun appuntamento segnato come Fatto in questo mese.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-avorio/60 text-left text-xs text-prugna/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Servizio</th>
                  <th className="px-2 py-2 text-right font-medium">Volte</th>
                  <th className="px-4 py-2 text-right font-medium">Ha reso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-prugna/10">
                {current.services.map((s) => (
                  <tr key={s.key}>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-2 py-2 text-right">
                      {s.count}
                      {s.fromPackage > 0 ? <span className="block text-xs text-prugna/50">{s.fromPackage} da pacchetto</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatEuro(s.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-prugna/50">
          L&apos;incassato di ogni appuntamento si divide tra i servizi in proporzione al prezzo di listino (sconti ed extra compresi).
        </p>
      </section>
    </div>
  );
}
