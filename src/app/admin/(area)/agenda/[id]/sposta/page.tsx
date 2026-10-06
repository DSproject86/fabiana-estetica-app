import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { parsePickerParams } from "@/lib/agenda/params";
import { adminCalendar } from "@/lib/agenda/picker";
import { loadAgendaAppointment } from "@/lib/agenda/queries";
import { canEdit, notifyByDefault, treatmentEndOf } from "@/lib/agenda/rules";
import { loadSettings } from "@/lib/availability/queries";
import { monthOf } from "@/lib/booking/calendar";
import { formatDuration } from "@/lib/duration";
import { dayKeyOf, formatDayLong, formatTime, instantAt, timeToMinutes } from "@/lib/time/rome";
import { moveAppointmentAction } from "../../actions";
import { ConfirmForm } from "../../_components/ConfirmForm";
import { Planner } from "../../_components/Planner";

export const metadata: Metadata = { title: "Sposta appuntamento" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SpostaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const [appt, settings] = await Promise.all([loadAgendaAppointment(id), loadSettings()]);
  if (!appt) notFound();
  const choice = parsePickerParams(await searchParams);
  const now = new Date();
  const back = { href: `/admin/agenda?mese=${monthOf(dayKeyOf(appt.startsAt))}#giorno-${dayKeyOf(appt.startsAt)}`, label: "Agenda" };
  const who = `${appt.client.firstName} ${appt.client.lastName}`;
  const current = `${formatDayLong(dayKeyOf(appt.startsAt))}, ${formatTime(appt.startsAt)}–${formatTime(treatmentEndOf(appt))}`;

  if (!canEdit(appt)) {
    return (
      <div className="flex flex-col gap-6">
        <BackHeader back={back} title="Sposta appuntamento" />
        <p className="rounded-2xl bg-white p-4 text-sm ring-1 ring-prugna/5">
          Si possono spostare solo gli appuntamenti confermati e non ancora segnati come Fatti.
        </p>
      </div>
    );
  }

  const noBufferDefault = appt.bufferMin === 0;
  const noBuffer = choice.noBuffer ?? noBufferDefault;
  const bufferMin = noBuffer ? 0 : appt.bufferMin > 0 ? appt.bufferMin : settings.bufferMin;
  const month = choice.month ?? (choice.day ? monthOf(choice.day) : monthOf(dayKeyOf(appt.startsAt)));
  const calendar = await adminCalendar({
    month,
    day: choice.day,
    durationMin: appt.durationMin,
    bufferMin,
    gridMin: settings.slotGridMin,
    outside: choice.outside,
    excludeAppointmentId: appt.id,
    now,
  });

  const minutes = choice.time ? timeToMinutes(choice.time) : null;
  const timeOk = !!calendar.day && minutes !== null && (choice.outside || calendar.slots.includes(choice.time!));
  const notices: string[] = [];
  if (choice.time && calendar.day && !timeOk && !choice.outside) notices.push(`Le ${choice.time} non sono libere: scegli un altro orario.`);
  const startsAt = timeOk ? instantAt(calendar.day!, minutes!) : null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <BackHeader back={back} title="Sposta appuntamento" />
      <div className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-prugna/5">
        <p className="font-medium">{who}</p>
        <p className="text-prugna/70 first-letter:uppercase">Ora: {current}</p>
        <p className="text-prugna/70">
          {appt.items.map((i) => i.name).join(", ")} · {formatDuration(appt.durationMin)}
        </p>
      </div>

      <Planner
        basePath={`/admin/agenda/${appt.id}/sposta`}
        choice={{ ...choice, month: calendar.month }}
        roundingMin={settings.durationRoundingMin}
        bufferMin={appt.bufferMin > 0 ? appt.bufferMin : settings.bufferMin}
        noBufferDefault={noBufferDefault}
        calendar={calendar}
        notices={notices}
      >
        {startsAt ? (
          <ConfirmForm
            key={`${startsAt.toISOString()}-${noBuffer}`}
            action={moveAppointmentAction}
            hidden={{
              id: appt.id,
              giorno: calendar.day!,
              ora: choice.time!,
              pausa: noBuffer ? "no" : "si",
              fuori: choice.outside ? "1" : "",
            }}
            title="Nuovo orario"
            lines={[
              who,
              `Prima: ${current}`,
              `Dopo: ${formatDayLong(calendar.day!)}, ${formatTime(startsAt)}–${formatTime(new Date(startsAt.getTime() + appt.durationMin * 60_000))}`,
              noBuffer ? "Senza pausa" : `Pausa ${bufferMin} min`,
            ]}
            submitLabel="Sposta"
            email={
              appt.client.email
                ? {
                    label: "Avvisa per email (con l'evento aggiornato)",
                    defaultChecked: notifyByDefault(startsAt, appt.client.email, now),
                    address: appt.client.email,
                  }
                : null
            }
            noEmailNote="La cliente non ha l'email: dopo lo spostamento potrai avvisarla su WhatsApp."
            outside={choice.outside}
          />
        ) : (
          <p className="text-sm text-prugna/60">Scegli il nuovo giorno e l&apos;orario.</p>
        )}
      </Planner>
    </div>
  );
}
