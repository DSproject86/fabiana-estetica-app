import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { CategoryForm } from "../../_components/CategoryForm";
import { SubPageHeader } from "../../_components/SubPageHeader";
import { createCategory } from "../../actions";

export const metadata: Metadata = { title: "Nuova categoria" };

export default async function NuovaCategoriaPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="Nuova categoria" />
      <CategoryForm action={createCategory} submitLabel="Crea categoria" />
    </div>
  );
}
