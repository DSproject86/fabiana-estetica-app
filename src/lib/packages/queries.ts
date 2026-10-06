import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Db } from "@/lib/schedule/queries";
import { summarizePackage, type OfferPackage, type PackageSummary } from "./rules";

export const packageSelect = {
  id: true,
  clientId: true,
  name: true,
  priceCents: true,
  totalSessions: true,
  sessionsUsedBefore: true,
  serviceId: true,
  categoryId: true,
  notes: true,
  closedAt: true,
  createdAt: true,
  service: { select: { name: true } },
  category: { select: { name: true } },
  client: { select: { id: true, firstName: true, lastName: true } },
  payments: { select: { amountCents: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ClientPackageSelect;

type PackageRow = Prisma.ClientPackageGetPayload<{ select: typeof packageSelect }>;

export type PackageWithSummary = Omit<PackageRow, "payments" | "_count"> & {
  summary: PackageSummary;
  /** "Massaggio rilassante" oppure "Massaggi (tutta la categoria)"; null se non collegato. */
  coverageLabel: string | null;
};

export function withSummary(p: PackageRow): PackageWithSummary {
  const { payments, _count, ...rest } = p;
  return {
    ...rest,
    summary: summarizePackage({
      priceCents: p.priceCents,
      totalSessions: p.totalSessions,
      sessionsUsedBefore: p.sessionsUsedBefore,
      sessionsInApp: _count.items,
      paidCents: payments.reduce((sum, x) => sum + x.amountCents, 0),
    }),
    coverageLabel: p.service ? p.service.name : p.category ? `${p.category.name} (tutta la categoria)` : null,
  };
}

export async function loadPackages(where: Prisma.ClientPackageWhereInput, db: Db = prisma): Promise<PackageWithSummary[]> {
  const rows = await db.clientPackage.findMany({
    where,
    orderBy: [{ client: { lastName: "asc" } }, { client: { firstName: "asc" } }, { createdAt: "asc" }],
    select: packageSelect,
  });
  return rows.map(withSummary);
}

export async function loadPackage(id: string, db: Db = prisma): Promise<PackageWithSummary | null> {
  const row = await db.clientPackage.findUnique({ where: { id }, select: packageSelect });
  return row ? withSummary(row) : null;
}

/**
 * Pacchetti attivi delle clienti indicate, con le sedute rimaste calcolate SENZA le voci degli
 * appuntamenti indicati (servono a proporre "Scala dal pacchetto" su quegli appuntamenti).
 */
export async function loadOfferPackages(
  clientIds: string[],
  excludeAppointmentIds: string[],
  db: Db = prisma,
): Promise<Map<string, OfferPackage[]>> {
  const byClient = new Map<string, OfferPackage[]>();
  if (clientIds.length === 0) return byClient;
  const rows = await db.clientPackage.findMany({
    where: { clientId: { in: [...new Set(clientIds)] }, closedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      clientId: true,
      name: true,
      totalSessions: true,
      sessionsUsedBefore: true,
      serviceId: true,
      categoryId: true,
      items: { select: { appointmentId: true } },
    },
  });
  const excluded = new Set(excludeAppointmentIds);
  for (const p of rows) {
    const used = p.sessionsUsedBefore + p.items.filter((i) => !excluded.has(i.appointmentId)).length;
    const offer: OfferPackage = {
      id: p.id,
      name: p.name,
      serviceId: p.serviceId,
      categoryId: p.categoryId,
      totalSessions: p.totalSessions,
      remainingSessions: Math.max(0, p.totalSessions - used),
    };
    byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), offer]);
  }
  return byClient;
}

/** Menu "Valido per": categorie (tutti i servizi) e singoli servizi. */
export async function coverageOptions(db: Db = prisma) {
  const categories = await db.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, services: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } } },
  });
  return categories.map((c) => ({
    category: { value: `c:${c.id}`, label: `${c.name} · tutta la categoria` },
    services: c.services.map((s) => ({ value: `s:${s.id}`, label: s.name })),
    name: c.name,
  }));
}

export type CoverageOptions = Awaited<ReturnType<typeof coverageOptions>>;
