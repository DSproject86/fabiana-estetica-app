import type { Metadata } from "next";
import { PackageTemplateForm } from "../../_components/PackageTemplateForm";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { serviceOptions } from "../../_components/service-options";
import { createPackageTemplate } from "../../actions";

export const metadata: Metadata = { title: "Nuovo pacchetto" };

export default async function NuovoPacchettoPage() {
  const services = await serviceOptions();
  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Nuovo pacchetto" />
      <PackageTemplateForm
        action={createPackageTemplate}
        services={services}
        initial={{ name: "", sessions: "", price: "", serviceId: "", active: true }}
        submitLabel="Crea pacchetto"
      />
    </div>
  );
}
