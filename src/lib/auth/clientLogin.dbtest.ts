import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

// Il codice inviato "per email" finisce qui invece che a Resend.
const sent: { email: string; code: string }[] = [];
vi.mock("@/lib/notifications/loginCode", () => ({
  sendLoginCodeEmail: async (client: { email: string }, code: string) => {
    sent.push({ email: client.email, code });
  },
}));

const { issueLoginCode, verifyLoginCode } = await import("./clientLogin");
const { CODE_MAX_ATTEMPTS } = await import("./loginCode");
const { INVITE_SIGNUPS_PER_HOUR, findActiveInvite, getActiveInvite, regenerateInvite, signupsInLastHour } = await import(
  "@/lib/invite/invite"
);

const NOW = new Date("2026-10-06T08:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const EMAIL = "anna@test.it";
let clientId: string;

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-".padEnd(48, "x");
});

beforeEach(async () => {
  sent.length = 0;
  await prisma.$executeRawUnsafe('TRUNCATE "LoginCode","NotificationLog","Client","InviteLink" CASCADE');
  const client = await prisma.client.create({ data: { firstName: "Anna", lastName: "Bianchi", phone: "+393331234567", email: EMAIL } });
  clientId = client.id;
});

afterAll(() => prisma.$disconnect());

const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("codice di accesso", () => {
  it("salva solo l'HMAC e accetta il codice una volta sola", async () => {
    await issueLoginCode(EMAIL, NOW);
    expect(sent).toHaveLength(1);
    const { code } = sent[0];
    const row = await prisma.loginCode.findFirstOrThrow({ where: { clientId } });
    expect(row.codeHash).not.toContain(code);
    expect(row.expiresAt).toEqual(later(10));

    const ok = await verifyLoginCode(EMAIL, code, later(1));
    expect(ok).toEqual({ ok: true, client: { id: clientId, sessionVersion: 0 } });
    expect(await verifyLoginCode(EMAIL, code, later(2))).toEqual({ ok: false });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: clientId } })).lastLoginAt).toEqual(later(1));
  });

  it("niente codice per email sconosciute o clienti bloccate", async () => {
    await issueLoginCode("nessuna@test.it", NOW);
    await prisma.client.update({ where: { id: clientId }, data: { blockedAt: NOW } });
    await issueLoginCode(EMAIL, NOW);
    expect(sent).toHaveLength(0);
    expect(await prisma.loginCode.count()).toBe(0);
  });

  it("una cliente bloccata dopo aver ricevuto il codice non entra", async () => {
    await issueLoginCode(EMAIL, NOW);
    await prisma.client.update({ where: { id: clientId }, data: { blockedAt: NOW } });
    expect(await verifyLoginCode(EMAIL, sent[0].code, later(1))).toEqual({ ok: false });
  });

  it("scade dopo 10 minuti", async () => {
    await issueLoginCode(EMAIL, NOW);
    expect(await verifyLoginCode(EMAIL, sent[0].code, later(10))).toEqual({ ok: false });
  });

  it("dopo 5 tentativi sbagliati anche quello giusto viene rifiutato", async () => {
    await issueLoginCode(EMAIL, NOW);
    const { code } = sent[0];
    for (let i = 0; i < CODE_MAX_ATTEMPTS; i++) {
      expect(await verifyLoginCode(EMAIL, wrongCode(code), later(1))).toEqual({ ok: false });
    }
    expect(await verifyLoginCode(EMAIL, code, later(1))).toEqual({ ok: false });
    expect((await prisma.loginCode.findFirstOrThrow({ where: { clientId } })).attempts).toBe(CODE_MAX_ATTEMPTS);
  });

  it("vale solo l'ultimo codice; massimo 3 ogni 15 minuti", async () => {
    await issueLoginCode(EMAIL, NOW);
    await issueLoginCode(EMAIL, later(1));
    await issueLoginCode(EMAIL, later(2));
    await issueLoginCode(EMAIL, later(3)); // oltre il limite: non parte
    expect(sent).toHaveLength(3);
    expect(await verifyLoginCode(EMAIL, sent[0].code, later(4))).toEqual({ ok: false });

    await issueLoginCode(EMAIL, later(15.1)); // il primo è uscito dalla finestra
    expect(sent).toHaveLength(4);
    expect((await verifyLoginCode(EMAIL, sent[3].code, later(16))).ok).toBe(true);
  });

  it("richieste simultanee non superano il limite", async () => {
    await Promise.all(Array.from({ length: 6 }, () => issueLoginCode(EMAIL, NOW)));
    expect(sent).toHaveLength(3);
    expect(await prisma.loginCode.count({ where: { consumedAt: null } })).toBe(1);
  });
});

describe("link d'invito", () => {
  it("rigenerando, il vecchio smette di funzionare", async () => {
    await regenerateInvite();
    const first = (await getActiveInvite())!;
    expect(await findActiveInvite(first.token)).not.toBeNull();

    await regenerateInvite();
    const second = (await getActiveInvite())!;
    expect(second.token).not.toBe(first.token);
    expect(await findActiveInvite(first.token)).toBeNull();
    expect(await findActiveInvite(second.token)).not.toBeNull();
    expect(await findActiveInvite("../../etc")).toBeNull();
  });

  it("il database non ammette due link attivi, nemmeno con due 'Rigenera' simultanei", async () => {
    await Promise.all([regenerateInvite(), regenerateInvite(), regenerateInvite()]);
    expect(await prisma.inviteLink.count({ where: { revokedAt: null } })).toBe(1);
    await expect(prisma.inviteLink.create({ data: { token: "doppione-attivo-123" } })).rejects.toThrow();
  });

  it("conta le iscrizioni dell'ultima ora per link", async () => {
    await regenerateInvite();
    const link = (await getActiveInvite())!;
    const now = new Date();
    for (let i = 0; i < INVITE_SIGNUPS_PER_HOUR; i++) {
      await prisma.client.create({
        data: { firstName: "C", lastName: `${i}`, phone: "+39333", email: `c${i}@test.it`, inviteLinkId: link.id },
      });
    }
    await prisma.client.create({
      data: {
        firstName: "Vecchia",
        lastName: "Iscritta",
        phone: "+39333",
        email: "old@test.it",
        inviteLinkId: link.id,
        createdAt: new Date(now.getTime() - 61 * 60_000),
      },
    });
    expect(await signupsInLastHour(link.id, now)).toBe(INVITE_SIGNUPS_PER_HOUR);
  });
});
