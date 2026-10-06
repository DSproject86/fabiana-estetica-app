import { prisma } from "@/lib/db";

/** Servizi per il menu a tendina dei pacchetti: "Categoria · Servizio". */
export async function serviceOptions() {
  const services = await prisma.service.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  return services.map((s) => ({ id: s.id, label: `${s.category.name} · ${s.name}` }));
}
