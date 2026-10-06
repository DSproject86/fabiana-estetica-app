import type { Metadata } from "next";
import { WhatsAppButton } from "@/components/admin/WhatsAppButton";
import { requireAdmin } from "@/lib/auth/admin";
import { loadSettings } from "@/lib/availability/queries";
import { prisma } from "@/lib/db";
import { appointmentInfoSelect } from "@/lib/notifications/context";
import {
  NOT_PLANNED_LABEL,
  canRetryReminder,
  reminderEmailState,
  reminderTargetDay,
  type ReminderEmailState,
} from "@/lib/notifications/reminderRules";
import { latestReminderLogs } from "@/lib/notifications/reminders";
import { loadWhatsappLinkBuilder } from "@/lib/notifications/whatsappLinks";
import { dayBounds, formatDayLong, formatTime, minutesToTime } from "@/lib/time/rome";
import { RetryReminderButton, WhatsappSentToggle } from "./ReminderControls";

export const metadata: Metadata = { title: "Promemoria di domani" };
export const dynamic = "force-dynamic";

export default async function PromemoriaPage() {
  await requireAdmin();
  const now = new Date();
  const day = reminderTargetDay(now);
  const { start, end } = dayBounds(day);

  const [appointments, settings, whatsappLink] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: "CONFIRMED", startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: "asc" },
      select: appointmentInfoSelect,
    }),
    loadSettings(),
    loadWhatsappLinkBuilder(),
  ]);
  const logs = await latestReminderLogs(appointments.map((a) => a.id));
  const reminderTime = minutesToTime(settings.reminderHour * 60);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">Promemoria di domani</h1>
        <p className="text-prugna/70 first-letter:uppercase">{formatDayLong(day)}</p>
        <p className="text-sm text-prugna/60">
          Le email partono da sole dalle {reminderTime}. Da qui puoi mandare anche il WhatsApp e segnarlo come inviato.
        </p>
      </header>

      {appointments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
          Nessun appuntamento domani.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-prugna/10 rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
          {appointments.map((a) => {
            const subject = { ...a, clientEmail: a.client.email };
            const state = reminderEmailState(subject, logs.get(a.id) ?? null, settings.reminderHour, now);
            return (
              <li key={a.id} className={`flex flex-col gap-3 px-4 py-4 ${a.whatsappSentAt ? "bg-salvia/10" : ""}`}>
                <div className="flex gap-4">
                  <span className="w-14 shrink-0 font-medium tabular-nums">{formatTime(a.startsAt)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {a.client.firstName} {a.client.lastName}
                    </span>
                    <span className="text-sm text-prugna/70">{a.items.map((i) => i.name).join(" · ")}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-18">
                  <WhatsAppButton compact href={whatsappLink("REMINDER", a)} label="Promemoria" />
                  <WhatsappSentToggle appointmentId={a.id} sent={!!a.whatsappSentAt} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-18 text-sm">
                  <EmailStatus state={state} reminderTime={reminderTime} />
                  {canRetryReminder(state, subject, now) ? <RetryReminderButton appointmentId={a.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmailStatus({ state, reminderTime }: { state: ReminderEmailState; reminderTime: string }) {
  switch (state.state) {
    case "SENT":
      return <span className="text-prugna/80">✓ Email inviata alle {formatTime(state.at)}</span>;
    case "FAILED":
      return (
        <span className="font-medium text-red-800">
          Email non riuscita <span className="font-normal">({state.error})</span>
        </span>
      );
    case "SENDING":
      return <span className="text-prugna/70">Email in invio…</span>;
    case "SCHEDULED":
      return <span className="text-prugna/70">Email: partirà alle {reminderTime}</span>;
    case "DUE":
      return <span className="text-prugna/70">Email: partirà al prossimo invio automatico</span>;
    case "NOT_PLANNED":
      return <span className="text-prugna/50">{NOT_PLANNED_LABEL[state.reason]}</span>;
  }
}
