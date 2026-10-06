import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { PackageTemplateForm } from "../../_components/PackageTemplateForm";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { coverageOptions } from "@/lib/packages/queries";
import { createPackageTemplate } from "../../actions";

export const metadata: Metadata = { title: "Nuovo pacchetto" };

export default async function NuovoPacchettoPage() {
  await requireAdmin();
  const coverage = await coverageOptions();
  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Nuovo pacchetto" />
      <PackageTemplateForm
        action={createPackageTemplate}
        coverage={coverage}
        initial={{ name: "", sessions: "", price: "", coverage: "", active: true }}
        submitLabel="Crea pacchetto"
      />
    </div>
  );
}
