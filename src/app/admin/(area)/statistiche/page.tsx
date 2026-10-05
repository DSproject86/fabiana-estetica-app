import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Statistiche" };

export default function StatistichePage() {
  return <PagePlaceholder title="Statistiche" description="Incassi del mese e confronto col mese precedente." step={7} />;
}
