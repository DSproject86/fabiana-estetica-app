/**
 * Seed idempotente: si può rilanciare quante volte si vuole senza creare duplicati.
 * - Admin da ADMIN_EMAIL_1/2 + ADMIN_PASSWORD_1/2 (password hashate con bcrypt).
 *   Spazi iniziali/finali vengono ignorati (anche al login). Se la password cambia,
 *   l'hash viene aggiornato e le sessioni aperte di quell'admin vengono invalidate.
 *   A ogni esecuzione gli account vengono sbloccati, e gli admin con un'email non
 *   più presente nelle variabili vengono rimossi: restano solo i 2 configurati.
 * - Riga unica dei parametri (Settings) con i valori di default.
 * - Testi predefiniti dei messaggi (src/lib/notifications/defaults.ts): creati se mancano;
 *   quelli ancora identici a un predefinito precedente passano ai testi nuovi, quelli
 *   modificati dall'admin non si toccano mai.
 *
 * Nei log non compaiono mai email o password (il repository è pubblico).
 */
import { PrismaClient, type Channel, type MessageKind } from "@prisma/client";
import { hashPassword, normalizePassword, verifyPassword } from "../src/lib/auth/password";
import {
  DEFAULT_TEMPLATES,
  seedTemplateAction,
  type TemplateKey,
  type TemplateText,
} from "../src/lib/notifications/defaults";

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

async function seedTemplates() {
  let created = 0;
  let updated = 0;
  let kept = 0;
  for (const [key, text] of Object.entries(DEFAULT_TEMPLATES) as [TemplateKey, TemplateText | undefined][]) {
    if (!text) continue;
    const [kind, channel] = key.split(":") as [MessageKind, Channel];
    const existing = await prisma.messageTemplate.findUnique({
      where: { kind_channel: { kind, channel } },
      select: { id: true, subject: true, body: true },
    });
    if (!existing) {
      await prisma.messageTemplate.create({ data: { kind, channel, subject: text.subject, body: text.body } });
      created++;
    } else if (seedTemplateAction(key, existing) === "update") {
      await prisma.messageTemplate.update({ where: { id: existing.id }, data: { subject: text.subject, body: text.body } });
      updated++;
    } else {
      kept++;
    }
  }
  console.log(
    `  testi messaggi: ${created} creati, ${updated} aggiornati ai nuovi predefiniti, ${kept} lasciati com'erano`,
  );
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
