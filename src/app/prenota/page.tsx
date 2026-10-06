import type { Metadata } from "next";
import Link from "next/link";
import { ClientShell, PageTitle } from "@/components/client/ClientShell";
import { requireClient } from "@/lib/auth/client";
import { bookingDuration } from "@/lib/availability/duration";
import { clientLimits, computeAvailableDays, computeDailySlots, loadRangeContext, loadSettings } from "@/lib/availability/queries";
import { MAX_SERVICES_PER_BOOKING } from "@/lib/availability/services";
import { addMonthsToMonth, formatMonth, monthGrid, monthOf, monthRange } from "@/lib/booking/calendar";
import { BOOKING_ERRORS, parseBookingParams } from "@/lib/booking/params";
import { loadBookingCatalog } from "@/lib/booking/server";
import { formatDayLong, formatTime, todayKey, type DayKey } from "@/lib/time/rome";
import { BookingFlow } from "./BookingFlow";

export const metadata: Metadata = { title: "Prenota", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PrenotaPage({ searchParams }: { searchParams: SearchParams }) {
  await requireClient();
  const params = parseBookingParams(await searchParams);
  const now = new Date();

  const [settings, categories] = await Promise.all([loadSettings(), loadBookingCatalog()]);
  const bookable = new Map(categories.flatMap((c) => c.services).map((s) => [s.id, s]));
  const selected = params.services.filter((id) => bookable.has(id));
  const services = selected.map((id) => bookable.get(id)!);
  const tooMany = services.length > MAX_SERVICES_PER_BOOKING;

  const limits = clientLimits(settings, now);
  const today = todayKey(now);
  const lastDay = limits.lastDay!;
  const minMonth = monthOf(today);
  const maxMonth = monthOf(lastDay);
  const wanted = params.day ? monthOf(params.day) : (params.month ?? minMonth);
  const month = wanted < minMonth ? minMonth : wanted > maxMonth ? maxMonth : wanted;

  const notices: string[] = [];
  if (params.error) notices.push(BOOKING_ERRORS[params.error]);
  if (tooMany) notices.push(`Puoi scegliere al massimo ${MAX_SERVICES_PER_BOOKING} servizi per appuntamento.`);

  let available: DayKey[] = [];
  let day: DayKey | null = null;
  let slots: string[] = [];
  let time: string | null = null;

  if (services.length > 0 && !tooMany) {
    const duration = bookingDuration(services.map((s) => s.durationMin), settings.durationRoundingMin, settings.bufferMin);
    const query = { durationMin: duration.durationMin, bufferMin: duration.bufferMin, gridMin: settings.slotGridMin, limits };
    const range = monthRange(month);
    const from = range.first < today ? today : range.first;
    const to = range.last > lastDay ? lastDay : range.last;
    if (from <= to) {
      const ctx = await loadRangeContext(from, to);
      available = computeAvailableDays(ctx, query);
      if (params.day && available.includes(params.day)) {
        day = params.day;
        const [daily] = computeDailySlots({ ...ctx, days: ctx.days.filter((d) => d.day === day) }, query);
        slots = daily.slots.map(formatTime);
      }
    }
    if (params.day && !day && !params.error) {
      notices.push(`Con i servizi scelti ${formatDayLong(params.day)} non ha orari liberi: scegli un altro giorno.`);
    }
    if (day && params.time) {
      if (slots.includes(params.time)) time = params.time;
      else if (!params.error) notices.push(`Con i servizi scelti le ${params.time} non sono più libere: scegli un altro orario.`);
    }
  }

  return (
    <ClientShell loggedIn wide>
      <PageTitle title="Prenota" back={{ href: "/", label: "Home" }} />
      {categories.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-prugna/70 ring-1 ring-prugna/5">
          Al momento non ci sono servizi prenotabili online. <Link href="/" className="underline">Torna alla home</Link>
        </p>
      ) : (
        <BookingFlow
          categories={categories}
          roundingMin={settings.durationRoundingMin}
          selected={selected}
          month={month}
          monthLabel={formatMonth(month)}
          prevMonth={month > minMonth ? addMonthsToMonth(month, -1) : null}
          nextMonth={month < maxMonth ? addMonthsToMonth(month, 1) : null}
          cells={monthGrid(month, new Set(available), today)}
          day={day}
          dayLabel={day ? formatDayLong(day) : null}
          slots={slots}
          time={time}
          notices={notices}
          errorTone={!!params.error}
        />
      )}
    </ClientShell>
  );
}
