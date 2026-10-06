import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadMonthReport } from "@/lib/stats/queries";
import { dayKeyToDbDate, instantAt } from "@/lib/time/rome";
import { listClients, searchClients } from "./adminClients";
import {
  CONFIRM_MISMATCH,
  FUTURE_APPOINTMENTS,
  confirmsLastName,
  deleteClientForPrivacy,
  loadClientTotals,
  setClientBlocked,
  updateClientByAdmin,
} from "./manage";

const NOW = new Date("2026-10-12T16:00:00Z");

let ids: { maria: string; giulia: string; service: string };

async function reset() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog","LoginCode","PackagePayment","AppointmentItem","ClientPackage","Appointment","Service","ServiceCategory","Client" CASCADE',
  );
  const cat = await prisma.serviceCategory.create({ data: { name: "Viso" } });
  const service = await prisma.service.create({ data: { categoryId: cat.id, name: "Pulizia viso", durationMin: 60, priceCents: 4500 } });
  const maria = await prisma.client.create({
    data: {
      firstName: "Maria",
      lastName: "De Luca",
      phone: "+393331112222",
      email: "maria@test.it",
      allergyNotes: "nichel",
      adminNotes: "preferisce il mattino",
      privacyAcceptedAt: NOW,
      privacyVersion: "v1",
    },
  });
  const giulia = await prisma.client.create({ data: { firstName: "Giulia", lastName: "Bianchi", phone: "+393334445555" } });
  ids = { maria: maria.id, giulia: giulia.id, service: service.id };
}

async function appointment(clientId: string, startsAt: Date, extra: { doneAt?: Date; amountCollectedCents?: number; status?: "NO_SHOW" } = {}) {
  return prisma.appointment.create({
    data: {
      clientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      durationMin: 60,
      bufferMin: 0,
      totalPriceCents: 4500,
      createdBy: "ADMIN",
      adminNotes: "nota",
      items: { create: { serviceId: ids.service, name: "Pulizia viso", durationMin: 60, priceCents: 4500 } },
      ...extra,
    },
  });
}

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe("elimina cliente (privacy)", () => {
  it("serve il cognome per confermare", async () => {
    expect(confirmsLastName("  de  luca ", "De Luca")).toBe(true);
    expect(confirmsLastName("", "")).toBe(false);
    expect(await deleteClientForPrivacy(ids.maria, "Rossi", NOW)).toEqual({ ok: false, error: CONFIRM_MISMATCH });
  });

  it("senza storico: cancellata davvero, anche dal registro invii", async () => {
    await prisma.notificationLog.create({ data: { channel: "EMAIL", kind: "LOGIN_CODE", provider: "resend", recipient: "maria@test.it", clientId: ids.maria } });
    expect(await deleteClientForPrivacy(ids.maria, "de luca", NOW)).toEqual({ ok: true, mode: "deleted" });
    expect(await prisma.client.findUnique({ where: { id: ids.maria } })).toBeNull();
    expect((await prisma.notificationLog.findFirstOrThrow()).recipient).toBe("cliente eliminata");
  });

  it("con appuntamenti futuri: rifiutata", async () => {
    await appointment(ids.maria, instantAt("2026-10-20", 600));
    expect(await deleteClientForPrivacy(ids.maria, "De Luca", NOW)).toEqual({ ok: false, error: FUTURE_APPOINTMENTS });
  });

  it("con storico: anonimizzata, i numeri delle statistiche restano", async () => {
    await appointment(ids.maria, instantAt("2026-10-05", 600), { doneAt: NOW, amountCollectedCents: 4500 });
    const pkg = await prisma.clientPackage.create({
      data: {
        clientId: ids.maria,
        name: "5 massaggi",
        priceCents: 15000,
        totalSessions: 5,
        notes: "regalo del marito",
        payments: { create: { amountCents: 5000, method: "CASH", paidOn: dayKeyToDbDate("2026-10-05"), note: "acconto da Maria" } },
      },
    });
    await prisma.loginCode.create({ data: { clientId: ids.maria, codeHash: "x", expiresAt: NOW } });
    const before = (await loadMonthReport("2026-10", NOW)).current;
    expect(before.totalCents).toBe(9500);

    expect(await deleteClientForPrivacy(ids.maria, "De Luca", NOW)).toEqual({ ok: true, mode: "anonymized" });

    const c = await prisma.client.findUniqueOrThrow({ where: { id: ids.maria } });
    expect(c).toMatchObject({
      firstName: "Cliente",
      lastName: "eliminata",
      phone: "",
      email: null,
      allergyNotes: null,
      adminNotes: null,
      privacyAcceptedAt: null,
      privacyVersion: null,
    });
    expect(c.anonymizedAt).not.toBeNull();
    expect(c.blockedAt).not.toBeNull();
    expect(c.sessionVersion).toBe(1);
    expect(await prisma.loginCode.count()).toBe(0);
    expect((await prisma.appointment.findFirstOrThrow()).adminNotes).toBeNull();
    expect((await prisma.clientPackage.findUniqueOrThrow({ where: { id: pkg.id } })).notes).toBeNull();
    expect((await prisma.packagePayment.findFirstOrThrow()).note).toBeNull();

    expect((await loadMonthReport("2026-10", NOW)).current).toEqual(before);
    expect((await loadClientTotals(ids.maria)).totalCents).toBe(9500);

    // Non compare più in ricerca ed elenco, e non si può modificare né eliminare di nuovo.
    expect(await searchClients("eliminata")).toEqual([]);
    expect((await listClients("", 1)).clients.map((x) => x.id)).toEqual([ids.giulia]);
    expect(await updateClientByAdmin(ids.maria, { firstName: "A", lastName: "B", phone: "3331112222", email: "" }, false)).toMatchObject({ ok: false });
    expect(await deleteClientForPrivacy(ids.maria, "eliminata", NOW)).toMatchObject({ ok: false });
  });
});

describe("scheda cliente", () => {
  it("modifica: email unica, allergie toccate solo se il campo c'era", async () => {
    await prisma.client.update({ where: { id: ids.giulia }, data: { email: "giulia@test.it" } });
    const base = { firstName: "Maria", lastName: "De Luca", phone: "333 111 2222", adminNotes: "note nuove" };
    expect(await updateClientByAdmin(ids.maria, { ...base, email: "GIULIA@test.it" }, false)).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(String) },
    });
    expect(await updateClientByAdmin(ids.maria, { ...base, email: "", allergyNotes: "" }, false)).toEqual({ ok: true });
    let c = await prisma.client.findUniqueOrThrow({ where: { id: ids.maria } });
    expect(c).toMatchObject({ email: null, adminNotes: "note nuove", allergyNotes: "nichel" });

    expect(await updateClientByAdmin(ids.maria, { ...base, email: "", allergyNotes: "lattice" }, true)).toEqual({ ok: true });
    c = await prisma.client.findUniqueOrThrow({ where: { id: ids.maria } });
    expect(c.allergyNotes).toBe("lattice");
  });

  it("blocca: esce subito (sessionVersion) e perde i codici; sblocca", async () => {
    await prisma.loginCode.create({ data: { clientId: ids.maria, codeHash: "x", expiresAt: NOW } });
    expect(await setClientBlocked(ids.maria, true, NOW)).toBe(true);
    let c = await prisma.client.findUniqueOrThrow({ where: { id: ids.maria } });
    expect(c.blockedAt).not.toBeNull();
    expect(c.sessionVersion).toBe(1);
    expect(await prisma.loginCode.count()).toBe(0);
    await setClientBlocked(ids.maria, false, NOW);
    c = await prisma.client.findUniqueOrThrow({ where: { id: ids.maria } });
    expect(c.blockedAt).toBeNull();
  });

  it("totale speso e non presentate", async () => {
    await appointment(ids.maria, instantAt("2026-10-05", 600), { doneAt: NOW, amountCollectedCents: 4000 });
    await appointment(ids.maria, instantAt("2026-10-06", 600), { status: "NO_SHOW" });
    await prisma.clientPackage.create({
      data: { clientId: ids.maria, name: "p", priceCents: 10000, totalSessions: 5, payments: { create: { amountCents: 3000, method: "CARD", paidOn: dayKeyToDbDate("2026-10-05") } } },
    });
    expect(await loadClientTotals(ids.maria)).toEqual({ appointmentsCents: 4000, packagesCents: 3000, totalCents: 7000, noShows: 1, doneCount: 1 });
  });
});
