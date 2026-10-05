import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Pacchetti" };

export default function PacchettiPage() {
  return <PagePlaceholder title="Pacchetti" description="Pacchetti massaggi delle clienti e pagamenti." step={8} />;
}
