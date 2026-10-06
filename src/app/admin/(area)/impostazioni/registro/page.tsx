import type { Metadata } from "next";
import type { NotificationStatus } from "@prisma/client";
import { BackHeader } from "@/components/admin/BackHeader";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { MESSAGE_KIND_LABEL } from "@/lib/notifications/defaults";
import { dayKeyOf, formatDayShort, formatTime } from "@/lib/time/rome";

export const metadata: Metadata = { title: "Registro invii" };
export const dynamic = "force-dynamic";

const LIMIT = 100;

const STATUS: Record<NotificationStatus, { label: string; className: string }> = {
  SENT: { label: "Inviata", className: "bg-salvia/30" },
  PENDING: { label: "In corso", className: "bg-oro/20" },
  FAILED: { label: "Non riuscita", className: "bg-red-800 text-white" },
  SKIPPED: { label: "Non inviata", className: "bg-red-800/80 text-white" },
};

export default async function RegistroPage() {
  await requireAdmin();
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      kind: true,
      channel: true,
      recipient: true,
      status: true,
      error: true,
      isTest: true,
      createdAt: true,
      sentAt: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });
  const failed = logs.filter((l) => l.status === "FAILED" || l.status === "SKIPPED").length;

  return (
    <div className="flex flex-col gap-8">
      <BackHeader
        back={{ href: "/admin/impostazioni", label: "Impostazioni" }}
        title="Registro invii"
        description={`Gli ultimi ${LIMIT} invii automatici, dal più recente.`}
      />

      {failed > 0 ? (
        <p role="status" className="rounded-xl bg-red-800/10 px-4 py-3 text-sm text-red-900">
          {failed === 1 ? "1 invio non riuscito" : `${failed} invii non riusciti`} in questo elenco.
        </p>
      ) : null}

      {logs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
          Ancora nessun invio.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-prugna/10 rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
          {logs.map((log) => {
            const problem = log.status === "FAILED" || log.status === "SKIPPED";
            const status = STATUS[log.status];
            return (
              <li
                key={log.id}
                className={`flex flex-col gap-1 px-4 py-3 ${problem ? "border-l-4 border-red-800 bg-red-800/5" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm tabular-nums text-prugna/60">
                    {formatDayShort(dayKeyOf(log.createdAt))} {formatTime(log.createdAt)}
                  </span>
                  <span className="font-medium">{MESSAGE_KIND_LABEL[log.kind]}</span>
                  {log.channel === "WHATSAPP" ? <span className="text-xs text-prugna/60">WhatsApp</span> : null}
                  {log.isTest ? <span className="rounded-full bg-oro/20 px-2 py-0.5 text-xs">prova</span> : null}
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <span className="text-sm break-all text-prugna/80">
                  {log.client ? `${log.client.firstName} ${log.client.lastName} · ` : ""}
                  {log.recipient}
                </span>
                {problem && log.error ? <span className="text-sm text-red-900">Motivo: {log.error}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
