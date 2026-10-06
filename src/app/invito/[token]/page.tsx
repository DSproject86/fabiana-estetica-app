import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientShell, PageTitle, cardClass } from "@/components/client/ClientShell";
import { brand } from "@/config/brand";
import { getCurrentClient } from "@/lib/auth/client";
import { findActiveInvite } from "@/lib/invite/invite";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Iscrizione", robots: { index: false } };

export default async function InvitoPage({ params }: { params: Promise<{ token: string }> }) {
  if (await getCurrentClient()) redirect("/");
  const { token } = await params;
  const link = await findActiveInvite(token);

  return (
    <ClientShell loggedIn={false}>
      {link ? (
        <>
          <PageTitle
            title="Benvenuta!"
            subtitle={`Iscriviti per prenotare online da ${brand.fullName}. Ci vuole un minuto.`}
          />
          <div className={cardClass}>
            <SignupForm token={token} />
          </div>
          <p className="text-center text-sm text-prugna/60">Già iscritta? Inserisci la tua email: ti mandiamo subito il codice.</p>
        </>
      ) : (
        <>
          <PageTitle title="Link non valido" />
          <div className={`${cardClass} flex flex-col gap-2`}>
            <p>Questo link non funziona più.</p>
            <p className="text-prugna/70">Chiedi a Fabiana quello nuovo: te lo manda in un attimo.</p>
          </div>
        </>
      )}
    </ClientShell>
  );
}
