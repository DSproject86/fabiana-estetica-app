import "server-only";
import { agendaState } from "@/lib/agenda/rules";
import { loadSettings } from "@/lib/availability/queries";
import { formatPhone } from "@/lib/clients/phone";
import { prisma } from "@/lib/db";
import { summarizePackage } from "@/lib/packages/rules";
import { dayKeyOf, dbDateToDayKey, formatTime } from "@/lib/time/rome";
import { csvEuro, toCsv } from "./csv";

/**
 * Esportazioni CSV (Impostazioni → Copia di sicurezza). Date e ore a Roma, importi in euro.
 * Le note allergie ci sono solo con "Mostra note allergie" acceso.
 */

export const EXPORTS = {
  clienti: "Clienti",
  appuntamenti: "Appuntamenti",
  pacchetti: "Pacchetti",
  pagamenti: "Pagamenti dei pacchetti",
} as const;

export type ExportKind = keyof typeof EXPORTS;

export const isExportKind = (value: string): value is ExportKind => Object.hasOwn(EXPORTS, value);

const STATE_LABEL = { confirmed: "confermato", done: "fatto", noShow: "non presentata", cancelled: "annullato" } as const;
const METHOD_LABEL = { CASH: "contanti", CARD: "carta" } as const;
const dateTime = (d: Date | null) => (d ? `${dayKeyOf(d)} ${formatTime(d)}` : "");

async function clientsCsv(): Promise<string> {
  const [settings, clients] = await Promise.all([
    loadSettings(),
    prisma.client.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { createdAt: "asc" }] }),
  ]);
  const allergy = settings.showAllergyNotes;
  const header = [
    "id",
    "nome",
    "cognome",
    "cellulare",
    "email",
    "provenienza",
    "creata il",
    "consenso privacy",
    "versione privacy",
    "ultimo accesso",
    "bloccata dal",
    "eliminata (privacy) il",
    "note",
    ...(allergy ? ["allergie"] : []),
  ];
  const rows = clients.map((c) => [
    c.id,
    c.firstName,
    c.lastName,
    c.phone ? formatPhone(c.phone) : "",
    c.email,
    c.source === "INVITE" ? "link d'invito" : "inserita da admin",
    dateTime(c.createdAt),
    dateTime(c.privacyAcceptedAt),
    c.privacyVersion,
    dateTime(c.lastLoginAt),
    dateTime(c.blockedAt),
    dateTime(c.anonymizedAt),
    c.adminNotes,
    ...(allergy ? [c.allergyNotes] : []),
  ]);
  return toCsv(header, rows);
}

async function appointmentsCsv(): Promise<string> {
  const appointments = await prisma.appointment.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      items: { orderBy: { sortOrder: "asc" }, select: { name: true, priceCents: true, clientPackageId: true } },
    },
  });
  const header = [
    "id",
    "data",
    "ora inizio",
    "ora fine",
    "durata (min)",
    "pausa (min)",
    "cliente id",
    "cliente",
    "servizi",
    "voci da pacchetto",
    "totale listino (€)",
    "stato",
    "incassato (€)",
    "creato da",
    "creato il",
    "annullato il",
    "note",
  ];
  const rows = appointments.map((a) => [
    a.id,
    dayKeyOf(a.startsAt),
    formatTime(a.startsAt),
    formatTime(new Date(a.startsAt.getTime() + a.durationMin * 60_000)),
    a.durationMin,
    a.bufferMin,
    a.clientId,
    `${a.client.firstName} ${a.client.lastName}`,
    a.items.map((i) => i.name).join(" + "),
    a.items.filter((i) => i.clientPackageId).map((i) => i.name).join(" + "),
    csvEuro(a.totalPriceCents),
    STATE_LABEL[agendaState(a)],
    csvEuro(a.amountCollectedCents),
    a.createdBy === "CLIENT" ? "cliente (online)" : "admin",
    dateTime(a.createdAt),
    dateTime(a.cancelledAt),
    a.adminNotes,
  ]);
  return toCsv(header, rows);
}

async function packagesCsv(): Promise<string> {
  const packages = await prisma.clientPackage.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
      category: { select: { name: true } },
      payments: { select: { amountCents: true } },
      _count: { select: { items: true } },
    },
  });
  const header = [
    "id",
    "cliente id",
    "cliente",
    "pacchetto",
    "valido per",
    "prezzo (€)",
    "pagato (€)",
    "residuo (€)",
    "sedute",
    "fatte prima dell'app",
    "scalate nell'app",
    "rimaste",
    "venduto il",
    "archiviato il",
    "note",
  ];
  const rows = packages.map((p) => {
    const s = summarizePackage({
      priceCents: p.priceCents,
      totalSessions: p.totalSessions,
      sessionsUsedBefore: p.sessionsUsedBefore,
      sessionsInApp: p._count.items,
      paidCents: p.payments.reduce((sum, x) => sum + x.amountCents, 0),
    });
    return [
      p.id,
      p.clientId,
      `${p.client.firstName} ${p.client.lastName}`,
      p.name,
      p.service ? p.service.name : p.category ? `${p.category.name} (categoria)` : "",
      csvEuro(p.priceCents),
      csvEuro(s.paidCents),
      csvEuro(s.dueCents),
      p.totalSessions,
      p.sessionsUsedBefore,
      p._count.items,
      s.remainingSessions,
      dateTime(p.createdAt),
      dateTime(p.closedAt),
      p.notes,
    ];
  });
  return toCsv(header, rows);
}

async function paymentsCsv(): Promise<string> {
  const payments = await prisma.packagePayment.findMany({
    orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
    include: { package: { select: { id: true, name: true, clientId: true, client: { select: { firstName: true, lastName: true } } } } },
  });
  const header = ["id", "data", "importo (€)", "metodo", "nota", "pacchetto id", "pacchetto", "cliente id", "cliente", "registrato il"];
  const rows = payments.map((p) => [
    p.id,
    dbDateToDayKey(p.paidOn),
    csvEuro(p.amountCents),
    METHOD_LABEL[p.method],
    p.note,
    p.package.id,
    p.package.name,
    p.package.clientId,
    `${p.package.client.firstName} ${p.package.client.lastName}`,
    dateTime(p.createdAt),
  ]);
  return toCsv(header, rows);
}

export function buildExport(kind: ExportKind): Promise<string> {
  switch (kind) {
    case "clienti":
      return clientsCsv();
    case "appuntamenti":
      return appointmentsCsv();
    case "pacchetti":
      return packagesCsv();
    case "pagamenti":
      return paymentsCsv();
  }
}
