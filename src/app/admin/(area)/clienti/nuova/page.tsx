import type { Metadata } from "next";
import { BackHeader } from "@/components/admin/BackHeader";
import { NewClientForm } from "../../agenda/_components/NewClientForm";

export const metadata: Metadata = { title: "Nuova cliente" };

export default function NuovaClientePage() {
  return (
    <div className="flex flex-col gap-6">
      <BackHeader
        back={{ href: "/admin/clienti", label: "Clienti" }}
        title="Nuova cliente"
        description="Per le clienti che non si iscrivono dal link d'invito. L'email è facoltativa."
      />
      <NewClientForm context="clienti" />
    </div>
  );
}
