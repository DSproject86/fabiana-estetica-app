import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ServiceForm } from "../../_components/ServiceForm";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { createService } from "../../actions";

export const metadata: Metadata = { title: "Nuovo servizio" };

export default async function NuovoServizioPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const categories = await prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <SubPageHeader title="Nuovo servizio" />
        <p className="text-prugna/70">
          Prima crea almeno una categoria.{" "}
          <Link href="/admin/listino/categorie/nuova" className="underline underline-offset-4">
            Nuova categoria
          </Link>
        </p>
      </div>
    );
  }

  const categoryId = categories.some((c) => c.id === categoria) ? categoria! : categories[0].id;

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Nuovo servizio" />
      <ServiceForm
        action={createService}
        categories={categories}
        initial={{ categoryId, name: "", description: "", durationMin: "", price: "", active: true }}
        submitLabel="Crea servizio"
      />
    </div>
  );
}
