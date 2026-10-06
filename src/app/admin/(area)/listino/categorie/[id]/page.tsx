import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CategoryForm } from "../../_components/CategoryForm";
import { DeleteButton } from "../../_components/DeleteButton";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { deleteCategory, updateCategory } from "../../actions";

export const metadata: Metadata = { title: "Modifica categoria" };

export default async function ModificaCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await prisma.serviceCategory.findUnique({
    where: { id },
    include: { _count: { select: { services: true } } },
  });
  if (!category) notFound();

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Modifica categoria" />
      <CategoryForm
        action={updateCategory.bind(null, category.id)}
        initial={{ name: category.name, active: category.active }}
        submitLabel="Salva modifiche"
      />
      <div className="mt-4 border-t border-oro/20 pt-6">
        <DeleteButton
          action={deleteCategory.bind(null, category.id)}
          label="Elimina categoria"
          confirmMessage={`Eliminare la categoria "${category.name}"?`}
        />
        {category._count.services > 0 ? (
          <p className="mt-2 text-xs text-prugna/60">
            Si può eliminare solo quando è vuota (ora contiene {category._count.services}{" "}
            {category._count.services === 1 ? "servizio" : "servizi"}).
          </p>
        ) : null}
      </div>
    </div>
  );
}
