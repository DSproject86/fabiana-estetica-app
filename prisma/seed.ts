/**
 * Seed idempotente: si può rilanciare quante volte si vuole senza creare duplicati.
 * - Admin da ADMIN_EMAIL_1/2 + ADMIN_PASSWORD_1/2 (password hashate con bcrypt).
 *   Spazi iniziali/finali vengono ignorati (anche al login). Se la password cambia,
 *   l'hash viene aggiornato e le sessioni aperte di quell'admin vengono invalidate.
 *   A ogni esecuzione gli account vengono sbloccati, e gli admin con un'email non
 *   più presente nelle variabili vengono rimossi: restano solo i 2 configurati.
 * - Riga unica dei parametri (Settings) con i valori di default.
 * - Testi predefiniti dei messaggi: creati solo se mancano, mai sovrascritti
 *   (così le modifiche fatte dall'admin restano).
 *
 * Nei log non compaiono mai email o password (il repository è pubblico).
 */
import { PrismaClient, type Channel, type MessageKind } from "@prisma/client";
import { hashPassword, normalizePassword, verifyPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

type AdminSeed = { n: number; email: string; password: string; name: string; notes: string[] };

function readAdmins(): AdminSeed[] {
  const admins: AdminSeed[] = [];
  for (const n of [1, 2]) {
    const rawEmail = process.env[`ADMIN_EMAIL_${n}`] ?? "";
    const rawPassword = process.env[`ADMIN_PASSWORD_${n}`] ?? "";
    const email = rawEmail.trim().toLowerCase();
    const password = normalizePassword(rawPassword);
    if (!email || !password) {
      throw new Error(`ADMIN_EMAIL_${n} e ADMIN_PASSWORD_${n} sono obbligatorie per il seed.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`ADMIN_EMAIL_${n} non sembra un indirizzo email valido.`);
    }
    if (password.length < 10) {
      throw new Error(`ADMIN_PASSWORD_${n} deve avere almeno 10 caratteri.`);
    }
    const notes: string[] = [];
    if (email !== rawEmail) notes.push("email normalizzata (spazi/maiuscole)");
    if (password !== rawPassword) notes.push("spazi rimossi dalla password");
    const name = process.env[`ADMIN_NAME_${n}`]?.trim() || email.split("@")[0];
    admins.push({ n, email, password, name, notes });
  }
  if (admins[0].email === admins[1].email) {
    throw new Error("ADMIN_EMAIL_1 e ADMIN_EMAIL_2 devono essere diverse.");
  }
  return admins;
}

async function seedAdmins() {
  const admins = readAdmins();

  for (const { n, email, password, name, notes } of admins) {
    const existing = await prisma.admin.findUnique({ where: { email } });
    const extra = notes.length ? ` – ${notes.join(", ")}` : "";
    if (!existing) {
      await prisma.admin.create({
        data: { email, name, passwordHash: await hashPassword(password) },
      });
      console.log(`  admin ${n}: creato${extra}`);
      continue;
    }
    const samePassword = await verifyPassword(password, existing.passwordHash);
    await prisma.admin.update({
      where: { email },
      data: {
        name,
        failedLoginCount: 0,
        lockedUntil: null,
        ...(samePassword
          ? {}
          : { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } }),
      },
    });
    console.log(
      `  admin ${n}: aggiornato${samePassword ? "" : " (nuova password)"}, account sbloccato${extra}`,
    );
  }

  const removed = await prisma.admin.deleteMany({
    where: { email: { notIn: admins.map((a) => a.email) } },
  });
  if (removed.count > 0) {
    console.log(`  admin rimossi perché non più nelle variabili: ${removed.count}`);
  }
}

async function seedSettings() {
  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log("  parametri: ok");
}

type TemplateSeed = { kind: MessageKind; channel: Channel; subject?: string; body: string };

const TEMPLATES: TemplateSeed[] = [
  {
    kind: "LOGIN_CODE",
    channel: "EMAIL",
    subject: "Il tuo codice di accesso: {codice}",
    body: "Ciao {nome},\n\nil tuo codice per accedere è: {codice}\n\nVale 10 minuti. Se non l'hai richiesto tu, ignora questa email.\n\nFabiana",
  },
  {
    kind: "BOOKING_CONFIRMED",
    channel: "EMAIL",
    subject: "Appuntamento confermato · {data} alle {ora}",
    body: "Ciao {nome},\n\nil tuo appuntamento è confermato:\n\n{data} alle {ora}\n{servizi}\nTotale: {totale}\n\nA presto!\nFabiana",
  },
  {
    kind: "REMINDER",
    channel: "EMAIL",
    subject: "Promemoria: domani alle {ora}",
    body: "Ciao {nome},\n\nti ricordo l'appuntamento di domani, {data} alle {ora}:\n{servizi}\n\nSe hai un imprevisto, scrivimi appena puoi.\n\nA domani!\nFabiana",
  },
  {
    kind: "APPOINTMENT_CHANGED",
    channel: "EMAIL",
    subject: "Appuntamento modificato · {data} alle {ora}",
    body: "Ciao {nome},\n\nil tuo appuntamento è stato spostato a:\n\n{data} alle {ora}\n{servizi}\n\nPer qualsiasi dubbio scrivimi.\n\nFabiana",
  },
  {
    kind: "APPOINTMENT_CANCELLED",
    channel: "EMAIL",
    subject: "Appuntamento cancellato · {data}",
    body: "Ciao {nome},\n\nl'appuntamento di {data} alle {ora} è stato cancellato.\n\nSe vuoi fissarne un altro, puoi prenotare dall'app.\n\nFabiana",
  },
  {
    kind: "BOOKING_CONFIRMED",
    channel: "WHATSAPP",
    body: "Ciao {nome}! Ti confermo l'appuntamento di {data} alle {ora} ({servizi}). A presto! Fabiana",
  },
  {
    kind: "REMINDER",
    channel: "WHATSAPP",
    body: "Ciao {nome}! Ti ricordo l'appuntamento di domani, {data} alle {ora}. A domani! Fabiana",
  },
  {
    kind: "APPOINTMENT_CHANGED",
    channel: "WHATSAPP",
    body: "Ciao {nome}! Il tuo appuntamento è stato spostato a {data} alle {ora}. Fammi sapere se va bene. Fabiana",
  },
  {
    kind: "APPOINTMENT_CANCELLED",
    channel: "WHATSAPP",
    body: "Ciao {nome}, l'appuntamento di {data} alle {ora} è stato cancellato. Scrivimi se vuoi fissarne un altro. Fabiana",
  },
];

async function seedTemplates() {
  let created = 0;
  for (const t of TEMPLATES) {
    const existing = await prisma.messageTemplate.findUnique({
      where: { kind_channel: { kind: t.kind, channel: t.channel } },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.messageTemplate.create({
      data: { kind: t.kind, channel: t.channel, subject: t.subject ?? null, body: t.body },
    });
    created++;
  }
  console.log(`  testi messaggi: ${created} creati, ${TEMPLATES.length - created} già presenti`);
}

async function main() {
  console.log("Seed in corso…");
  await seedAdmins();
  await seedSettings();
  await seedTemplates();
  console.log("Seed completato.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
