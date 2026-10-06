import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { formatTime, instantAt } from "@/lib/time/rome";
import { SLOT_TAKEN_MESSAGE, createAppointment, isOverlapError } from "./createAppointment";
import { getAvailableDays, getDailySlots, clientLimits, loadSettings } from "./queries";

const NOW = new Date("2026-10-06T08:00:00Z"); // martedì 6 ottobre, 10:00 a Roma
const MON = "2026-10-12";
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

let ids: { client: string; blocked: string; viso: string; peeling: string; hidden: string; hiddenCat: string };

async function reset() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AppointmentItem","Appointment","TimeBlock","DateOverrideSlot","DateOverride","WeeklySlot","Service","ServiceCategory","Client","Settings" CASCADE',
  );
  await prisma.settings.create({ data: { id: 1 } }); // default: griglia 30, arrotondamento 30, pausa 30, preavviso 60, 3 mesi
  await prisma.weeklySlot.createMany({
    data: [
      { weekday: 1, startMinute: h(9), endMinute: h(13) },
      { weekday: 1, startMinute: h(15), endMinute: h(19) },
    ],
  });
  const cat = await prisma.serviceCategory.create({ data: { name: "Viso" } });
  const hiddenCategory = await prisma.serviceCategory.create({ data: { name: "Nascosta", active: false } });
  const viso = await prisma.service.create({ data: { categoryId: cat.id, name: "Pulizia viso", durationMin: 50, priceCents: 4500 } });
  const peeling = await prisma.service.create({ data: { categoryId: cat.id, name: "Peeling", durationMin: 15, priceCents: 2000 } });
  const hidden = await prisma.service.create({ data: { categoryId: cat.id, name: "Nascosto", durationMin: 30, priceCents: 1000, active: false } });
  const hiddenCat = await prisma.service.create({ data: { categoryId: hiddenCategory.id, name: "In categoria nascosta", durationMin: 30, priceCents: 1000 } });
  const client = await prisma.client.create({ data: { firstName: "Maria", lastName: "Rossi", phone: "+39333", email: "maria@test.it" } });
  const blocked = await prisma.client.create({ data: { firstName: "Bea", lastName: "Neri", phone: "+39334", blockedAt: new Date() } });
  ids = { client: client.id, blocked: blocked.id, viso: viso.id, peeling: peeling.id, hidden: hidden.id, hiddenCat: hiddenCat.id };
}

const book = (overrides: Partial<Parameters<typeof createAppointment>[0]> = {}) =>
  createAppointment({
    clientId: ids.client,
    serviceIds: [ids.viso],
    startsAt: instantAt(MON, h(10)),
    actor: "CLIENT",
    now: NOW,
    ...overrides,
  });

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe("createAppointment", () => {
  it("salva appuntamento e copie di nome, durata e prezzo ricalcolati dal database", async () => {
    const result = await book({ serviceIds: [ids.viso, ids.peeling] }); // 50 + 15 = 65 → 90 + pausa 30
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = await prisma.appointment.findUniqueOrThrow({
      where: { id: result.appointmentId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    expect(saved.durationMin).toBe(90);
    expect(saved.bufferMin).toBe(30);
    expect(saved.totalPriceCents).toBe(6500);
    expect(formatTime(saved.startsAt)).toBe("10:00");
    expect(formatTime(saved.endsAt)).toBe("12:00");
    expect(saved.createdBy).toBe("CLIENT");
    expect(saved.items.map((i) => [i.name, i.durationMin, i.priceCents])).toEqual([
      ["Pulizia viso", 50, 4500],
      ["Peeling", 15, 2000],
    ]);

    // Cambiare il listino dopo non tocca l'appuntamento.
    await prisma.service.update({ where: { id: ids.viso }, data: { priceCents: 9900, name: "Nuovo nome" } });
    const item = await prisma.appointmentItem.findFirstOrThrow({ where: { appointmentId: saved.id, sortOrder: 0 } });
    expect([item.name, item.priceCents]).toEqual(["Pulizia viso", 4500]);
  });

  it("due prenotazioni simultanee sullo stesso orario: ne passa una sola", async () => {
    const results = await Promise.all([book(), book()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok && failed.error).toBe(SLOT_TAKEN_MESSAGE);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("cinque prenotazioni simultanee su orari sovrapposti: ne passa una sola", async () => {
    const starts = [h(10), h(10), h(10, 30), h(11), h(9, 30)];
    const results = await Promise.all(starts.map((m) => book({ startsAt: instantAt(MON, m) })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.code === "SLOT_TAKEN")).toBe(true);
  });

  it("la pausa del primo appuntamento blocca l'orario subito dopo, ma non quello dopo la pausa", async () => {
    expect((await book({ startsAt: instantAt(MON, h(9)) })).ok).toBe(true); // 9:00–10:00 + pausa → 10:30
    const tooEarly = await book({ startsAt: instantAt(MON, h(10)) });
    expect(tooEarly.ok || tooEarly.code).toBe("SLOT_TAKEN");
    expect((await book({ startsAt: instantAt(MON, h(10, 30)) })).ok).toBe(true);
  });

  it("orario fuori fascia o fuori griglia: non prenotabile", async () => {
    const outside = await book({ startsAt: instantAt(MON, h(12, 30)) }); // finirebbe alle 13:30
    expect(outside.ok || outside.code).toBe("SLOT_UNAVAILABLE");
    const offGrid = await book({ startsAt: instantAt(MON, h(10, 15)) });
    expect(offGrid.ok || offGrid.code).toBe("SLOT_UNAVAILABLE");
  });

  it("blocco: l'orario non è prenotabile", async () => {
    await prisma.timeBlock.create({ data: { startsAt: instantAt(MON, h(10, 30)), endsAt: instantAt(MON, h(11)) } });
    const result = await book({ startsAt: instantAt(MON, h(10)) });
    expect(result.ok || result.code).toBe("SLOT_UNAVAILABLE");
  });

  it("preavviso minimo: la cliente no, l'admin sì", async () => {
    const soon = instantAt("2026-10-06", h(10, 30)); // martedì: aggiungo la fascia del martedì
    await prisma.weeklySlot.create({ data: { weekday: 2, startMinute: h(9), endMinute: h(13) } });
    const asClient = await book({ startsAt: soon });
    expect(asClient.ok || asClient.code).toBe("SLOT_UNAVAILABLE");
    expect((await book({ startsAt: soon, actor: "ADMIN" })).ok).toBe(true);
  });

  it("cliente: rifiuta lista vuota, duplicati, servizi nascosti e categorie nascoste", async () => {
    for (const serviceIds of [[], [ids.viso, ids.viso], [ids.hidden], [ids.hiddenCat], ["inesistente"]]) {
      const result = await book({ serviceIds });
      expect(result.ok || result.code).toBe("INVALID");
    }
    expect(await prisma.appointment.count()).toBe(0);
  });

  it("admin: può usare un servizio nascosto e una pausa diversa", async () => {
    const result = await book({ actor: "ADMIN", serviceIds: [ids.hidden], bufferOverride: 0 });
    expect(result.ok).toBe(true);
    const saved = await prisma.appointment.findFirstOrThrow();
    expect([saved.bufferMin, formatTime(saved.endsAt), saved.createdBy]).toEqual([0, "10:30", "ADMIN"]);
  });

  it("la pausa personalizzata è solo per l'admin; cliente bloccata non prenota", async () => {
    expect((await book({ bufferOverride: 0 })).ok).toBe(false);
    expect((await book({ clientId: ids.blocked })).ok).toBe(false);
  });
});

describe("vincolo EXCLUDE nel database", () => {
  it("due inserimenti diretti simultanei (senza lock): uno fallisce con 23P01, riconosciuto", async () => {
    const insert = () =>
      prisma.appointment.create({
        data: {
          clientId: ids.client,
          startsAt: instantAt(MON, h(10)),
          endsAt: instantAt(MON, h(11, 30)),
          durationMin: 60,
          bufferMin: 30,
          totalPriceCents: 4500,
          createdBy: "ADMIN",
        },
      });
    const results = await Promise.allSettled([insert(), insert()]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(isOverlapError((rejected[0] as PromiseRejectedResult).reason)).toBe(true);
  });

  it("gli appuntamenti cancellati e 'non presentata' non occupano il calendario", async () => {
    const first = await book();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await prisma.appointment.update({ where: { id: first.appointmentId }, data: { status: "NO_SHOW" } });
    expect((await book()).ok).toBe(true);
  });
});

describe("query della disponibilità", () => {
  it("giorni liberi su 3 mesi con poche query, e orari giorno per giorno", async () => {
    const settings = await loadSettings();
    const query = { durationMin: 60, bufferMin: 30, gridMin: 30, limits: clientLimits(settings, NOW) };

    // Lunedì 12 pieno: occupo entrambe le fasce con blocchi
    await prisma.timeBlock.createMany({
      data: [
        { startsAt: instantAt(MON, h(9)), endsAt: instantAt(MON, h(13)) },
        { startsAt: instantAt(MON, h(15)), endsAt: instantAt(MON, h(19)) },
      ],
    });

    let queries = 0;
    const counting = prisma.$extends({ query: { $allOperations: ({ args, query: run }) => (queries++, run(args)) } });
    const days = await getAvailableDays("2026-10-06", "2027-01-06", query, counting as unknown as typeof prisma);
    expect(queries).toBeLessThanOrEqual(4);
    expect(days).not.toContain(MON);
    expect(days).toContain("2026-10-19");
    expect(days.every((d) => d <= "2027-01-06")).toBe(true);
    expect(days).toHaveLength(12); // tutti i lunedì dal 19/10 al 4/1

    const daily = await getDailySlots("2026-10-19", 1, query);
    expect(daily[0].slots.map(formatTime)).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
      "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
    ]);
  });
});

describe("limiti anti-abuso (solo clienti)", () => {
  const slots = [
    ["2026-10-12", h(9)],
    ["2026-10-12", h(15)],
    ["2026-10-19", h(9)],
    ["2026-10-19", h(15)],
    ["2026-10-26", h(9)],
  ] as const;

  it("al massimo 4 prenotazioni online in 24 ore, anche se annullate; l'admin non ha limiti", async () => {
    for (const [day, minute] of slots.slice(0, 4)) {
      expect((await book({ startsAt: instantAt(day, minute) })).ok).toBe(true);
    }
    await prisma.appointment.updateMany({ data: { status: "CANCELLED" } }); // annullarle non azzera il conteggio
    const fifth = await book({ startsAt: instantAt(slots[4][0], slots[4][1]) });
    expect(fifth).toMatchObject({ ok: false, code: "LIMIT", limit: "limite-giorno" });
    expect((await book({ startsAt: instantAt(slots[4][0], slots[4][1]), actor: "ADMIN" })).ok).toBe(true);
  });

  it("al massimo 6 appuntamenti confermati in programma", async () => {
    for (let i = 0; i < 6; i++) {
      const startsAt = instantAt("2026-11-02", h(9) + i * 60);
      await prisma.appointment.create({
        data: { clientId: ids.client, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), durationMin: 30, bufferMin: 0, totalPriceCents: 0, createdBy: "ADMIN" },
      });
    }
    expect(await book()).toMatchObject({ ok: false, code: "LIMIT", limit: "limite-futuri" });
    await prisma.appointment.updateMany({ where: { startsAt: instantAt("2026-11-02", h(9)) }, data: { status: "CANCELLED" } });
    expect((await book()).ok).toBe(true);
  });
});
