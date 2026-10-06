import type { Metadata } from "next";
import Link from "next/link";
import { BackHeader } from "@/components/admin/BackHeader";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { DEFAULT_TEMPLATES, MESSAGE_KIND_LABEL, TEMPLATE_LIST, templateKey } from "@/lib/notifications/defaults";
import type { TemplateChannel, TemplateKind } from "@/lib/notifications/placeholders";
import { TEST_EMAIL_KINDS } from "@/lib/notifications/testEmail";
import { TestEmailForm } from "./TestEmailForm";

export const metadata: Metadata = { title: "Messaggi" };

export default async function MessaggiPage() {
  const admin = await requireAdmin();
  const stored = await prisma.messageTemplate.findMany({ select: { kind: true, channel: true, subject: true, body: true } });
  const storedByKey = new Map(stored.map((t) => [templateKey(t.kind as TemplateKind, t.channel as TemplateChannel), t]));

  const groups = [
    { channel: "EMAIL" as const, title: "Email", note: "Partono da sole. Sotto il testo c'è sempre il riquadro con i dettagli dell'appuntamento." },
    { channel: "WHATSAPP" as const, title: "WhatsApp", note: "Testi già scritti per i pulsanti WhatsApp: l'invio resta manuale." },
  ];

  return (
    <div className="flex flex-col gap-8">
      <BackHeader
        back={{ href: "/admin/impostazioni", label: "Impostazioni" }}
        title="Messaggi"
        description="Testi delle email automatiche e dei messaggi WhatsApp."
      />

      {groups.map((group) => (
        <section key={group.channel} aria-labelledby={`g-${group.channel}`} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id={`g-${group.channel}`} className="text-xl">
              {group.title}
            </h2>
            <p className="text-sm text-prugna/60">{group.note}</p>
          </div>
          <ul className="flex flex-col divide-y divide-prugna/10 rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
            {TEMPLATE_LIST.filter((t) => t.channel === group.channel).map((t) => {
              const key = templateKey(t.kind, t.channel);
              const current = storedByKey.get(key);
              const fallback = DEFAULT_TEMPLATES[key];
              const customized =
                current && fallback && (current.subject !== fallback.subject || current.body !== fallback.body);
              return (
                <li key={t.slug}>
                  <Link href={`/admin/impostazioni/messaggi/${t.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cipria/10">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">
                        {t.label}
                        {customized ? <span className="ml-2 text-xs font-normal text-oro">modificato</span> : null}
                      </span>
                      <span className="text-sm text-prugna/60">{t.hint}</span>
                    </span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <TestEmailForm
        adminEmail={admin.email}
        options={TEST_EMAIL_KINDS.map((kind) => ({ kind, label: MESSAGE_KIND_LABEL[kind] }))}
      />
    </div>
  );
}
