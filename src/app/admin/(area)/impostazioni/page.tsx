import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Impostazioni" };

export default function ImpostazioniPage() {
  return <PagePlaceholder title="Impostazioni" description="Parametri delle prenotazioni, link di invito e testi dei messaggi." step={3} />;
}
