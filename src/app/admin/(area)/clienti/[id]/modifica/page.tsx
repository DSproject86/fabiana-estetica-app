import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { loadSettings } from "@/lib/availability/queries";
import { formatPhone } from "@/lib/clients/phone";
import { prisma } from "@/lib/db";
import { updateClientAction } from "../../actions";
import { EditClientForm } from "./EditClientForm";

export const metadata: Metadata = { title: "Modifica cliente" };

export default async function ModificaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, settings] = await Promise.all([
    prisma.client.findFirst({ where: { id, anonymizedAt: null } }),
    loadSettings(),
  ]);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackHeader back={{ href: `/admin/clienti/${client.id}`, label: `${client.firstName} ${client.lastName}` }} title="Modifica dati" />
      <EditClientForm
        action={updateClientAction.bind(null, client.id)}
        cancelHref={`/admin/clienti/${client.id}`}
        initial={{
          firstName: client.firstName,
          lastName: client.lastName,
          phone: formatPhone(client.phone),
          email: client.email ?? "",
          adminNotes: client.adminNotes ?? "",
          allergyNotes: settings.showAllergyNotes ? (client.allergyNotes ?? "") : null,
        }}
      />
    </div>
  );
}
