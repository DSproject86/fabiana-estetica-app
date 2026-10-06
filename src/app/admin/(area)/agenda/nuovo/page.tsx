import type { Metadata } from "next";
import Link from "next/link";
import { BackHeader } from "@/components/admin/BackHeader";
import { prisma } from "@/lib/db";
import { parsePickerParams, pickerQuery } from "@/lib/agenda/params";
import { adminCalendar, loadAdminCatalog } from "@/lib/agenda/picker";
import { notifyByDefault } from "@/lib/agenda/rules";
import { roundUpTo } from "@/lib/availability/duration";
import { loadSettings } from "@/lib/availability/queries";
import { MAX_SERVICES_PER_BOOKING } from "@/lib/availability/services";
import { monthOf } from "@/lib/booking/calendar";
import { formatPhone } from "@/lib/clients/phone";
import { searchClients } from "@/lib/clients/adminClients";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { formatDayLong, formatTime, instantAt, timeToMinutes, todayKey } from "@/lib/time/rome";
import { createAppointmentAction } from "../actions";
import { ConfirmForm } from "../_components/ConfirmForm";
import { NewClientForm } from "../_components/NewClientForm";
import { Planner } from "../_components/Planner";

export const metadata: Metadata = { title: "Nuovo appuntamento" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NuovoAppuntamentoPage({ searchParams }: { searchParams: SearchParams }) {
  const choice = parsePickerParams(await searchParams);
  const now = new Date();
  const client = choice.client
    ? await prisma.client.findFirst({
        where: { id: choice.client, anonymizedAt: null },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, blockedAt: true, allergyNotes: true },
      })
    : null;

  if (!client) {
    const results = await searchClients(choice.q);
    return (
      <div className="flex flex-col gap-6">
        <BackHeader back={{ href: "/admin/agenda", label: "Agenda" }} title="Nuovo appuntamento" description="Per chi è?" />

        <section aria-labelledby="cerca" className="flex flex-col gap-3">
          <h2 id="cerca" className="text-xl">Cerca una cliente</h2>
          <form method="get" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={choice.q}
              placeholder="Nome, cognome, cellulare o email"
              aria-label="Cerca una cliente"
              autoFocus
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-prugna/15 bg-white px-4 text-base"
            />
            <button type="submit" className="min-h-12 rounded-full bg-prugna px-5 text-sm font-medium text-avorio">
              Cerca
            </button>
          </form>
          {results.length > 0 ? (
            <ul className="flex flex-col divide-y divide-prugna/10 overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
              {!choice.q ? <li className="px-4 py-2 text-xs text-prugna/50">Ultime clienti</li> : null}
              {results.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/agenda/nuovo${pickerQuery({ client: c.id })}`}
                    className="flex min-h-14 flex-col justify-center px-4 py-2 hover:bg-cipria/15"
                  >
                    <span className="font-medium">
                      {c.firstName} {c.lastName}
                      {c.blockedAt ? <span className="ml-2 text-xs font-normal text-red-800">bloccata</span> : null}
                    </span>
                    <span className="text-sm text-prugna/60">
                      {formatPhone(c.phone)}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : choice.q ? (
            <p className="text-sm text-prugna/60">Nessuna cliente trovata: creala qui sotto.</p>
          ) : null}
        </section>

        <section aria-labelledby="nuova" className="flex flex-col gap-3">
          <h2 id="nuova" className="text-xl">Oppure crea una nuova cliente</h2>
          <NewClientForm />
        </section>
      </div>
    );
  }

  const [settings, categories] = await Promise.all([loadSettings(), loadAdminCatalog()]);
  const byId = new Map(categories.flatMap((c) => c.services).map((s) => [s.id, s]));
  const services = choice.services.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const validChoice = { ...choice, services: services.map((s) => s.id) };
  const noBuffer = choice.noBuffer ?? false;
  const bufferMin = noBuffer ? 0 : settings.bufferMin;
  const durationMin = roundUpTo(services.reduce((sum, s) => sum + s.durationMin, 0), settings.durationRoundingMin);
  const totalCents = services.reduce((sum, s) => sum + s.priceCents, 0);
  const tooMany = services.length > MAX_SERVICES_PER_BOOKING;

  const month = choice.month ?? (choice.day ? monthOf(choice.day) : monthOf(todayKey(now)));
  const calendar = await adminCalendar({
    month,
    day: choice.day,
    durationMin: tooMany ? 0 : durationMin,
    bufferMin,
    gridMin: settings.slotGridMin,
    outside: choice.outside,
    now,
  });

  const notices: string[] = [];
  if (tooMany) notices.push(`Al massimo ${MAX_SERVICES_PER_BOOKING} servizi per appuntamento.`);
  const minutes = choice.time ? timeToMinutes(choice.time) : null;
  const timeOk =
    !!calendar.day && minutes !== null && services.length > 0 && !tooMany && (choice.outside || calendar.slots.includes(choice.time!));
  if (choice.time && calendar.day && !timeOk && services.length > 0 && !choice.outside) {
    notices.push(`Le ${choice.time} non sono libere con questi servizi: scegli un altro orario.`);
  }
  const startsAt = timeOk ? instantAt(calendar.day!, minutes!) : null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <BackHeader back={{ href: "/admin/agenda", label: "Agenda" }} title="Nuovo appuntamento" />

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-prugna/5">
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">
            {client.firstName} {client.lastName}
            {client.blockedAt ? <span className="ml-2 text-xs font-normal text-red-800">bloccata online</span> : null}
          </span>
          <span className="text-sm text-prugna/60">
            {formatPhone(client.phone)}
            {client.email ? ` · ${client.email}` : " · senza email"}
          </span>
          {settings.showAllergyNotes && client.allergyNotes ? <span className="text-xs text-red-800">Allergie: {client.allergyNotes}</span> : null}
        </span>
        <Link href="/admin/agenda/nuovo" className="shrink-0 rounded-full px-3 py-2 text-sm text-prugna/70 hover:bg-cipria/20">
          Cambia
        </Link>
      </div>

      <Planner
        basePath="/admin/agenda/nuovo"
        choice={{ ...validChoice, month: calendar.month }}
        categories={categories}
        roundingMin={settings.durationRoundingMin}
        bufferMin={settings.bufferMin}
        noBufferDefault={false}
        calendar={services.length > 0 ? calendar : undefined}
        notices={notices}
      >
        {startsAt ? (
          <ConfirmForm
            key={`${startsAt.toISOString()}-${validChoice.services.join()}-${noBuffer}`}
            action={createAppointmentAction}
            hidden={{
              cliente: client.id,
              s: validChoice.services.join(","),
              giorno: calendar.day!,
              ora: choice.time!,
              pausa: noBuffer ? "no" : "si",
              fuori: choice.outside ? "1" : "",
            }}
            title="Riepilogo"
            lines={[
              `${client.firstName} ${client.lastName}`,
              `${formatDayLong(calendar.day!)}, ${formatTime(startsAt)}–${formatTime(new Date(startsAt.getTime() + durationMin * 60_000))}`,
              services.map((s) => s.name).join(", "),
              `${formatDuration(durationMin)} · ${formatEuro(totalCents)} · ${noBuffer ? "senza pausa" : `pausa ${bufferMin} min`}`,
            ]}
            submitLabel="Conferma appuntamento"
            email={
              client.email
                ? { label: "Invia email di conferma", defaultChecked: notifyByDefault(startsAt, client.email, now), address: client.email }
                : null
            }
            noEmailNote="La cliente non ha l'email: dopo potrai mandarle la conferma su WhatsApp."
            outside={choice.outside}
          />
        ) : services.length === 0 ? null : (
          <p className="text-sm text-prugna/60">Scegli giorno e orario per confermare.</p>
        )}
      </Planner>
    </div>
  );
}
