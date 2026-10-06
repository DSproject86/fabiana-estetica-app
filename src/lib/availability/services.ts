import "server-only";
import { prisma } from "@/lib/db";
import type { Db } from "@/lib/schedule/queries";

export type BookingActor = "CLIENT" | "ADMIN";

export type BookableService = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
};

export const MAX_SERVICES_PER_BOOKING = 10;

/**
 * Carica dal database i servizi scelti, nell'ordine dato.
 * Per le clienti: solo servizi attivi di categorie attive. Lista vuota e duplicati rifiutati.
 */
export async function loadServicesForBooking(
  serviceIds: string[],
  actor: BookingActor,
  db: Db = prisma,
): Promise<{ ok: true; services: BookableService[] } | { ok: false; error: string }> {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return { ok: false, error: "Scegli almeno un servizio." };
  }
  if (serviceIds.length > MAX_SERVICES_PER_BOOKING) {
    return { ok: false, error: `Puoi scegliere al massimo ${MAX_SERVICES_PER_BOOKING} servizi.` };
  }
  if (new Set(serviceIds).size !== serviceIds.length) {
    return { ok: false, error: "Lo stesso servizio è stato scelto più volte." };
  }

  const rows = await db.service.findMany({
    where: { id: { in: serviceIds } },
    select: {
      id: true,
      name: true,
      durationMin: true,
      priceCents: true,
      active: true,
      category: { select: { active: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const services: BookableService[] = [];
  for (const id of serviceIds) {
    const row = byId.get(id);
    if (!row || (actor === "CLIENT" && (!row.active || !row.category.active))) {
      return { ok: false, error: "Uno dei servizi scelti non è più disponibile. Aggiorna la pagina e riprova." };
    }
    services.push({ id: row.id, name: row.name, durationMin: row.durationMin, priceCents: row.priceCents });
  }
  return { ok: true, services };
}
