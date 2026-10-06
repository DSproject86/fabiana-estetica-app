import { createECDH } from "node:crypto";
import webpush from "web-push";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { instantAt } from "@/lib/time/rome";
import type { VapidConfig } from "./config";
import { EXPIRED_MESSAGE, NOT_CONFIGURED_MESSAGE, pushNewBookingToAdmins, type PushTarget, type PushTransport } from "./deliver";
import { TOO_MANY_DEVICES, listDevices, removeDevice, saveDevice, sendTestToDevice } from "./devices";
import { MAX_DEVICES_PER_ADMIN } from "./subscription";

// Chiavi di prova create al momento: mai quelle di produzione in questo ambiente.
const testKeys = webpush.generateVAPIDKeys();
const VAPID: VapidConfig = { publicKey: testKeys.publicKey, privateKey: testKeys.privateKey, subject: "mailto:test@example.com" };

const keys = { p256dh: createECDH("prime256v1").generateKeys().toString("base64url"), auth: Buffer.alloc(16, 7).toString("base64url") };
const sub = (n: string) => ({ endpoint: `https://web.push.apple.com/device-${n}`, keys });

/** Invio simulato: registra cosa avrebbe mandato e risponde con il codice deciso per quel dispositivo. */
function fakeTransport(failures: Record<string, number> = {}) {
  const sent: { endpoint: string; body: Record<string, string> }[] = [];
  const transport: PushTransport = async (target: PushTarget, body: string) => {
    const code = Object.entries(failures).find(([suffix]) => target.endpoint.endsWith(suffix))?.[1];
    if (code) throw Object.assign(new Error(`Received unexpected response code ${code}`), { statusCode: code });
    sent.push({ endpoint: target.endpoint, body: JSON.parse(body) });
    return { statusCode: 201 };
  };
  return { transport, sent };
}

let ids: { fabiana: string; marco: string; client: string; service: string };

async function reset() {
  await prisma.$executeRawUnsafe('TRUNCATE "NotificationLog","PushSubscription","AppointmentItem","Appointment","Service","ServiceCategory","Client","Admin" CASCADE');
  const fabiana = await prisma.admin.create({ data: { email: "fabiana@test.it", name: "Fabiana", passwordHash: "x" } });
  const marco = await prisma.admin.create({ data: { email: "marco@test.it", name: "Marco", passwordHash: "x", notifyNewBooking: false } });
  const cat = await prisma.serviceCategory.create({ data: { name: "Viso" } });
  const service = await prisma.service.create({ data: { categoryId: cat.id, name: "Pulizia viso", durationMin: 50, priceCents: 4500 } });
  const client = await prisma.client.create({ data: { firstName: "Giulia", lastName: "Bianchi", phone: "+393331112222", email: "giulia@test.it" } });
  ids = { fabiana: fabiana.id, marco: marco.id, client: client.id, service: service.id };
}

async function booking(createdBy: "CLIENT" | "ADMIN" = "CLIENT") {
  const startsAt = instantAt("2026-10-14", 10 * 60 + 30);
  const a = await prisma.appointment.create({
    data: {
      clientId: ids.client,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 90 * 60_000),
      durationMin: 60,
      bufferMin: 30,
      totalPriceCents: 4500,
      createdBy,
      items: { create: { serviceId: ids.service, name: "Pulizia viso", durationMin: 50, priceCents: 4500 } },
    },
  });
  return a.id;
}

const logs = () => prisma.notificationLog.findMany({ where: { channel: "PUSH" }, orderBy: { createdAt: "asc" } });

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe("notifica di nuova prenotazione", () => {
  it("a tutti i dispositivi degli admin con l'avviso acceso, con testo e link giusti", async () => {
    await saveDevice(ids.fabiana, sub("iphone"), "iPhone di Fabiana", "UA");
    await saveDevice(ids.fabiana, sub("mac"), "Mac di Fabiana", "UA");
    await saveDevice(ids.marco, sub("android"), "Android di Marco", "UA"); // avviso spento
    const id = await booking();
    const { transport, sent } = fakeTransport();

    const results = await pushNewBookingToAdmins(id, { transport, vapid: VAPID });
    expect(results.map((r) => r.status)).toEqual(["SENT", "SENT"]);
    expect(sent.map((s) => s.endpoint)).toEqual([sub("iphone").endpoint, sub("mac").endpoint]);
    expect(sent[0].body).toEqual({
      title: "Nuova prenotazione",
      body: "Giulia Bianchi · mer 14 ott 10:30 · Pulizia viso",
      url: "/admin/agenda?mese=2026-10#giorno-2026-10-14",
      tag: `prenotazione-${id}`,
    });

    const rows = await logs();
    expect(rows.map((r) => [r.status, r.recipient, r.kind, r.appointmentId])).toEqual([
      ["SENT", "fabiana@test.it · iPhone di Fabiana", "ADMIN_NEW_BOOKING", id],
      ["SENT", "fabiana@test.it · Mac di Fabiana", "ADMIN_NEW_BOOKING", id],
    ]);
    expect((await listDevices(ids.fabiana)).every((d) => d.lastUsedAt)).toBe(true);
  });

  it("niente per gli appuntamenti inseriti dagli admin", async () => {
    await saveDevice(ids.fabiana, sub("iphone"), "iPhone di Fabiana", "UA");
    const { transport, sent } = fakeTransport();
    expect(await pushNewBookingToAdmins(await booking("ADMIN"), { transport, vapid: VAPID })).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("abbonamenti scaduti (404/410) eliminati; altri errori registrati senza eliminare", async () => {
    await saveDevice(ids.fabiana, sub("ok"), "Telefono nuovo", "UA");
    await saveDevice(ids.fabiana, sub("gone"), "Telefono vecchio", "UA");
    await saveDevice(ids.fabiana, sub("missing"), "Tablet perso", "UA");
    await saveDevice(ids.fabiana, sub("down"), "Computer", "UA");
    const { transport, sent } = fakeTransport({ gone: 410, missing: 404, down: 500 });

    const results = await pushNewBookingToAdmins(await booking(), { transport, vapid: VAPID });
    expect(results.map((r) => [r.status, r.expired ?? false])).toEqual([
      ["SENT", false],
      ["FAILED", true],
      ["FAILED", true],
      ["FAILED", false],
    ]);
    expect(sent).toHaveLength(1);
    expect((await listDevices(ids.fabiana)).map((d) => d.deviceName)).toEqual(["Telefono nuovo", "Computer"]);
    const rows = await logs();
    expect(rows.filter((r) => r.error === EXPIRED_MESSAGE)).toHaveLength(2);
    expect(rows.find((r) => r.recipient.endsWith("Computer"))?.error).toContain("500");
  });

  it("senza chiavi VAPID: niente invio, registro 'non inviata'", async () => {
    await saveDevice(ids.fabiana, sub("iphone"), "iPhone di Fabiana", "UA");
    const { transport, sent } = fakeTransport();
    const results = await pushNewBookingToAdmins(await booking(), { transport, vapid: null });
    expect(results).toEqual([expect.objectContaining({ status: "SKIPPED" })]);
    expect(sent).toEqual([]);
    expect((await logs())[0]).toMatchObject({ status: "SKIPPED", error: NOT_CONFIGURED_MESSAGE });
  });

  it("un errore imprevisto non lancia mai (la prenotazione non ne risente)", async () => {
    await saveDevice(ids.fabiana, sub("iphone"), "iPhone di Fabiana", "UA");
    const broken: PushTransport = () => {
      throw new Error("rete giù");
    };
    await expect(pushNewBookingToAdmins(await booking(), { transport: broken, vapid: VAPID })).resolves.toEqual([
      expect.objectContaining({ status: "FAILED", expired: false }),
    ]);
    await expect(pushNewBookingToAdmins("inesistente", { transport: broken, vapid: VAPID })).resolves.toEqual([]);
  });
});

describe("dispositivi", () => {
  it("riattivare lo stesso browser aggiorna invece di duplicare; un telefono condiviso passa all'admin collegato", async () => {
    await saveDevice(ids.fabiana, sub("shared"), "iPhone di Fabiana", "UA");
    await saveDevice(ids.fabiana, sub("shared"), "iPhone (rinominato)", "UA");
    expect((await listDevices(ids.fabiana)).map((d) => d.deviceName)).toEqual(["iPhone (rinominato)"]);
    await saveDevice(ids.marco, sub("shared"), "iPhone di Marco", "UA");
    expect(await listDevices(ids.fabiana)).toEqual([]);
    expect((await listDevices(ids.marco)).map((d) => d.deviceName)).toEqual(["iPhone di Marco"]);
  });

  it(`al massimo ${MAX_DEVICES_PER_ADMIN} dispositivi per admin`, async () => {
    for (let i = 0; i < MAX_DEVICES_PER_ADMIN; i++) expect((await saveDevice(ids.fabiana, sub(`d${i}`), `D${i}`, null)).ok).toBe(true);
    expect(await saveDevice(ids.fabiana, sub("extra"), "Extra", null)).toEqual({ ok: false, error: TOO_MANY_DEVICES });
    expect((await saveDevice(ids.fabiana, sub("d0"), "D0 rinominato", null)).ok).toBe(true); // aggiornare si può sempre
  });

  it("si rimuovono e si provano solo i propri dispositivi", async () => {
    await saveDevice(ids.fabiana, sub("f"), "iPhone di Fabiana", null);
    const [device] = await listDevices(ids.fabiana);
    expect(await removeDevice(ids.marco, { id: device.id })).toBe(false);
    const { transport, sent } = fakeTransport();
    expect(await sendTestToDevice(ids.marco, sub("f").endpoint, { transport, vapid: VAPID })).toBeNull();
    expect(await sendTestToDevice(ids.fabiana, sub("f").endpoint, { transport, vapid: VAPID })).toMatchObject({ status: "SENT" });
    expect(sent[0].body.title).toBe("Notifica di prova");
    expect((await logs())[0].isTest).toBe(true);
    expect(await removeDevice(ids.fabiana, { id: device.id })).toBe(true);
  });
});
