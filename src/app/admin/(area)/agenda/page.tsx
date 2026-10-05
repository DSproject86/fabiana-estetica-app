import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return <PagePlaceholder title="Agenda" description="Gli appuntamenti da oggi a fine mese, giorno per giorno." step={7} />;
}
