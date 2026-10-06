import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/admin/WhatsAppButton";
import { loadAgendaAppointment, loadAgendaDays, loadUnmarkedPast, daysBetween, type AgendaAppointment } from "@/lib/agenda/queries";
import {
  agendaRange,
  agendaState,
  canEdit,
  canMarkOutcome,
  collectableCents,
  notifyByDefault,
  parseMonth,
  treatmentEndOf,
} from "@/lib/agenda/rules";
import { addMonthsToMonth, formatMonth, monthOf } from "@/lib/booking/calendar";
import { loadWhatsappLinkBuilder } from "@/lib/notifications/whatsappLinks";
import { dayKeyOf, formatDayLong, formatTime, todayKey } from "@/lib/time/rome";
import type { CardData } from "./_components/AppointmentCard";
import { DaySection } from "./_components/DaySection";
import { MonthNav } from "./_components/MonthNav";
import { UnmarkedNotice } from "./_components/UnmarkedNotice";

export const metadata: Metadata = { title: "Agenda" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Al massimo tanti giorni nella vista "da segnare" (i più vecchi per primi). */
const UNMARKED_DAYS_LIMIT = 31;

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const now = new Date();
  const today = todayKey(now);
  const month = parseMonth(first(params.mese), today);
  const showPast = first(params.passati) === "1";
  const unmarkedView = first(params.vista) === "da-segnare";
  const esito = first(params.esito);
  const esitoId = first(params.id);

  const unmarked = await loadUnmarkedPast(now);
  const range = agendaRange(month, today, showPast);
  const days = unmarkedView ? unmarked.days.slice(0, UNMARKED_DAYS_LIMIT) : daysBetween(range.from, range.to);

  const [agendaDays, whatsappLink, outcome] = await Promise.all([
    loadAgendaDays(days),
    loadWhatsappLinkBuilder(),
    esitoId && ESITI[esito as keyof typeof ESITI] ? loadAgendaAppointment(esitoId) : null,
  ]);

  const toCard = (a: AgendaAppointment): CardData => ({
    id: a.id,
    timeRange: `${formatTime(a.startsAt)}–${formatTime(treatmentEndOf(a))}`,
    clientName: `${a.client.firstName} ${a.client.lastName}`,
    allergyNotes: a.client.allergyNotes,
    services: a.items.map((i) => i.name).join(" · "),
    totalCents: a.totalPriceCents,
    prefillCents: collectableCents(a.items),
    packageItems: a.items.filter((i) => i.clientPackageId).length,
    state: agendaState(a),
    amountCents: a.amountCollectedCents,
    canOutcome: canMarkOutcome(a, now),
    canEdit: canEdit(a),
    noBuffer: a.bufferMin === 0,
    online: a.createdBy === "CLIENT",
    hasEmail: !!a.client.email,
    notifyDefault: notifyByDefault(a.startsAt, a.client.email, now),
    whatsapp: { confirm: whatsappLink("BOOKING_CONFIRMED", a), reminder: whatsappLink("REMINDER", a) },
  });

  const banner = outcome ? ESITI[esito as keyof typeof ESITI] : null;
  const currentMonth = monthOf(today);
  const totalAppointments = agendaDays.reduce((n, d) => n + d.appointments.filter((a) => a.status !== "CANCELLED").length, 0);

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">{unmarkedView ? "Da segnare" : "Agenda"}</h1>
        <Link
          href="/admin/agenda/nuovo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90"
        >
          <span aria-hidden className="text-lg leading-none">+</span> Nuovo
        </Link>
      </header>

      {banner && outcome ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-salvia/25 p-4 ring-1 ring-salvia/50">
          <p className="font-medium">
            {banner.title}: {outcome.client.firstName} {outcome.client.lastName}, {formatDayLong(dayKeyOf(outcome.startsAt))} alle{" "}
            {formatTime(outcome.startsAt)}.
          </p>
          <p className="text-sm text-prugna/70">
            {first(params.email) === "1"
              ? `Email in partenza a ${outcome.client.email}.`
              : outcome.client.email
                ? "Nessuna email inviata."
                : "La cliente non ha l'email."}{" "}
            {banner.hint}
          </p>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton href={whatsappLink(banner.whatsapp, outcome)} label={banner.whatsappLabel} />
            <Link
              href={`/admin/agenda?mese=${month}`}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-prugna/70 hover:bg-white/60"
            >
              Chiudi
            </Link>
          </div>
        </div>
      ) : null}

      {!unmarkedView ? <UnmarkedNotice count={unmarked.count} /> : null}

      {unmarkedView ? (
        <div className="flex flex-col gap-2">
          <Link href="/admin/agenda" className="w-fit text-sm text-prugna/60 hover:text-prugna">
            ← Torna all&apos;agenda
          </Link>
          <p className="text-prugna/70">
            {unmarked.count === 0
              ? "Tutto segnato: nessun appuntamento passato da sistemare."
              : `Segna come “Fatto” o “Non presentata” gli appuntamenti passati rimasti in sospeso${
                  unmarked.days.length > UNMARKED_DAYS_LIMIT ? ` (qui i primi ${UNMARKED_DAYS_LIMIT} giorni)` : ""
                }.`}
          </p>
        </div>
      ) : (
        <MonthNav
          label={formatMonth(month)}
          prev={`/admin/agenda?mese=${addMonthsToMonth(month, -1)}`}
          next={`/admin/agenda?mese=${addMonthsToMonth(month, 1)}`}
          today={month !== currentMonth ? "/admin/agenda" : null}
        />
      )}

      {!unmarkedView && range.partial ? (
        <Link href={`/admin/agenda?mese=${month}&passati=1`} className="w-fit text-sm text-prugna/60 underline-offset-2 hover:underline">
          Mostra anche i giorni precedenti di {formatMonth(month)}
        </Link>
      ) : null}

      {!unmarkedView && totalAppointments === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-4 text-sm text-prugna/70">
          Nessun appuntamento in questo periodo.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {agendaDays.map((d) => {
          const active = d.appointments.filter((a) => a.status !== "CANCELLED");
          const cancelled = d.appointments
            .filter((a) => a.status === "CANCELLED")
            .map((a) => ({
              id: a.id,
              label: `${formatTime(a.startsAt)} ${a.client.firstName} ${a.client.lastName} · ${a.items.map((i) => i.name).join(", ")}`,
            }));
          return (
            <DaySection
              key={d.day.day}
              agendaDay={d}
              isToday={d.day.day === today}
              cards={active.map(toCard)}
              cancelled={cancelled}
            />
          );
        })}
      </div>
    </div>
  );
}

const ESITI = {
  nuovo: {
    title: "Appuntamento inserito",
    hint: "Puoi mandarle la conferma anche su WhatsApp.",
    whatsapp: "BOOKING_CONFIRMED",
    whatsappLabel: "Conferma su WhatsApp",
  },
  spostato: {
    title: "Appuntamento spostato",
    hint: "Avvisala anche su WhatsApp col messaggio di modifica.",
    whatsapp: "APPOINTMENT_CHANGED",
    whatsappLabel: "Avvisa su WhatsApp",
  },
  servizi: {
    title: "Servizi aggiornati",
    hint: "Su WhatsApp puoi mandarle il riepilogo aggiornato.",
    whatsapp: "BOOKING_CONFIRMED",
    whatsappLabel: "Riepilogo su WhatsApp",
  },
  annullato: {
    title: "Appuntamento annullato",
    hint: "Avvisala anche su WhatsApp col messaggio di cancellazione.",
    whatsapp: "APPOINTMENT_CANCELLED",
    whatsappLabel: "Avvisa su WhatsApp",
  },
} as const;
