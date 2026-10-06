import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cancelAppointment, createAdminAppointment, PACKAGE_NOT_AVAILABLE, setDone, setItemPackage } from "@/lib/agenda/mutations";
import { prisma } from "@/lib/db";
import { instantAt } from "@/lib/time/rome";
import { addPayment, deletePackage, deletePayment, sellPackage, setPackageArchived, updatePackage, updatePayment } from "./mutations";
import { loadPackage } from "./queries";
import type { PackageInput, PaymentInput } from "./validation";

const NOW = new Date("2026-10-12T16:00:00Z"); // lunedì 12 ottobre, 18:00 a Roma
const MON = "2026-10-12";
const h = (hours: number) => hours * 60;

let ids: { mario: string; anna: string; corpo: string; massaggio: string; drenante: string; viso: string };

async function reset() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog","PackagePayment","AppointmentItem","ClientPackage","PackageTemplate","Appointment","TimeBlock","DateOverrideSlot","DateOverride","WeeklySlot","Service","ServiceCategory","Client","Settings" CASCADE',
  );
  await prisma.settings.create({ data: { id: 1 } });
  await prisma.weeklySlot.create({ data: { weekday: 1, startMinute: h(9), endMinute: h(19) } });
  const corpo = await prisma.serviceCategory.create({ data: { name: "Massaggi" } });
  const visoCat = await prisma.serviceCategory.create({ data: { name: "Viso" } });
  const massaggio = await prisma.service.create({ data: { categoryId: corpo.id, name: "Massaggio rilassante", durationMin: 50, priceCents: 5000 } });
  const drenante = await prisma.service.create({ data: { categoryId: corpo.id, name: "Massaggio drenante", durationMin: 50, priceCents: 6000 } });
  const viso = await prisma.service.create({ data: { categoryId: visoCat.id, name: "Pulizia viso", durationMin: 50, priceCents: 4500 } });
  const mario = await prisma.client.create({ data: { firstName: "Mario", lastName: "Rossi", phone: "+393331112222" } });
  const anna = await prisma.client.create({ data: { firstName: "Anna", lastName: "Verdi", phone: "+393334445555" } });
  ids = { mario: mario.id, anna: anna.id, corpo: corpo.id, massaggio: massaggio.id, drenante: drenante.id, viso: viso.id };
}

const pkgInput = (over: Partial<PackageInput> = {}): PackageInput => ({
  name: "5 massaggi",
  totalSessions: 5,
  price: 15000,
  coverage: { serviceId: null, categoryId: ids.corpo },
  sessionsUsedBefore: 0,
  notes: null,
  ...over,
});
const pay = (amount: number, over: Partial<PaymentInput> = {}): PaymentInput => ({ amount, method: "CASH", paidOn: MON, note: null, ...over });

async function sell(over: Partial<PackageInput> = {}, clientId = ids.mario, initial: PaymentInput | null = null) {
  const r = await sellPackage({ clientId, templateId: null, data: pkgInput(over), initialPayment: initial, now: NOW });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.packageId;
}

async function book(minute: number, serviceIds: string[], clientId = ids.mario) {
  const r = await createAdminAppointment({ clientId, serviceIds, startsAt: instantAt(MON, minute), noBuffer: true, ignoreWorkingHours: false, now: NOW });
  if (!r.ok) throw new Error(r.error);
  return r.appointmentId;
}

const items = (appointmentId: string) =>
  prisma.appointmentItem.findMany({ where: { appointmentId }, orderBy: { sortOrder: "asc" }, select: { id: true, clientPackageId: true } });
const remaining = async (packageId: string) => (await loadPackage(packageId))!.summary.remainingSessions;

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe("vendita e pagamenti", () => {
  it("Mario Rossi: 150 €, acconto 50 € → residuo 100 €", async () => {
    const id = await sell({}, ids.mario, pay(5000));
    const p = (await loadPackage(id))!;
    expect(p.summary).toMatchObject({ paidCents: 5000, dueCents: 10000, remainingSessions: 5 });
    expect(p.coverageLabel).toBe("Massaggi (tutta la categoria)");
  });

  it("acconto oltre il prezzo, pagamenti oltre il residuo e date future: rifiutati", async () => {
    const tooMuch = await sellPackage({ clientId: ids.mario, templateId: null, data: pkgInput(), initialPayment: pay(20000), now: NOW });
    expect(tooMuch.ok).toBe(false);

    const id = await sell({}, ids.mario, pay(5000));
    const over = await addPayment(id, pay(10001), NOW);
    expect(over).toMatchObject({ ok: false, fieldErrors: { amount: expect.stringContaining("100") } });
    expect(await addPayment(id, pay(1000, { paidOn: "2026-10-13" }), NOW)).toMatchObject({ ok: false, fieldErrors: { paidOn: expect.any(String) } });

    expect(await addPayment(id, pay(10000, { method: "CARD" }), NOW)).toEqual({ ok: true });
    expect((await loadPackage(id))!.summary.dueCents).toBe(0);
    expect(await addPayment(id, pay(1), NOW)).toMatchObject({ ok: false, fieldErrors: { amount: "Il pacchetto è già pagato tutto." } });
  });

  it("modifica ed eliminazione di un pagamento", async () => {
    const id = await sell({}, ids.mario, pay(5000));
    const payment = await prisma.packagePayment.findFirstOrThrow({ where: { packageId: id } });
    // Il pagamento stesso non conta come già pagato: si può portare fino al prezzo pieno.
    expect(await updatePayment(payment.id, pay(15000, { note: "saldo" }), NOW)).toMatchObject({ ok: true });
    expect(await updatePayment(payment.id, pay(15001), NOW)).toMatchObject({ ok: false });
    expect((await loadPackage(id))!.summary.dueCents).toBe(0);
    expect(await deletePayment(payment.id)).toMatchObject({ ok: true });
    expect((await loadPackage(id))!.summary.dueCents).toBe(15000);
  });

  it("modifica pacchetto: non sotto le sedute usate né sotto il pagato", async () => {
    const id = await sell({ sessionsUsedBefore: 2 }, ids.mario, pay(8000));
    const appt = await book(h(9), [ids.massaggio]);
    await setDone({ appointmentId: appt, done: true, now: NOW });
    expect(await remaining(id)).toBe(2);

    const r = await updatePackage(id, pkgInput({ totalSessions: 2, sessionsUsedBefore: 2, price: 7000 }));
    expect(r).toMatchObject({ ok: false, fieldErrors: { totalSessions: expect.any(String), price: expect.any(String) } });
    expect(await updatePackage(id, pkgInput({ totalSessions: 3, sessionsUsedBefore: 2, price: 8000 }))).toEqual({ ok: true });
    expect(await remaining(id)).toBe(0);
  });

  it("eliminazione solo senza pagamenti né sedute; archivia e riapri", async () => {
    const empty = await sell();
    expect(await deletePackage(empty)).toMatchObject({ ok: true });
    const paid = await sell({}, ids.mario, pay(1000));
    expect(await deletePackage(paid)).toMatchObject({ ok: false });
    await setPackageArchived(paid, true, NOW);
    expect((await loadPackage(paid))!.closedAt).not.toBeNull();
    await setPackageArchived(paid, false, NOW);
    expect((await loadPackage(paid))!.closedAt).toBeNull();
  });
});

describe("scalare le sedute dall'agenda", () => {
  it("un solo pacchetto (categoria) che copre la voce: scalata alla spunta Fatto, importo senza quella voce", async () => {
    const pkg = await sell();
    const appt = await book(h(9), [ids.drenante, ids.viso]);
    const r = await setDone({ appointmentId: appt, done: true, now: NOW });
    expect(r).toMatchObject({ ok: true, amountCollectedCents: 4500, linkedItems: 1 });
    expect((await items(appt)).map((i) => i.clientPackageId)).toEqual([pkg, null]);
    expect(await remaining(pkg)).toBe(4);
  });

  it("annullare la spunta o l'appuntamento rimette la seduta", async () => {
    const pkg = await sell();
    const appt = await book(h(9), [ids.massaggio]);
    await setDone({ appointmentId: appt, done: true, now: NOW });
    expect(await remaining(pkg)).toBe(4);
    await setDone({ appointmentId: appt, done: false, now: NOW });
    expect(await remaining(pkg)).toBe(5);
    expect((await items(appt))[0].clientPackageId).toBeNull();

    await setDone({ appointmentId: appt, done: true, now: NOW });
    expect(await remaining(pkg)).toBe(4);
    await cancelAppointment({ appointmentId: appt, confirmDone: true, now: NOW });
    expect(await remaining(pkg)).toBe(5);
    expect((await items(appt))[0].clientPackageId).toBeNull();
  });

  it("più pacchetti possibili: niente in automatico, si sceglie; togliendolo l'importo torna", async () => {
    const byCategory = await sell();
    const byService = await sell({ name: "3 rilassanti", totalSessions: 3, coverage: { serviceId: ids.massaggio, categoryId: null } });
    const appt = await book(h(9), [ids.massaggio]);
    expect(await setDone({ appointmentId: appt, done: true, now: NOW })).toMatchObject({ amountCollectedCents: 5000, linkedItems: 0 });

    const [item] = await items(appt);
    expect(await setItemPackage({ appointmentId: appt, itemId: item.id, clientPackageId: byService })).toEqual({ ok: true, amountCollectedCents: 0 });
    expect(await remaining(byService)).toBe(2);
    expect(await remaining(byCategory)).toBe(5);

    expect(await setItemPackage({ appointmentId: appt, itemId: item.id, clientPackageId: null })).toEqual({ ok: true, amountCollectedCents: 5000 });
    expect(await remaining(byService)).toBe(3);
  });

  it("importo corretto a mano: scalare toglie solo il prezzo della voce", async () => {
    const pkg = await sell({ coverage: { serviceId: ids.massaggio, categoryId: null } });
    await prisma.clientPackage.update({ where: { id: pkg }, data: { closedAt: NOW } }); // archiviato: nessuna scelta automatica
    const appt = await book(h(9), [ids.massaggio, ids.viso]);
    await setDone({ appointmentId: appt, done: true, now: NOW });
    await prisma.appointment.update({ where: { id: appt }, data: { amountCollectedCents: 9000 } }); // sconto di 5 €
    const [item] = await items(appt);
    expect(await setItemPackage({ appointmentId: appt, itemId: item.id, clientPackageId: pkg })).toMatchObject({ ok: false, error: PACKAGE_NOT_AVAILABLE });

    await setPackageArchived(pkg, false, NOW);
    expect(await setItemPackage({ appointmentId: appt, itemId: item.id, clientPackageId: pkg })).toEqual({ ok: true, amountCollectedCents: 4000 });
  });

  it("rifiuta pacchetti di un'altra cliente, di un altro servizio o senza sedute", async () => {
    const annaPkg = await sell({}, ids.anna);
    const visoPkg = await sell({ coverage: { serviceId: ids.viso, categoryId: null } });
    const finished = await sell({ name: "finito", totalSessions: 2, sessionsUsedBefore: 2 });
    const appt = await book(h(9), [ids.massaggio]);
    await setDone({ appointmentId: appt, done: true, now: NOW });
    const [item] = await items(appt);
    for (const clientPackageId of [annaPkg, visoPkg, finished]) {
      expect(await setItemPackage({ appointmentId: appt, itemId: item.id, clientPackageId })).toMatchObject({ ok: false });
    }
  });

  it("non oltre le sedute: due voci, una seduta rimasta", async () => {
    const pkg = await sell({ totalSessions: 5, sessionsUsedBefore: 4 });
    const appt = await book(h(9), [ids.massaggio, ids.drenante]);
    expect(await setDone({ appointmentId: appt, done: true, now: NOW })).toMatchObject({ linkedItems: 1, amountCollectedCents: 6000 });
    const [, second] = await items(appt);
    expect(await setItemPackage({ appointmentId: appt, itemId: second.id, clientPackageId: pkg })).toMatchObject({ ok: false });
    expect(await remaining(pkg)).toBe(0);
  });

  it("due Fatti contemporanei sull'ultima seduta: se ne scala una sola", async () => {
    const pkg = await sell({ totalSessions: 5, sessionsUsedBefore: 4 });
    const a = await book(h(9), [ids.massaggio]);
    const b = await book(h(11), [ids.massaggio]);
    const results = await Promise.all([
      setDone({ appointmentId: a, done: true, now: NOW }),
      setDone({ appointmentId: b, done: true, now: NOW }),
    ]);
    expect(results.map((r) => (r.ok ? r.linkedItems : -1)).sort()).toEqual([0, 1]);
    expect(await prisma.appointmentItem.count({ where: { clientPackageId: pkg } })).toBe(1);
    expect(await remaining(pkg)).toBe(0);
  });
});
