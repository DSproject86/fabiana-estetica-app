import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { EmailMessage, SendResult } from "@/lib/email/send";
import { instantAt } from "@/lib/time/rome";

// Nessuna email vera: il "fornitore" registra i messaggi e può rallentare o fallire a comando.
const outbox: EmailMessage[] = [];
let behaviour: { delayMs: number; fail: string | null; delayFirstMs?: number } = { delayMs: 0, fail: null };
vi.mock("@/lib/email/send", () => ({
  replyToAddress: () => "fabiana@example.it",
  sendEmail: async (message: EmailMessage): Promise<SendResult> => {
    const first = outbox.length === 0;
    outbox.push(message);
    const wait = first && behaviour.delayFirstMs !== undefined ? behaviour.delayFirstMs : behaviour.delayMs;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    return behaviour.fail
      ? { ok: false, provider: "resend", error: behaviour.fail }
      : { ok: true, provider: "resend", providerMessageId: `msg-${outbox.length}` };
  },
}));

const { runReminders, retryReminder } = await import("./reminders");

// Martedì 13 ottobre 2026: promemoria per mercoledì 14.
const TODAY = "2026-10-13";
const TOMORROW = "2026-10-14";
const at = (day: string, h: number, m = 0) => instantAt(day, h * 60 + m);
const EVENING = at(TODAY, 18, 30);

let serviceId: string;

async function reset() {
  outbox.length = 0;
  behaviour = { delayMs: 0, fail: null };
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog","AppointmentItem","Appointment","Client","Service","ServiceCategory","Settings","MessageTemplate" CASCADE',
  );
  await prisma.settings.create({ data: { id: 1 } }); // reminderHour 18
  const category = await prisma.serviceCategory.create({ data: { name: "Viso" } });
  serviceId = (await prisma.service.create({ data: { categoryId: category.id, name: "Pulizia viso", durationMin: 60, priceCents: 4500 } })).id;
}

let seq = 0;
async function appointment({
  day = TOMORROW,
  hour = 10,
  email = `cliente${++seq}@test.it` as string | null,
  createdAt = at("2026-10-01", 12),
  status = "CONFIRMED" as "CONFIRMED" | "CANCELLED",
} = {}) {
  const client = await prisma.client.create({
    data: { firstName: `Cliente${seq}`, lastName: "Test", phone: `+39333000${String(seq).padStart(4, "0")}`, email },
  });
  const startsAt = at(day, hour);
  return prisma.appointment.create({
    data: {
      clientId: client.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 90 * 60_000),
      durationMin: 60,
      bufferMin: 30,
      totalPriceCents: 4500,
      createdBy: "CLIENT",
      status,
      createdAt,
      items: { create: [{ serviceId, name: "Pulizia viso", durationMin: 60, priceCents: 4500 }] },
    },
  });
}

const reminderLogs = () => prisma.notificationLog.findMany({ where: { kind: "REMINDER" }, orderBy: { createdAt: "asc" } });

beforeEach(reset);
afterAll(() => prisma.$disconnect());

describe("promemoria del giorno prima", () => {
  it("manda un'email per ogni appuntamento confermato di domani e la registra come SENT", async () => {
    const a = await appointment({ hour: 10 });
    const b = await appointment({ hour: 15 });
    await appointment({ day: "2026-10-15" }); // dopodomani
    await appointment({ day: TODAY, hour: 20 }); // oggi
    await appointment({ status: "CANCELLED", hour: 12 });

    const summary = await runReminders({ now: EVENING });
    expect(summary).toMatchObject({ day: TOMORROW, windowOpen: true, sent: 2, failed: 0, remaining: 0, stoppedEarly: false });
    expect(outbox.map((m) => m.to).sort()).toEqual(
      (await prisma.client.findMany({ where: { appointments: { some: { id: { in: [a.id, b.id] } } } } })).map((c) => c.email).sort(),
    );
    expect(outbox[0].subject).toBe("Promemoria: domani alle 10:00");
    expect(outbox[0].html).toContain("Il tuo appuntamento di domani");
    expect(outbox[0].text).toContain("Ora: 10:00");

    const logs = await reminderLogs();
    expect(logs.map((l) => l.status)).toEqual(["SENT", "SENT"]);
    expect(logs.every((l) => l.sentAt && l.providerMessageId)).toBe(true);
    const marked = await prisma.appointment.findMany({ where: { reminderEmailSentAt: { not: null } } });
    expect(marked.map((m) => m.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("chiamato due volte di fila: una sola email", async () => {
    await appointment();
    await runReminders({ now: EVENING });
    const second = await runReminders({ now: at(TODAY, 19, 30) });
    expect(second.sent).toBe(0);
    expect(outbox).toHaveLength(1);
    expect(await reminderLogs()).toHaveLength(1);
  });

  it("chiamato due volte in parallelo: una sola email per appuntamento", async () => {
    for (let i = 0; i < 4; i++) await appointment({ hour: 9 + i * 2 });
    behaviour.delayMs = 40; // invii lenti: le due chiamate si sovrappongono davvero

    const [one, two] = await Promise.all([runReminders({ now: EVENING }), runReminders({ now: EVENING })]);
    expect(one.sent + two.sent).toBe(4);
    expect(outbox).toHaveLength(4);
    expect(new Set(outbox.map((m) => m.to)).size).toBe(4);
    expect(await reminderLogs()).toHaveLength(4);
  });

  it("rispetta l'ora del promemoria (Settings.reminderHour, ora di Roma)", async () => {
    await appointment();
    expect(await runReminders({ now: at(TODAY, 17, 59) })).toMatchObject({ windowOpen: false, sent: 0 });
    expect(outbox).toHaveLength(0);

    await prisma.settings.update({ where: { id: 1 }, data: { reminderHour: 20 } });
    expect(await runReminders({ now: at(TODAY, 19, 0) })).toMatchObject({ windowOpen: false, reminderHour: 20 });
    expect(outbox).toHaveLength(0);
    expect(await runReminders({ now: at(TODAY, 20, 0) })).toMatchObject({ windowOpen: true, sent: 1 });
    expect(outbox).toHaveLength(1);
  });

  it("dopo mezzanotte non parte più per il giorno prima", async () => {
    await appointment({ day: TOMORROW });
    expect(await runReminders({ now: at(TOMORROW, 0, 30) })).toMatchObject({ windowOpen: false, sent: 0 });
  });

  it("salta le clienti senza email e i prenotati lo stesso giorno, senza segnarli", async () => {
    const noEmail = await appointment({ email: null });
    const sameDay = await appointment({ hour: 15, createdAt: at(TODAY, 9) });
    const summary = await runReminders({ now: EVENING });
    expect(summary).toMatchObject({ sent: 0, skippedNoEmail: 1, skippedBookedSameDay: 1 });
    expect(outbox).toHaveLength(0);
    expect(await reminderLogs()).toHaveLength(0);
    const rows = await prisma.appointment.findMany({ where: { id: { in: [noEmail.id, sameDay.id] } } });
    expect(rows.every((r) => r.reminderEmailSentAt === null)).toBe(true);
  });

  it("invio fallito: FAILED col motivo, appuntamento segnato, nessun nuovo tentativo automatico", async () => {
    const a = await appointment();
    behaviour.fail = "HTTP 500: errore del fornitore";
    expect(await runReminders({ now: EVENING })).toMatchObject({ sent: 0, failed: 1 });
    const [log] = await reminderLogs();
    expect(log).toMatchObject({ status: "FAILED", error: "HTTP 500: errore del fornitore", appointmentId: a.id });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).reminderEmailSentAt).not.toBeNull();

    behaviour.fail = null;
    expect(await runReminders({ now: at(TODAY, 19, 30) })).toMatchObject({ sent: 0, failed: 0 });
    expect(outbox).toHaveLength(1); // solo il tentativo fallito
  });

  it("si ferma oltre il tempo concesso e dice quanti ne restano; il giro dopo li completa", async () => {
    for (let i = 0; i < 3; i++) await appointment({ hour: 9 + i * 2 });
    behaviour = { delayMs: 0, fail: null, delayFirstMs: 400 };
    const first = await runReminders({ now: EVENING, budgetMs: 200 });
    expect(first).toMatchObject({ sent: 1, remaining: 2, stoppedEarly: true });

    const second = await runReminders({ now: at(TODAY, 19, 0) });
    expect(second).toMatchObject({ sent: 2, remaining: 0, stoppedEarly: false });
    expect(outbox).toHaveLength(3);
  });
});

describe("Riprova", () => {
  it("rimanda un promemoria non riuscito, una volta sola anche con due clic simultanei", async () => {
    const a = await appointment();
    behaviour.fail = "timeout";
    await runReminders({ now: EVENING });
    behaviour = { delayMs: 40, fail: null };

    const results = await Promise.all([retryReminder(a.id, at(TODAY, 19)), retryReminder(a.id, at(TODAY, 19))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(outbox).toHaveLength(2); // il fallito + un solo nuovo invio
    expect((await reminderLogs()).map((l) => l.status)).toEqual(["FAILED", "SENT"]);

    expect(await retryReminder(a.id, at(TODAY, 19, 5))).toEqual({ ok: false, error: "Il promemoria risulta già inviato." });
    expect(outbox).toHaveLength(2);
  });

  it("niente da riprovare se l'email non è mai partita o l'appuntamento è cancellato", async () => {
    const a = await appointment();
    expect(await retryReminder(a.id, EVENING)).toMatchObject({ ok: false });
    behaviour.fail = "x";
    await runReminders({ now: EVENING });
    await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    expect(await retryReminder(a.id, at(TODAY, 19))).toMatchObject({ ok: false });
    expect(outbox).toHaveLength(1);
  });

  it("dopo un nuovo fallimento si può riprovare ancora", async () => {
    const a = await appointment();
    behaviour.fail = "primo";
    await runReminders({ now: EVENING });
    behaviour.fail = "secondo";
    expect(await retryReminder(a.id, at(TODAY, 19))).toMatchObject({ ok: false, error: "Invio non riuscito: secondo" });
    behaviour.fail = null;
    expect(await retryReminder(a.id, at(TODAY, 19, 10))).toEqual({ ok: true });
    expect((await reminderLogs()).map((l) => l.status)).toEqual(["FAILED", "FAILED", "SENT"]);
  });
});

describe("endpoint /api/cron/promemoria", () => {
  const call = async (authorization?: string) => {
    const { GET } = await import("@/app/api/cron/promemoria/route");
    const { NextRequest } = await import("next/server");
    const headers = authorization ? { authorization } : undefined;
    return GET(new NextRequest("https://prenota.example.it/api/cron/promemoria", { headers }));
  };

  it("senza il segreto giusto risponde 401 e non invia niente", async () => {
    process.env.CRON_SECRET = "segreto-di-prova-abbastanza-lungo";
    await appointment();
    expect((await call()).status).toBe(401);
    expect((await call("Bearer sbagliato")).status).toBe(401);
    expect(outbox).toHaveLength(0);
  });

  it("col segreto giusto risponde col riepilogo, compresi i rimanenti", async () => {
    process.env.CRON_SECRET = "segreto-di-prova-abbastanza-lungo";
    const response = await call("Bearer segreto-di-prova-abbastanza-lungo");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining(["day", "windowOpen", "reminderHour", "sent", "failed", "remaining", "stoppedEarly"]),
    );
  });

  it("maxDuration 60 s", async () => {
    const route = await import("@/app/api/cron/promemoria/route");
    expect(route.maxDuration).toBe(60);
  });
});
