import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Clienti" };

export default function ClientiPage() {
  return <PagePlaceholder title="Clienti" description="Elenco clienti, storico e note." step={8} />;
}
