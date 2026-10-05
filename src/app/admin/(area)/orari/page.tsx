import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Orari" };

export default function OrariPage() {
  return <PagePlaceholder title="Orari" description="Settimana tipo, eccezioni e blocchi rapidi." step={3} />;
}
