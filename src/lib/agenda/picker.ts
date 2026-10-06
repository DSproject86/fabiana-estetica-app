import "server-only";
import { prisma } from "@/lib/db";
import { ADMIN_LIMITS, computeAvailableDays, computeDailySlots, loadRangeContext } from "@/lib/availability/queries";
import { addMonthsToMonth, formatMonth, monthGrid, monthOf, monthRange, type CalendarCell } from "@/lib/booking/calendar";
import { daysBetween } from "./queries";
import { formatDayLong, formatTime, todayKey, type DayKey } from "@/lib/time/rome";

/** Servizi del listino per l'admin: anche quelli nascosti alle clienti (segnalati). */
export async function loadAdminCatalog() {
  const categories = await prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      services: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, durationMin: true, priceCents: true, active: true },
      },
    },
  });
  return categories
    .filter((c) => c.services.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      services: c.services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        hidden: !s.active || !c.active,
      })),
    }));
}

export type AdminCatalog = Awaited<ReturnType<typeof loadAdminCatalog>>;

export type CalendarView = {
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  cells: CalendarCell[];
  day: DayKey | null;
  dayLabel: string | null;
  slots: string[];
  /** Il giorno chiesto non ha orari liberi con questa durata. */
  dayFull: boolean;
};

/**
 * Calendario del mese per l'admin: niente preavviso né limite dei mesi. Con "Fuori orario" tutti
 * i giorni sono selezionabili e l'ora si scrive a mano (il controllo vero lo fa il server sotto lock).
 */
export async function adminCalendar(input: {
  month: string;
  day: DayKey | null;
  durationMin: number;
  bufferMin: number;
  gridMin: number;
  outside: boolean;
  excludeAppointmentId?: string;
  now?: Date;
}): Promise<CalendarView> {
  const today = todayKey(input.now);
  const { month } = input;
  const { first, last } = monthRange(month);
  let available: DayKey[] = [];
  let slots: Date[] = [];
  const day: DayKey | null = input.day && monthOf(input.day) === month ? input.day : null;

  if (input.outside) {
    available = daysBetween(first, last);
  } else if (input.durationMin > 0) {
    const query = { durationMin: input.durationMin, bufferMin: input.bufferMin, gridMin: input.gridMin, limits: ADMIN_LIMITS };
    const ctx = await loadRangeContext(first, last, prisma, input.excludeAppointmentId);
    available = computeAvailableDays(ctx, query);
    if (day) {
      const [daily] = computeDailySlots({ ...ctx, days: ctx.days.filter((d) => d.day === day) }, query);
      slots = daily.slots;
    }
  }
  const dayFull = !!day && !input.outside && slots.length === 0;

  return {
    month,
    monthLabel: formatMonth(month),
    prevMonth: addMonthsToMonth(month, -1),
    nextMonth: addMonthsToMonth(month, 1),
    cells: monthGrid(month, new Set(available), today),
    day,
    dayLabel: day ? formatDayLong(day) : null,
    slots: slots.map(formatTime),
    dayFull,
  };
}
