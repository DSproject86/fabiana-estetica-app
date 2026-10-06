import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { effectiveDay, type EffectiveDay } from "@/lib/schedule/effective";
import { loadBlocks, loadOverrides, loadWeekly } from "@/lib/schedule/queries";
import { addDays, dayBounds, dayKeyOf, type DayKey } from "@/lib/time/rome";
import { isUnmarkedPast } from "./rules";

export const agendaAppointmentSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  durationMin: true,
  bufferMin: true,
  totalPriceCents: true,
  status: true,
  doneAt: true,
  amountCollectedCents: true,
  createdBy: true,
  createdAt: true,
  adminNotes: true,
  reminderEmailSentAt: true,
  whatsappSentAt: true,
  client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, allergyNotes: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, serviceId: true, name: true, durationMin: true, priceCents: true, clientPackageId: true },
  },
} satisfies Prisma.AppointmentSelect;

export type AgendaAppointment = Prisma.AppointmentGetPayload<{ select: typeof agendaAppointmentSelect }>;

export type AgendaDay = { day: EffectiveDay; appointments: AgendaAppointment[] };

/** Giorni indicati (in ordine) con orario effettivo, blocchi e tutti gli appuntamenti (anche annullati). */
export async function loadAgendaDays(days: DayKey[]): Promise<AgendaDay[]> {
  if (days.length === 0) return [];
  const sorted = [...new Set(days)].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const [weekly, overrides, blocks, appointments] = await Promise.all([
    loadWeekly(),
    loadOverrides(first, last),
    loadBlocks(dayBounds(first).start, dayBounds(last).end),
    prisma.appointment.findMany({
      where: { OR: sorted.map((d) => ({ startsAt: { gte: dayBounds(d).start, lt: dayBounds(d).end } })) },
      orderBy: { startsAt: "asc" },
      select: agendaAppointmentSelect,
    }),
  ]);
  const byDay = new Map<DayKey, AgendaAppointment[]>();
  for (const a of appointments) {
    const key = dayKeyOf(a.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  return sorted.map((d) => ({ day: effectiveDay(d, weekly, overrides, blocks), appointments: byDay.get(d) ?? [] }));
}

export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Appuntamenti passati e non segnati (confermati, già finiti, né Fatti né Non presentata). */
export async function loadUnmarkedPast(now = new Date(), range?: { from: DayKey; to: DayKey }) {
  const rangeEnd = range ? dayBounds(range.to).end : now;
  const rows = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      doneAt: null,
      startsAt: { lt: rangeEnd < now ? rangeEnd : now, ...(range ? { gte: dayBounds(range.from).start } : {}) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, durationMin: true, status: true, doneAt: true },
  });
  const unmarked = rows.filter((a) => isUnmarkedPast(a, now));
  return { count: unmarked.length, days: [...new Set(unmarked.map((a) => dayKeyOf(a.startsAt)))] };
}

/** Appuntamento con tutto ciò che serve alle pagine Sposta / Servizi e ai riquadri WhatsApp. */
export function loadAgendaAppointment(id: string) {
  return prisma.appointment.findUnique({ where: { id }, select: agendaAppointmentSelect });
}
