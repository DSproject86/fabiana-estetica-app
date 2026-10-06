import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import { DeleteButton } from "../../_components/DeleteButton";
import { PackageTemplateForm } from "../../_components/PackageTemplateForm";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { serviceOptions } from "../../_components/service-options";
import { deletePackageTemplate, updatePackageTemplate } from "../../actions";

export const metadata: Metadata = { title: "Modifica pacchetto" };

export default async function ModificaPacchettoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [template, services] = await Promise.all([
    prisma.packageTemplate.findUnique({
      where: { id },
      include: { _count: { select: { clientPackages: true } } },
    }),
    serviceOptions(),
  ]);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Modifica pacchetto" />
      <PackageTemplateForm
        action={updatePackageTemplate.bind(null, template.id)}
        services={services}
        initial={{
          name: template.name,
          sessions: String(template.sessions),
          price: centsToInput(template.priceCents),
          serviceId: template.serviceId ?? "",
          active: template.active,
        }}
        submitLabel="Salva modifiche"
      />
      <p className="text-xs text-prugna/60">
        Le modifiche valgono per i pacchetti assegnati da ora in poi: quelli già venduti alle clienti
        mantengono nome, prezzo e sedute di quando sono stati assegnati.
      </p>
      <div className="mt-2 flex flex-col gap-2 border-t border-oro/20 pt-6">
        <DeleteButton
          action={deletePackageTemplate.bind(null, template.id)}
          label="Elimina pacchetto"
          confirmMessage={`Eliminare il pacchetto "${template.name}" dal listino?`}
        />
        {template._count.clientPackages > 0 ? (
          <p className="text-xs text-prugna/60">
            È già stato assegnato a {template._count.clientPackages}{" "}
            {template._count.clientPackages === 1 ? "cliente" : "clienti"}: i loro pacchetti restano.
          </p>
        ) : null}
      </div>
    </div>
  );
}
