import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Sei offline", robots: { index: false } };

// Pagina statica tenuta in cache dal service worker (public/sw.js): compare quando manca la connessione.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <Logo width={180} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">Sei offline</h1>
        <p className="text-prugna/75">
          Per vedere gli orari e prenotare serve la connessione. Controlla il Wi-Fi o i dati mobili e riprova.
        </p>
      </div>
      {/* Un link normale (ricarica intera): offline il JavaScript della pagina potrebbe non esserci. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-prugna px-6 font-medium text-avorio hover:bg-prugna/90"
      >
        Riprova
      </a>
    </main>
  );
}
