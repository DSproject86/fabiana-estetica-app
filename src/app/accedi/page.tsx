import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientShell, PageTitle, cardClass } from "@/components/client/ClientShell";
import { getCurrentClient, getPendingLogin } from "@/lib/auth/client";
import { CODE_TTL_MIN } from "@/lib/auth/loginCode";
import { CodeForm, EmailForm } from "./AccessForms";

export const metadata: Metadata = { title: "Accedi", robots: { index: false } };

export default async function AccediPage() {
  if (await getCurrentClient()) redirect("/");
  const pendingEmail = await getPendingLogin();

  return (
    <ClientShell loggedIn={false}>
      {pendingEmail ? (
        <>
          <PageTitle title="Controlla l'email" />
          <div className={`${cardClass} flex flex-col gap-5`}>
            <p className="text-prugna/80">
              Se <strong className="font-semibold break-all">{pendingEmail}</strong> è registrata, ti abbiamo inviato un
              codice di 6 cifre. Vale {CODE_TTL_MIN} minuti. Se non lo trovi, guarda anche nello spam.
            </p>
            <CodeForm />
          </div>
        </>
      ) : (
        <>
          <PageTitle
            title="Accedi"
            subtitle="Ti mandiamo un codice via email: niente password da ricordare."
          />
          <div className={cardClass}>
            <EmailForm />
          </div>
          <p className="text-center text-sm text-prugna/60">
            Non sei ancora iscritta? L&apos;accesso è solo su invito: chiedi il link a Fabiana.
          </p>
        </>
      )}
    </ClientShell>
  );
}
