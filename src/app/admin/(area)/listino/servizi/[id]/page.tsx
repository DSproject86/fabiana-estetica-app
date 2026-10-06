import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import { DeleteButton } from "../../_components/DeleteButton";
import { ServiceForm } from "../../_components/ServiceForm";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { deleteService, updateService } from "../../actions";

export const metadata: Metadata = { title: "Modifica servizio" };

export default async function ModificaServizioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [service, categories] = await Promise.all([
    prisma.service.findUnique({ where: { id } }),
    prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!service) notFound();

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Modifica servizio" />
      <ServiceForm
        action={updateService.bind(null, service.id)}
        categories={categories}
        initial={{
          categoryId: service.categoryId,
          name: service.name,
          description: service.description ?? "",
          durationMin: String(service.durationMin),
          price: centsToInput(service.priceCents),
          active: service.active,
        }}
        submitLabel="Salva modifiche"
      />
      <div className="mt-4 flex flex-col gap-2 border-t border-oro/20 pt-6">
        <DeleteButton
          action={deleteService.bind(null, service.id)}
          label="Elimina servizio"
          confirmMessage={`Eliminare "${service.name}" dal listino?`}
        />
        <p className="text-xs text-prugna/60">
          Gli appuntamenti già presi o passati non cambiano: conservano nome, durata e prezzo. Se vuoi
          solo toglierlo dalla prenotazione, usa &quot;Visibile alle clienti&quot;.
        </p>
      </div>
    </div>
  );
}
