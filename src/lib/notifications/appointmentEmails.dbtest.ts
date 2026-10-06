import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { EmailMessage, SendResult } from "@/lib/email/send";
import { instantAt } from "@/lib/time/rome";

const outbox: EmailMessage[] = [];
let failWith: string | null = null;
let throwError = false;
vi.mock("@/lib/email/send", () => ({
  replyToAddress: () => "fabiana@example.it",
  sendEmail: async (message: EmailMessage): Promise<SendResult> => {
    if (throwError) throw new Error("rete giù");
    outbox.push(message);
    return failWith ? { ok: false, provider: "resend", error: failWith } : { ok: true, provider: "resend", providerMessageId: "m1" };
  },
}));

const { notifyAdminsOfNewBooking, sendAppointmentCancelledEmail, sendAppointmentChangedEmail, sendBookingConfirmedEmail } =
  await import("./appointmentEmails");
const { sendLoginCodeEmail } = await import("./loginCode");

const prop = (ics: string, name: string) =>
  ics.replace(/\r\n /g, "").split("\r\n").find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1);

async function setup({ email = "anna@test.it" as string | null, createdBy = "CLIENT" as "CLIENT" | "ADMIN" } = {}) {
  outbox.length = 0;
  failWith = null;
  throwError = false;
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog","AppointmentItem","Appointment","Client","Admin","Settings","MessageTemplate" CASCADE',
  );
  await prisma.settings.create({ data: { id: 1, businessAddress: "Via Roma 1, Roma", businessWhatsapp: "+393331112222" } });
  await prisma.admin.createMany({
    data: [
      { email: "fabiana@test.it", name: "Fabiana", passwordHash: "x" },
      { email: "marito@test.it", name: "Marco", passwordHash: "x", notifyNewBooking: false },
    ],
  });
  const client = await prisma.client.create({ data: { firstName: "Anna", lastName: "Verdi", phone: "+393334445555", email } });
  const startsAt = instantAt("2026-10-14", 10 * 60 + 30);
  return prisma.appointment.create({
    data: {
      clientId: client.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 120 * 60_000),
      durationMin: 90,
      bufferMin: 30,
      totalPriceCents: 6500,
      createdBy,
      items: { create: [{ name: "Pulizia viso", durationMin: 60, priceCents: 4500 }, { name: "Peeling", durationMin: 15, priceCents: 2000, sortOrder: 1 }] },
    },
  });
}

const logs = () => prisma.notificationLog.findMany({ orderBy: { createdAt: "asc" } });

beforeEach(() => setup());
afterAll(() => prisma.$disconnect());

describe("conferma prenotazione", () => {
  it("email con data in italiano, riquadro, indirizzo, link e .ics senza pausa; registrata SENT", async () => {
    const a = await setup();
    const result = await sendBookingConfirmedEmail(a.id, new Date("2026-10-06T10:00:00Z"));
    expect(result.ok).toBe(true);

    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail.to).toBe("anna@test.it");
    expect(mail.subject).toBe("Appuntamento confermato · mercoledì 14 ottobre alle 10:30");
    expect(mail.text).toContain("Servizi: Pulizia viso, Peeling");
    expect(mail.text).toContain("Durata: 1 h 30 min");
    expect(mail.text).toContain("Totale: 65 €");
    expect(mail.text).toContain("Via Roma 1, Roma");
    expect(mail.text).toMatch(/I miei appuntamenti: https?:\/\/.+\/appuntamenti/);
    expect(mail.html).toContain("WhatsApp +39 333 111 2222");

    const ics = mail.attachments![0];
    expect(ics.filename).toBe("appuntamento.ics");
    expect(prop(ics.content, "DTSTART")).toBe("20261014T083000Z");
    expect(prop(ics.content, "DTEND")).toBe("20261014T100000Z"); // 90 minuti, senza i 30 di pausa
    expect(prop(ics.content, "LOCATION")).toBe("Via Roma 1\\, Roma");

    expect(await logs()).toMatchObject([
      { kind: "BOOKING_CONFIRMED", status: "SENT", recipient: "anna@test.it", appointmentId: a.id, clientId: a.clientId },
    ]);
  });

  it("usa il testo salvato dall'admin", async () => {
    const a = await setup();
    await prisma.messageTemplate.create({
      data: { kind: "BOOKING_CONFIRMED", channel: "EMAIL", subject: "Ci vediamo {data}!", body: "Ciao {nome} {cognome}, a presto." },
    });
    await sendBookingConfirmedEmail(a.id);
    expect(outbox[0].subject).toBe("Ci vediamo mercoledì 14 ottobre!");
    expect(outbox[0].text.startsWith("Ciao Anna Verdi, a presto.")).toBe(true);
  });

  it("invio fallito: registrato come FAILED col motivo, nessun errore lanciato", async () => {
    const a = await setup();
    failWith = "HTTP 422: indirizzo non valido";
    await expect(sendBookingConfirmedEmail(a.id)).resolves.toMatchObject({ ok: false });
    expect(await logs()).toMatchObject([{ status: "FAILED", error: "HTTP 422: indirizzo non valido" }]);
  });

  it("anche un errore imprevisto del fornitore finisce nel registro come FAILED", async () => {
    const a = await setup();
    throwError = true;
    await expect(sendBookingConfirmedEmail(a.id)).resolves.toMatchObject({ ok: false });
    expect(await logs()).toMatchObject([{ status: "FAILED", error: "rete giù" }]);
  });

  it("cliente senza email: nessun invio e nessun errore", async () => {
    const a = await setup({ email: null });
    await expect(sendBookingConfirmedEmail(a.id)).resolves.toMatchObject({ ok: false, skipped: "NO_EMAIL" });
    expect(outbox).toHaveLength(0);
    expect(await logs()).toHaveLength(0);
  });
});

describe("avviso nuove prenotazioni agli admin", () => {
  it("solo agli admin con l'interruttore acceso, con Reply-To della cliente", async () => {
    const a = await setup();
    await notifyAdminsOfNewBooking(a.id);
    expect(outbox.map((m) => m.to)).toEqual(["fabiana@test.it"]);
    expect(outbox[0].subject).toBe("Nuova prenotazione · Anna Verdi · mercoledì 14 ottobre alle 10:30");
    expect(outbox[0].replyTo).toBe("anna@test.it");
    expect(await logs()).toMatchObject([{ kind: "ADMIN_NEW_BOOKING", status: "SENT", recipient: "fabiana@test.it" }]);
  });

  it("niente avviso per gli appuntamenti inseriti dall'admin", async () => {
    const a = await setup({ createdBy: "ADMIN" });
    expect(await notifyAdminsOfNewBooking(a.id)).toEqual([]);
    expect(outbox).toHaveLength(0);
  });
});

describe("modifica e cancellazione (da collegare all'agenda allo step 7)", () => {
  it("modifica: .ics aggiornato con lo stesso UID e SEQUENCE più alta, riga 'Prima era'", async () => {
    const a = await setup();
    await sendBookingConfirmedEmail(a.id, new Date("2026-10-06T10:00:00Z"));
    const previous = a.startsAt;
    const moved = instantAt("2026-10-16", 15 * 60);
    await prisma.appointment.update({
      where: { id: a.id },
      data: { startsAt: moved, endsAt: new Date(moved.getTime() + 120 * 60_000) },
    });
    await sendAppointmentChangedEmail(a.id, previous, new Date("2026-10-07T10:00:00Z"));

    const [confirm, changed] = outbox;
    expect(changed.subject).toBe("Appuntamento modificato · venerdì 16 ottobre alle 15:00");
    expect(changed.text).toContain("Prima era: mercoledì 14 ottobre alle 10:30");
    const before = confirm.attachments![0].content;
    const after = changed.attachments![0].content;
    expect(prop(after, "UID")).toBe(prop(before, "UID"));
    expect(Number(prop(after, "SEQUENCE"))).toBeGreaterThan(Number(prop(before, "SEQUENCE")));
    expect(prop(after, "DTSTART")).toBe("20261016T130000Z");
    expect((await logs()).map((l) => l.kind)).toEqual(["BOOKING_CONFIRMED", "APPOINTMENT_CHANGED"]);
  });

  it("modifica senza cambio d'orario: niente riga 'Prima era'", async () => {
    const a = await setup();
    await sendAppointmentChangedEmail(a.id, a.startsAt);
    expect(outbox[0].text).not.toContain("Prima era");
  });

  it("cancellazione: email senza allegato, dettagli nel riquadro, registrata", async () => {
    const a = await setup();
    await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "ADMIN" } });
    await sendAppointmentCancelledEmail(a.id);
    expect(outbox[0].subject).toBe("Appuntamento cancellato · mercoledì 14 ottobre");
    expect(outbox[0].attachments).toBeUndefined();
    expect(outbox[0].text).toContain("APPUNTAMENTO CANCELLATO");
    expect(await logs()).toMatchObject([{ kind: "APPOINTMENT_CANCELLED", status: "SENT" }]);
  });

  it("la modifica non parte per un appuntamento già cancellato", async () => {
    const a = await setup();
    await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    await expect(sendAppointmentChangedEmail(a.id)).resolves.toMatchObject({ skipped: "NOT_CONFIRMED" });
    expect(outbox).toHaveLength(0);
  });
});

describe("codice di accesso", () => {
  it("passa dalla stessa pipeline: HTML + testo, registrato senza il codice", async () => {
    const a = await setup();
    await sendLoginCodeEmail({ id: a.clientId, firstName: "Anna", lastName: "Verdi", email: "anna@test.it" }, "123456");
    expect(outbox[0].subject).toBe("Il tuo codice di accesso: 123456");
    expect(outbox[0].html).toContain("123456");
    const [log] = await logs();
    expect(log).toMatchObject({ kind: "LOGIN_CODE", status: "SENT" });
    expect(JSON.stringify(log)).not.toContain("123456");
  });
});
