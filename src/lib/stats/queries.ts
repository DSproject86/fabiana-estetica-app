import "server-only";
import { prisma } from "@/lib/db";
import { addMonthsToMonth, monthRange } from "@/lib/booking/calendar";
import { dayBounds, dayKeyToDbDate, dbDateToDayKey } from "@/lib/time/rome";
import { buildMonthStats, compareTotals, type MonthStats } from "./month";

export type MonthReport = {
  current: MonthStats;
  previous: MonthStats;
  comparison: ReturnType<typeof compareTotals>;
};

/** Statistiche del mese e del precedente (2 query in tutto). Confini dei mesi a mezzanotte di Roma. */
export async function loadMonthReport(month: string, now = new Date()): Promise<MonthReport> {
  const previousMonth = addMonthsToMonth(month, -1);
  const from = monthRange(previousMonth).first;
  const to = monthRange(month).last;

  const [appointments, payments] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: dayBounds(from).start, lt: dayBounds(to).end } },
      select: {
        startsAt: true,
        durationMin: true,
        status: true,
        doneAt: true,
        amountCollectedCents: true,
        items: { orderBy: { sortOrder: "asc" }, select: { serviceId: true, name: true, priceCents: true, clientPackageId: true } },
      },
    }),
    prisma.packagePayment.findMany({
      where: { paidOn: { gte: dayKeyToDbDate(from), lte: dayKeyToDbDate(to) } },
      select: { paidOn: true, amountCents: true },
    }),
  ]);
  const rows = payments.map((p) => ({ paidOn: dbDateToDayKey(p.paidOn), amountCents: p.amountCents }));

  const current = buildMonthStats(month, appointments, rows, now);
  const previous = buildMonthStats(previousMonth, appointments, rows, now);
  return { current, previous, comparison: compareTotals(current.totalCents, previous.totalCents) };
}
