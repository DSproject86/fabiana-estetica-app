import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Listino" };

export default function ListinoPage() {
  return <PagePlaceholder title="Listino" description="Categorie, servizi e pacchetti a listino." step={2} />;
}
