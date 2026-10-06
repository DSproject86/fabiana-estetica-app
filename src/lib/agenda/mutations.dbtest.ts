import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OUTSIDE_HOURS_MESSAGE } from "@/lib/availability/createAppointment";
import { prisma } from "@/lib/db";
import { formatTime, instantAt } from "@/lib/time/rome";
import { loadMonthReport } from "@/lib/stats/queries";
import {
  CANCEL_NOT_ALLOWED,
  CONFIRM_DONE_CANCEL,
  NOT_EDITABLE,
  RESTORE_TAKEN,
  TOO_EARLY,
  cancelAppointment,
  createAdminAppointment,
  rescheduleAppointment,
  setAmountCollected,
  setDone,
  setNoShow,
  updateAppointmentServices,
} from "./mutations";
import { loadUnmarkedPast } from "./queries";

const NOW = new Date("2026-10-06T08:00:00Z"); // martedì 6 ottobre, 10:00 a Roma
const MON = "2026-10-12";
const MON2 = "2026-10-19";
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

let ids: { maria: string; giulia: string; viso: string; peeling: string; massaggio: string };

async function reset() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog","PackagePayment","AppointmentItem","ClientPackage","Appointment","TimeBlock","DateOverrideSlot","DateOverride","WeeklySlot","Service","ServiceCategory","Client","Settings" CASCADE',
  );
  await prisma.settings.create({ data: { id: 1 } }); // griglia 30, arrotondamento 30, pausa 30
  await prisma.weeklySlot.createMany({
    data: [1, 2].flatMap((weekday) => [
      { weekday, startMinute: h(9), endMinute: h(13) },
      { weekday, startMinute: h(15), endMinute: h(19) },
    ]),
  });
  const cat = await prisma.serviceCategory.create({ data: { name: "Viso" } });
  const viso = await prisma.service.create({ data: { categoryId: cat.id, name: "Pulizia viso", durationMin: 50, priceCents: 4500 } });
  const peeling = await prisma.service.create({ data: { categoryId: cat.id, name: "Peeling", durationMin: 15, priceCents: 2000 } });
  const massaggio = await prisma.service.create({ data: { categoryId: cat.id, name: "Massaggio", durationMin: 60, priceCents: 5000, active: false } });
  const maria = await prisma.client.create({ data: { firstName: "Maria", lastName: "Rossi", phone: "+393331112222", email: "maria@test.it" } });
  const giulia = await prisma.client.create({ data: { firstName: "Giulia", lastName: "Bianchi", phone: "+393334445555" } });
  ids = { maria: maria.id, giulia: giulia.id, viso: viso.id, peeling: peeling.id, massaggio: massaggio.id };
}

async function book(day: string, minute: number, extra: Partial<Parameters<typeof createAdminAppointment>[0]> = {}) {
  const result = await createAdminAppointment({
    clientId: ids.maria,
    serviceIds: [ids.viso],
    startsAt: instantAt(day, minute),
    noBuffer: false,
    ignoreWorkingHours: false,
    now: NOW,
    ...extra,
  });
  if (!result.ok) throw new Error(result.error);
  return result.appointmentId;
}

const get = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe("nuovo appuntamento da admin", () => {
  it("niente preavviso: si può inserire anche per oggi o nel passato", async () => {
    const today = await book("2026-10-06", h(9), { now: NOW }); // 09:00, prima di adesso (10:00)
    expect((await get(today)).createdBy).toBe("ADMIN");
  });

  it("fuori orario: rifiutato senza l'opzione, accettato con l'opzione, sovrapposizioni sempre vietate", async () => {
    const at20 = instantAt(MON, h(20));
    const refused = await createAdminAppointment({ clientId: ids.maria, serviceIds: [ids.viso], startsAt: at20, noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(refused).toMatchObject({ ok: false, error: OUTSIDE_HOURS_MESSAGE });

    const id = await book(MON, h(20), { ignoreWorkingHours: true });
    expect(formatTime((await get(id)).startsAt)).toBe("20:00");

    const overlap = await createAdminAppointment({
      clientId: ids.giulia,
      serviceIds: [ids.peeling],
      startsAt: instantAt(MON, h(20, 45)),
      noBuffer: false,
      ignoreWorkingHours: true,
      now: NOW,
    });
    expect(overlap.ok).toBe(false);
    expect(!overlap.ok && overlap.error).toContain("Maria Rossi");
  });

  it("orario scritto a mano solo a passi di 5 minuti", async () => {
    const odd = await createAdminAppointment({
      clientId: ids.maria,
      serviceIds: [ids.viso],
      startsAt: instantAt(MON, h(20, 3)),
      noBuffer: false,
      ignoreWorkingHours: true,
      now: NOW,
    });
    expect(odd.ok).toBe(false);
  });

  it("'Senza pausa' salva bufferMin 0 e lascia libero l'orario subito dopo", async () => {
    const id = await book(MON, h(9), { noBuffer: true }); // 9:00–10:00, nessuna pausa
    expect((await get(id)).bufferMin).toBe(0);
    await book(MON, h(10), { clientId: ids.giulia });
  });

  it("anche i servizi nascosti alle clienti", async () => {
    const id = await book(MON, h(9), { serviceIds: [ids.massaggio] });
    expect((await get(id)).items[0].name).toBe("Massaggio");
  });
});

describe("sposta", () => {
  it("di 30 minuti dentro il proprio vecchio intervallo: il motore esclude l'appuntamento stesso", async () => {
    const id = await book(MON, h(9)); // 9:00–10:00 + pausa → occupa fino alle 10:30
    const result = await rescheduleAppointment({ appointmentId: id, startsAt: instantAt(MON, h(9, 30)), noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(result).toMatchObject({ ok: true, changed: true, dayChanged: false });
    const saved = await get(id);
    expect([formatTime(saved.startsAt), formatTime(saved.endsAt)]).toEqual(["09:30", "11:00"]);
  });

  it("sopra un altro appuntamento: messaggio leggibile con nome e orario", async () => {
    const a = await book(MON, h(9));
    await book(MON, h(11), { clientId: ids.giulia });
    const result = await rescheduleAppointment({ appointmentId: a, startsAt: instantAt(MON, h(11)), noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Giulia Bianchi.*11:00–12:00/);
  });

  it("cambiando giorno azzera promemoria email e spunta WhatsApp; nello stesso giorno no", async () => {
    const id = await book(MON, h(9));
    const sent = new Date("2026-10-11T16:00:00Z");
    await prisma.appointment.update({ where: { id }, data: { reminderEmailSentAt: sent, whatsappSentAt: sent } });

    await rescheduleAppointment({ appointmentId: id, startsAt: instantAt(MON, h(15)), noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect((await get(id)).reminderEmailSentAt).toEqual(sent);

    const moved = await rescheduleAppointment({ appointmentId: id, startsAt: instantAt(MON2, h(10)), noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(moved).toMatchObject({ ok: true, dayChanged: true });
    const saved = await get(id);
    expect(saved.reminderEmailSentAt).toBeNull();
    expect(saved.whatsappSentAt).toBeNull();
  });

  it("'Senza pausa' su un appuntamento che l'aveva: poi togliendola torna la pausa di default", async () => {
    const id = await book(MON, h(9));
    await rescheduleAppointment({ appointmentId: id, startsAt: instantAt(MON, h(9)), noBuffer: true, ignoreWorkingHours: false, now: NOW });
    expect((await get(id)).bufferMin).toBe(0);
    await rescheduleAppointment({ appointmentId: id, startsAt: instantAt(MON, h(9)), noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect((await get(id)).bufferMin).toBe(30);
  });

  it("due spostamenti simultanei sullo stesso orario: ne passa uno solo", async () => {
    const a = await book(MON, h(9));
    const b = await book(MON2, h(9), { clientId: ids.giulia });
    const target = instantAt(MON, h(15));
    const results = await Promise.all([
      rescheduleAppointment({ appointmentId: a, startsAt: target, noBuffer: false, ignoreWorkingHours: false, now: NOW }),
      rescheduleAppointment({ appointmentId: b, startsAt: target, noBuffer: false, ignoreWorkingHours: false, now: NOW }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.appointment.count({ where: { startsAt: target } })).toBe(1);
  });

  it("un appuntamento Fatto non si sposta", async () => {
    const id = await book("2026-10-06", h(9));
    await setDone({ appointmentId: id, done: true, now: NOW });
    const result = await rescheduleAppointment({ appointmentId: id, startsAt: instantAt(MON, h(9)), noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(result).toEqual({ ok: false, error: NOT_EDITABLE });
  });
});

describe("modifica servizi", () => {
  it("ricalcola durata e prezzo; le voci tenute conservano prezzo e pacchetto", async () => {
    const id = await book(MON, h(9)); // Pulizia viso 50' → 60'
    const appt = await get(id);
    const pkg = await prisma.clientPackage.create({ data: { clientId: ids.maria, name: "10 viso", priceCents: 40000, totalSessions: 10 } });
    await prisma.appointmentItem.update({ where: { id: appt.items[0].id }, data: { priceCents: 4000, clientPackageId: pkg.id } });
    await prisma.service.update({ where: { id: ids.viso }, data: { priceCents: 9900 } });

    const result = await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.viso, ids.peeling], noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(result).toMatchObject({ ok: true, durationMin: 90, totalPriceCents: 6000 });
    const saved = await get(id);
    expect(saved.items.map((i) => [i.name, i.priceCents, i.clientPackageId])).toEqual([
      ["Pulizia viso", 4000, pkg.id],
      ["Peeling", 2000, null],
    ]);
    expect([formatTime(saved.startsAt), formatTime(saved.endsAt)]).toEqual(["09:00", "11:00"]);
  });

  it("ricontrolla la disponibilità escludendo se stesso: no se tocca l'appuntamento dopo", async () => {
    const id = await book(MON, h(9)); // occupa 9:00–10:30
    await book(MON, h(10, 30), { clientId: ids.giulia });
    const longer = await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.viso, ids.peeling], noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(longer.ok).toBe(false);
    expect(!longer.ok && longer.error).toContain("Giulia Bianchi");
    // Con "Senza pausa" 9:00–10:30 sta giusto prima di Giulia.
    const tight = await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.viso, ids.peeling], noBuffer: true, ignoreWorkingHours: false, now: NOW });
    expect(tight.ok).toBe(true);
  });

  it("oltre la chiusura serve 'Fuori orario'", async () => {
    const id = await book(MON, h(12)); // 12:00–13:00
    const refused = await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.viso, ids.peeling], noBuffer: false, ignoreWorkingHours: false, now: NOW });
    expect(refused.ok).toBe(false);
    const forced = await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.viso, ids.peeling], noBuffer: false, ignoreWorkingHours: true, now: NOW });
    expect(forced.ok).toBe(true);
  });

  it("almeno un servizio", async () => {
    const id = await book(MON, h(9));
    expect(await updateAppointmentServices({ appointmentId: id, serviceIds: [], noBuffer: false, ignoreWorkingHours: false, now: NOW })).toMatchObject({ ok: false });
  });
});

describe("annulla", () => {
  it("CANCELLED da ADMIN e l'orario torna libero", async () => {
    const id = await book(MON, h(9));
    expect(await cancelAppointment({ appointmentId: id, now: NOW })).toMatchObject({ ok: true });
    const saved = await get(id);
    expect([saved.status, saved.cancelledBy]).toEqual(["CANCELLED", "ADMIN"]);
    expect(saved.cancelledAt).toEqual(NOW);
    await book(MON, h(9), { clientId: ids.giulia });
    expect((await cancelAppointment({ appointmentId: id, now: NOW })).ok).toBe(false); // già annullato
  });
});

describe("annulla un appuntamento Fatto", () => {
  it("senza conferma non succede niente; con conferma azzera Fatto e importo e lo annulla insieme", async () => {
    const id = await book("2026-10-06", h(9));
    await setDone({ appointmentId: id, done: true, now: NOW });
    await setAmountCollected({ appointmentId: id, cents: 4000 });
    expect((await loadMonthReport("2026-10", NOW)).current.appointmentsCents).toBe(4000);

    expect(await cancelAppointment({ appointmentId: id, now: NOW })).toEqual({ ok: false, error: CONFIRM_DONE_CANCEL });
    const untouched = await get(id);
    expect([untouched.status, untouched.amountCollectedCents]).toEqual(["CONFIRMED", 4000]);

    expect(await cancelAppointment({ appointmentId: id, confirmDone: true, now: NOW })).toMatchObject({ ok: true, removedAmountCents: 4000 });
    const saved = await get(id);
    expect([saved.status, saved.cancelledBy, saved.doneAt, saved.amountCollectedCents]).toEqual(["CANCELLED", "ADMIN", null, null]);

    const report = await loadMonthReport("2026-10", NOW);
    expect(report.current.appointmentsCents).toBe(0);
    expect(report.current.counts).toMatchObject({ done: 0, cancelled: 1 });
  });

  it("su un appuntamento non Fatto la conferma non serve (e non cambia niente se data)", async () => {
    const id = await book(MON, h(9));
    expect(await cancelAppointment({ appointmentId: id, confirmDone: true, now: NOW })).toMatchObject({ ok: true, removedAmountCents: null });
  });

  it("una Non presentata va prima ripristinata", async () => {
    const id = await book("2026-10-06", h(9));
    await setNoShow({ appointmentId: id, noShow: true, now: NOW });
    expect(await cancelAppointment({ appointmentId: id, confirmDone: true, now: NOW })).toEqual({ ok: false, error: CANCEL_NOT_ALLOWED });
  });

  it("Sposta e Servizi restano bloccati finché c'è la spunta", async () => {
    const id = await book("2026-10-06", h(9));
    await setDone({ appointmentId: id, done: true, now: NOW });
    expect(await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.peeling], noBuffer: false, ignoreWorkingHours: false, now: NOW })).toEqual({ ok: false, error: NOT_EDITABLE });
    await setDone({ appointmentId: id, done: false, now: NOW });
    expect((await updateAppointmentServices({ appointmentId: id, serviceIds: [ids.peeling], noBuffer: false, ignoreWorkingHours: false, now: NOW })).ok).toBe(true);
  });
});

describe("Fatto e importo", () => {
  it("precompila il totale senza le voci da pacchetto; reversibile; importo modificabile", async () => {
    const id = await book("2026-10-06", h(9), { serviceIds: [ids.viso, ids.peeling] }); // 45 + 20
    const appt = await get(id);
    const pkg = await prisma.clientPackage.create({ data: { clientId: ids.maria, name: "Peeling x5", priceCents: 8000, totalSessions: 5 } });
    await prisma.appointmentItem.update({ where: { id: appt.items[1].id }, data: { clientPackageId: pkg.id } });

    expect(await setDone({ appointmentId: id, done: true, now: NOW })).toEqual({ ok: true, amountCollectedCents: 4500 });
    expect(await setDone({ appointmentId: id, done: true, now: NOW })).toEqual({ ok: true, amountCollectedCents: 4500 }); // doppio tocco
    expect(await setAmountCollected({ appointmentId: id, cents: 4000 })).toEqual({ ok: true });
    expect((await get(id)).amountCollectedCents).toBe(4000);

    expect(await setDone({ appointmentId: id, done: false, now: NOW })).toMatchObject({ ok: true });
    const undone = await get(id);
    expect([undone.doneAt, undone.amountCollectedCents]).toEqual([null, null]);
    expect((await setAmountCollected({ appointmentId: id, cents: 100 })).ok).toBe(false);
  });

  it("non prima del giorno dell'appuntamento", async () => {
    const id = await book(MON, h(9));
    expect(await setDone({ appointmentId: id, done: true, now: NOW })).toEqual({ ok: false, error: TOO_EARLY });
  });
});

describe("Non presentata", () => {
  it("reversibile se l'orario è ancora libero", async () => {
    const id = await book("2026-10-06", h(9));
    expect(await setNoShow({ appointmentId: id, noShow: true, now: NOW })).toEqual({ ok: true });
    expect((await get(id)).status).toBe("NO_SHOW");
    expect(await setNoShow({ appointmentId: id, noShow: false, now: NOW })).toEqual({ ok: true });
    expect((await get(id)).status).toBe("CONFIRMED");
  });

  it("non si ripristina se nel frattempo l'orario è stato occupato", async () => {
    const id = await book("2026-10-06", h(9));
    await setNoShow({ appointmentId: id, noShow: true, now: NOW });
    await book("2026-10-06", h(9), { clientId: ids.giulia });
    expect(await setNoShow({ appointmentId: id, noShow: false, now: NOW })).toEqual({ ok: false, error: RESTORE_TAKEN });
    expect((await get(id)).status).toBe("NO_SHOW");
  });

  it("un Fatto va prima tolto", async () => {
    const id = await book("2026-10-06", h(9));
    await setDone({ appointmentId: id, done: true, now: NOW });
    expect((await setNoShow({ appointmentId: id, noShow: true, now: NOW })).ok).toBe(false);
  });
});

describe("passati non segnati", () => {
  it("contano solo i confermati finiti, né Fatti né Non presentata", async () => {
    const at9 = await book("2026-10-05", h(9)); // lunedì passato
    const at11 = await book("2026-10-05", h(11), { clientId: ids.giulia });
    const at15 = await book("2026-10-05", h(15));
    await book("2026-10-06", h(9, 30)); // oggi 9:30–10:30: non ancora finito alle 10:00
    await setDone({ appointmentId: at9, done: true, now: NOW });
    await setNoShow({ appointmentId: at11, noShow: true, now: NOW });
    const result = await loadUnmarkedPast(NOW);
    expect(result).toEqual({ count: 1, days: ["2026-10-05"] });
    await setDone({ appointmentId: at15, done: true, now: NOW });
    expect((await loadUnmarkedPast(NOW)).count).toBe(0);
  });
});
