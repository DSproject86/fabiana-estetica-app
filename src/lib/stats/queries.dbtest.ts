import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dayKeyToDbDate, instantAt } from "@/lib/time/rome";
import { loadMonthReport } from "./queries";

const NOW = new Date("2026-12-15T10:00:00Z");
let clientId: string;
let packageId: string;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "PackagePayment","AppointmentItem","ClientPackage","Appointment","Client" CASCADE');
  const client = await prisma.client.create({ data: { firstName: "Maria", lastName: "Rossi", phone: "+393331112222" } });
  clientId = client.id;
  packageId = (await prisma.clientPackage.create({ data: { clientId, name: "10 massaggi", priceCents: 50000, totalSessions: 10 } })).id;
});
afterAll(() => prisma.$disconnect());

async function doneAt(startsAt: Date, amount: number, status: "CONFIRMED" | "NO_SHOW" | "CANCELLED" = "CONFIRMED") {
  await prisma.appointment.create({
    data: {
      clientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      durationMin: 60,
      bufferMin: 0,
      totalPriceCents: amount,
      createdBy: "ADMIN",
      status,
      doneAt: status === "CONFIRMED" ? startsAt : null,
      amountCollectedCents: status === "CONFIRMED" ? amount : null,
      items: { create: [{ name: "Pulizia viso", durationMin: 60, priceCents: amount }] },
    },
  });
}

describe("loadMonthReport", () => {
  it("mese e precedente con i confini a mezzanotte di Roma, pacchetti per paidOn", async () => {
    await doneAt(new Date("2026-10-31T22:30:00Z"), 1000); // 31/10 23:30 a Roma → ottobre
    await doneAt(new Date("2026-10-31T23:30:00Z"), 2000); // 1/11 00:30 a Roma → novembre
    await doneAt(instantAt("2026-11-30", 23 * 60), 3000); // 30/11 23:00 → novembre
    await doneAt(instantAt("2026-11-10", 600), 9999, "NO_SHOW");
    await doneAt(instantAt("2026-11-11", 600), 9999, "CANCELLED");
    await prisma.packagePayment.createMany({
      data: [
        { packageId, paidOn: dayKeyToDbDate("2026-11-01"), amountCents: 20000, method: "CASH" },
        { packageId, paidOn: dayKeyToDbDate("2026-11-30"), amountCents: 5000, method: "CARD" },
        { packageId, paidOn: dayKeyToDbDate("2026-10-31"), amountCents: 7000, method: "CARD" },
        { packageId, paidOn: dayKeyToDbDate("2026-12-01"), amountCents: 99900, method: "CARD" },
      ],
    });

    const { current, previous, comparison } = await loadMonthReport("2026-11", NOW);
    expect([current.appointmentsCents, current.packagesCents, current.totalCents]).toEqual([5000, 25000, 30000]);
    expect(current.days.find((d) => d.day === "2026-11-01")).toMatchObject({ appointmentsCents: 2000, packagesCents: 20000 });
    expect(current.counts).toEqual({ done: 2, noShow: 1, cancelled: 1, unmarked: 0 });
    expect([previous.month, previous.totalCents]).toEqual(["2026-10", 8000]);
    expect(comparison).toEqual({ diffCents: 22000, percent: 275 });
  });
});
