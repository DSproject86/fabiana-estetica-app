import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/clients/phone";
import { appBaseUrl, getActiveInvite } from "@/lib/invite/invite";
import { dayKeyOf, formatDayShort } from "@/lib/time/rome";
import { AdminNotifyToggles } from "./AdminNotifyToggles";
import { AllergyToggle } from "./AllergyToggle";
import { ContactsForm } from "./ContactsForm";
import { InviteLinkCard } from "./InviteLinkCard";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage() {
  const [settings, invite, baseUrl, admins] = await Promise.all([
    prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    getActiveInvite(),
    appBaseUrl(),
    prisma.admin.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, notifyNewBooking: true },
    }),
  ]);
  const signups = invite ? await prisma.client.count({ where: { inviteLinkId: invite.id } }) : 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">Impostazioni</h1>
        <p className="text-prugna/70">Link d&apos;invito, contatti, messaggi e regole delle prenotazioni online.</p>
      </header>

      <section aria-labelledby="invito" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="invito" className="text-xl">Link d&apos;invito</h2>
          <p className="text-sm text-prugna/70">Le clienti si iscrivono solo da qui. Mandalo a chi vuoi far prenotare online.</p>
        </div>
        <InviteLinkCard
          url={invite ? `${baseUrl}/invito/${invite.token}` : null}
          signups={signups}
          createdLabel={invite ? formatDayShort(dayKeyOf(invite.createdAt)) : null}
        />
      </section>

      <section aria-labelledby="contatti" className="flex flex-col gap-4">
        <h2 id="contatti" className="text-xl">Contatti</h2>
        <ContactsForm
          businessWhatsapp={settings.businessWhatsapp ? formatPhone(settings.businessWhatsapp) : ""}
          businessAddress={settings.businessAddress ?? ""}
        />
        <AdminNotifyToggles admins={admins} />
      </section>

      <section aria-labelledby="schede" className="flex flex-col gap-3">
        <h2 id="schede" className="text-xl">Schede clienti</h2>
        <AllergyToggle enabled={settings.showAllergyNotes} />
      </section>

      <section aria-labelledby="messaggi" className="flex flex-col gap-3">
        <h2 id="messaggi" className="text-xl">Messaggi</h2>
        <NavCard
          href="/admin/impostazioni/messaggi"
          title="Testi di email e WhatsApp"
          description="Modifica oggetto e testo, guarda l'anteprima e manda un'email di prova."
        />
        <NavCard
          href="/admin/impostazioni/registro"
          title="Registro invii"
          description="Gli ultimi 100 invii, con quelli non riusciti in evidenza e il motivo."
        />
      </section>

      <section aria-labelledby="prenotazioni" className="flex flex-col gap-4">
        <h2 id="prenotazioni" className="text-xl">Prenotazioni</h2>
        <SettingsForm
          initial={{
            slotGridMin: settings.slotGridMin,
            durationRoundingMin: settings.durationRoundingMin,
            bufferMin: settings.bufferMin,
            minNoticeMin: settings.minNoticeMin,
            bookingHorizonMonths: settings.bookingHorizonMonths,
            reminderHour: settings.reminderHour,
          }}
        />
      </section>

      <NavCard
        href="/admin/impostazioni/anteprima"
        title="Anteprima disponibilità"
        description="Scegli dei servizi e vedi gli orari liberi come li vedrà una cliente."
      />
    </div>
  );
}

function NavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-prugna/5 hover:bg-cipria/10"
    >
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-prugna/60">{description}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
