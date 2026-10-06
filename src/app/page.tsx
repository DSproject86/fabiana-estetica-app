import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton, linkButtonClass } from "@/components/client/ClientShell";
import { getCurrentClient } from "@/lib/auth/client";

export default async function HomePage() {
  const client = await getCurrentClient();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <Logo width={220} />
      {client ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl">Ciao {client.firstName}</h1>
            <p className="text-prugna/75">Cosa vuoi fare oggi?</p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <Link href="/prenota" className={linkButtonClass.primary}>
              Prenota
            </Link>
            <Link href="/appuntamenti" className={linkButtonClass.secondary}>
              I miei appuntamenti
            </Link>
          </div>
          <LogoutButton />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl">Benvenuta</h1>
            <p className="text-prugna/75">
              L&apos;accesso è riservato alle clienti di Fabiana, solo su invito. Per iscriverti usa il link che ti ha
              mandato Fabiana; se sei già iscritta, accedi con la tua email.
            </p>
          </div>
          <Link href="/accedi" className={`${linkButtonClass.primary} w-full`}>
            Accedi
          </Link>
        </>
      )}
      <Link href="/admin/login" className="text-xs text-prugna/50 underline-offset-4 hover:underline">
        Area riservata
      </Link>
    </main>
  );
}
