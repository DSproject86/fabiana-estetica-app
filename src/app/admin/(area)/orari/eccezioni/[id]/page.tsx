import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { dbDateToDayKey, minutesToTime, todayKey } from "@/lib/time/rome";
import { DeleteExceptionButton } from "../../_components/DeleteExceptionButton";
import { ExceptionForm } from "../../_components/ExceptionForm";
import { BackLink } from "../../_components/FormBits";
import { deleteException, saveException } from "../../actions";

export const metadata: Metadata = { title: "Modifica eccezione" };

export default async function ModificaEccezionePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const override = await prisma.dateOverride.findUnique({
    where: { id },
    include: { slots: { orderBy: { startMinute: "asc" } } },
  });
  if (!override) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackLink href="/admin/orari?sezione=eccezioni" label="Eccezioni" />
        <h1 className="text-3xl">Modifica eccezione</h1>
      </header>
      <ExceptionForm
        action={saveException.bind(null, override.id)}
        minDate={todayKey()}
        initial={{
          date: dbDateToDayKey(override.date),
          closed: override.closed,
          note: override.note ?? "",
          slots: override.slots.map((s) => ({ start: minutesToTime(s.startMinute), end: minutesToTime(s.endMinute) })),
        }}
        submitLabel="Salva modifiche"
      />
      <div className="mt-2 border-t border-oro/20 pt-6">
        <DeleteExceptionButton action={deleteException.bind(null, override.id)} />
      </div>
    </div>
  );
}
