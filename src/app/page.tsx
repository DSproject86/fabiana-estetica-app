import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <Logo width={220} />
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl">Benvenuta</h1>
        <p className="text-prugna/75">
          Le prenotazioni online sono riservate alle clienti di Fabiana. Per iscriverti usa il link
          personale che hai ricevuto.
        </p>
      </div>
      <Link href="/admin/login" className="text-xs text-prugna/50 underline-offset-4 hover:underline">
        Area riservata
      </Link>
    </main>
  );
}
