import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { parsePickerParams } from "@/lib/agenda/params";
import { loadAdminCatalog } from "@/lib/agenda/picker";
import { loadAgendaAppointment } from "@/lib/agenda/queries";
import { canEdit, mergeItems, notifyByDefault, treatmentEndOf } from "@/lib/agenda/rules";
import { roundUpTo } from "@/lib/availability/duration";
import { loadSettings } from "@/lib/availability/queries";
import { monthOf } from "@/lib/booking/calendar";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { dayKeyOf, formatDayLong, formatTime } from "@/lib/time/rome";
import { updateServicesAction } from "../../actions";
import { ConfirmForm } from "../../_components/ConfirmForm";
import { Planner } from "../../_components/Planner";

export const metadata: Metadata = { title: "Modifica servizi" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ServiziPage({ params, searchParams }: Props) {
  const { id } = await params;
  const [appt, settings, categories] = await Promise.all([loadAgendaAppointment(id), loadSettings(), loadAdminCatalog()]);
  if (!appt) notFound();
  const raw = await searchParams;
  const parsed = parsePickerParams(raw);
  const now = new Date();
  const day = dayKeyOf(appt.startsAt);
  const back = { href: `/admin/agenda?mese=${monthOf(day)}#giorno-${day}`, label: "Agenda" };
  const who = `${appt.client.firstName} ${appt.client.lastName}`;

  if (!canEdit(appt)) {
    return (
      <div className="flex flex-col gap-6">
        <BackHeader back={back} title="Modifica servizi" />
        <p className="rounded-2xl bg-white p-4 text-sm ring-1 ring-prugna/5">
          Si possono modificare solo gli appuntamenti confermati e non ancora segnati come Fatti.
        </p>
      </div>
    );
  }

  // Senza parametri si parte dai servizi attuali dell'appuntamento.
  const fresh = raw.s === undefined && raw.v === undefined;
  const byId = new Map(categories.flatMap((c) => c.services).map((s) => [s.id, s]));
  const currentServiceIds = appt.items.map((i) => i.serviceId).filter((s): s is string => !!s && byId.has(s));
  const orphans = appt.items.filter((i) => !i.serviceId || !byId.has(i.serviceId));
  const choice = fresh
    ? { ...parsed, services: currentServiceIds, keep: orphans.map((o) => o.id) }
    : { ...parsed, services: parsed.services.filter((s) => byId.has(s)), keep: parsed.keep.filter((k) => orphans.some((o) => o.id === k)) };

  const keptPrices = Object.fromEntries(
    appt.items.filter((i) => i.serviceId && byId.has(i.serviceId)).map((i) => [i.serviceId!, { durationMin: i.durationMin, priceCents: i.priceCents }]),
  );
  const items = mergeItems(
    appt.items,
    choice.services.map((sid) => byId.get(sid)!),
    choice.keep,
  );
  const noBufferDefault = appt.bufferMin === 0;
  const noBuffer = choice.noBuffer ?? noBufferDefault;
  const bufferMin = noBuffer ? 0 : appt.bufferMin > 0 ? appt.bufferMin : settings.bufferMin;
  const durationMin = roundUpTo(items.reduce((sum, i) => sum + i.durationMin, 0), settings.durationRoundingMin);
  const totalCents = items.reduce((sum, i) => sum + i.priceCents, 0);
  const end = new Date(appt.startsAt.getTime() + durationMin * 60_000);

  return (
    <div className="flex flex-col gap-6 pb-12">
      <BackHeader back={back} title="Modifica servizi" />
      <div className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-prugna/5">
        <p className="font-medium">{who}</p>
        <p className="text-prugna/70 first-letter:uppercase">
          {formatDayLong(day)}, {formatTime(appt.startsAt)}–{formatTime(treatmentEndOf(appt))}
        </p>
        <p className="text-prugna/70">
          Ora: {appt.items.map((i) => i.name).join(", ")} · {formatEuro(appt.totalPriceCents)}
        </p>
        <p className="mt-1 text-xs text-prugna/50">
          I servizi già presenti tengono prezzo e durata originali; quelli aggiunti prendono il prezzo attuale del listino.
        </p>
      </div>

      <Planner
        basePath={`/admin/agenda/${appt.id}/servizi`}
        choice={choice}
        categories={categories}
        orphans={orphans.map((o) => ({ id: o.id, name: o.name, durationMin: o.durationMin, priceCents: o.priceCents }))}
        keptPrices={keptPrices}
        roundingMin={settings.durationRoundingMin}
        bufferMin={appt.bufferMin > 0 ? appt.bufferMin : settings.bufferMin}
        noBufferDefault={noBufferDefault}
      >
        {items.length > 0 ? (
          <ConfirmForm
            key={`${choice.services.join()}-${choice.keep.join()}-${noBuffer}-${choice.outside}`}
            action={updateServicesAction}
            hidden={{
              id: appt.id,
              s: choice.services.join(","),
              v: choice.keep.join(","),
              pausa: noBuffer ? "no" : "si",
              fuori: choice.outside ? "1" : "",
            }}
            title="Riepilogo"
            lines={[
              items.map((i) => i.name).join(", "),
              `${formatTime(appt.startsAt)}–${formatTime(end)} · ${formatDuration(durationMin)} · ${noBuffer ? "senza pausa" : `pausa ${bufferMin} min`}`,
              `Totale ${formatEuro(totalCents)}${totalCents !== appt.totalPriceCents ? ` (prima ${formatEuro(appt.totalPriceCents)})` : ""}`,
            ]}
            submitLabel="Salva servizi"
            email={
              appt.client.email
                ? {
                    label: "Avvisa per email (con l'evento aggiornato)",
                    defaultChecked: notifyByDefault(appt.startsAt, appt.client.email, now),
                    address: appt.client.email,
                  }
                : null
            }
            outside={choice.outside}
          />
        ) : (
          <p className="text-sm text-prugna/60">Scegli almeno un servizio.</p>
        )}
      </Planner>
    </div>
  );
}
