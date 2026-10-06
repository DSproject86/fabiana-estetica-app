import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { isValidDayKey, todayKey } from "@/lib/time/rome";
import { BlockForm } from "../../_components/BlockForm";
import { BackLink } from "../../_components/FormBits";
import { createBlock } from "../../actions";

export const metadata: Metadata = { title: "Blocca una fascia" };

export default async function NuovoBloccoPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  await requireAdmin();
  const { data } = await searchParams;
  const today = todayKey();
  const date = data && isValidDayKey(data) && data >= today ? data : today;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackLink href="/admin/orari?sezione=blocchi" label="Blocchi" />
        <h1 className="text-3xl">Blocca una fascia</h1>
        <p className="text-prugna/70">La fascia non sarà prenotabile. Gli appuntamenti già presi non vengono toccati.</p>
      </header>
      <BlockForm action={createBlock} today={today} initialDate={date} />
    </div>
  );
}
