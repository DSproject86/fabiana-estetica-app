import type { Metadata } from "next";
import { getCurrentClient } from "@/lib/auth/client";
import { ClientShell, PageTitle, cardClass } from "@/components/client/ClientShell";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const client = await getCurrentClient();

  return (
    <ClientShell loggedIn={!!client}>
      <div role="note" className="rounded-2xl border border-oro/60 bg-oro/15 p-4 text-sm">
        <p className="font-semibold">Testo provvisorio</p>
        <p className="text-prugna/80">
          Questa informativa è una bozza, valida per il periodo di prova. Prima del lancio verrà sostituita dal testo
          definitivo.
        </p>
      </div>

      <PageTitle title="Informativa sulla privacy" />

      <div className={`${cardClass} flex flex-col gap-4 text-[15px] leading-relaxed`}>
        <section className="flex flex-col gap-1">
          <h2 className="text-lg">Chi tratta i dati</h2>
          <p>{brand.fullName} (Fabiana L.), titolare del trattamento.</p>
        </section>
        <section className="flex flex-col gap-1">
          <h2 className="text-lg">Quali dati</h2>
          <p>Nome, cognome, cellulare, email, appuntamenti prenotati e servizi scelti.</p>
        </section>
        <section className="flex flex-col gap-1">
          <h2 className="text-lg">Perché</h2>
          <p>
            Per gestire le prenotazioni: inviarti il codice di accesso, confermare gli appuntamenti, ricordarteli e
            contattarti in caso di cambiamenti. I dati non vengono ceduti a terzi né usati per pubblicità.
          </p>
        </section>
        <section className="flex flex-col gap-1">
          <h2 className="text-lg">Dove</h2>
          <p>
            I dati sono conservati su servizi cloud usati per far funzionare l&apos;app (database, hosting, invio
            email).
          </p>
        </section>
        <section className="flex flex-col gap-1">
          <h2 className="text-lg">I tuoi diritti</h2>
          <p>
            Puoi chiedere in ogni momento di vedere, correggere o cancellare i tuoi dati scrivendo direttamente a
            Fabiana.
          </p>
        </section>
      </div>
    </ClientShell>
  );
}
