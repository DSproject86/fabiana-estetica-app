import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { centsToInput, formatEuro } from "@/lib/money";
import { coverageOptions, loadPackage } from "@/lib/packages/queries";
import { encodeCoverage } from "@/lib/packages/rules";
import { todayKey } from "@/lib/time/rome";
import { updatePackageAction } from "../../actions";
import { PackageForm } from "../../_components/PackageForm";

export const metadata: Metadata = { title: "Modifica pacchetto" };

export default async function ModificaPacchettoClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, coverage] = await Promise.all([loadPackage(id), coverageOptions()]);
  if (!p) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackHeader
        back={{ href: `/admin/pacchetti/${p.id}`, label: p.name }}
        title="Modifica pacchetto"
        description={`${p.client.firstName} ${p.client.lastName}`}
      />
      <PackageForm
        action={updatePackageAction.bind(null, p.id)}
        mode="edit"
        coverage={coverage}
        initial={{
          name: p.name,
          totalSessions: String(p.totalSessions),
          price: centsToInput(p.priceCents),
          coverage: encodeCoverage(p),
          sessionsUsedBefore: String(p.sessionsUsedBefore),
          notes: p.notes ?? "",
        }}
        today={todayKey()}
        cancelHref={`/admin/pacchetti/${p.id}`}
      />
      <p className="text-xs text-prugna/60">
        Sedute e prezzo non possono scendere sotto quanto già usato e pagato ({p.summary.usedSessions} sedute,{" "}
        {formatEuro(p.summary.paidCents)}).
      </p>
    </div>
  );
}
