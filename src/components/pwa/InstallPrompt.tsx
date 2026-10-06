"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { brand } from "@/config/brand";

/**
 * Riquadro "Aggiungi alla schermata Home" per le clienti collegate, finché non hanno installato l'app.
 * - iPhone/iPad: istruzioni (Condividi → Aggiungi alla schermata Home);
 * - Android: pulsante "Installa" quando il browser lo permette, altrimenti istruzioni dal menu ⋮.
 * Chiuso con la ×, ricompare dopo 30 giorni. Non compare se l'app è già aperta dalla schermata Home.
 */

const DISMISS_KEY = "fl-install-dismissed";
const INSTALLED_KEY = "fl-install-done";
const DISMISS_DAYS = 30;

type Platform = "ios" | "android";
/** Cosa mostrare all'apertura: "blocked" = già installata, aperta dalla Home o chiusa da poco. */
type Initial = Platform | "other" | "blocked";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Navigazione privata o memoria bloccata: il riquadro tornerà alla prossima visita.
  }
}

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Calcolato solo nel browser (sul server non si sa nulla): niente differenze all'idratazione. */
function initialState(): Initial {
  if (isStandalone() || read(INSTALLED_KEY)) return "blocked";
  const dismissedAt = Number(read(DISMISS_KEY) ?? 0);
  if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60_000) return "blocked";
  return detectPlatform() ?? "other";
}
const noSubscribe = () => () => {};

export function InstallPrompt() {
  const initial = useSyncExternalStore<Initial | null>(noSubscribe, initialState, () => null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isStandalone()) write(INSTALLED_KEY, "1");
    const onPrompt = (e: Event) => {
      e.preventDefault(); // niente mini-barra del browser: usiamo il nostro pulsante
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      write(INSTALLED_KEY, "1");
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || initial === null || initial === "blocked") return null;
  // Computer o browser sconosciuto: solo se il browser offre l'installazione.
  const platform: Platform | null = initial === "other" ? (installEvent ? "android" : null) : initial;
  if (!platform) return null;

  const close = () => {
    write(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === "accepted") {
      write(INSTALLED_KEY, "1");
      setHidden(true);
    }
  };

  return (
    <aside aria-labelledby="install-title" className="relative flex flex-col gap-2 rounded-3xl bg-cipria/20 p-5 pr-12 ring-1 ring-cipria/40">
      <button
        type="button"
        onClick={close}
        aria-label="Chiudi"
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-prugna/60 hover:bg-white/60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <h2 id="install-title" className="text-lg">
        Aggiungi l&apos;app alla schermata Home
      </h2>
      <p className="text-sm text-prugna/75">Così trovi {brand.name} tra le tue app e prenoti con un tocco.</p>

      {platform === "ios" ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>
            Tocca <ShareIcon /> <strong className="font-medium">Condividi</strong> nella barra di Safari
          </li>
          <li>
            Scorri e scegli <strong className="font-medium">Aggiungi alla schermata Home</strong>
          </li>
          <li>
            Tocca <strong className="font-medium">Aggiungi</strong>
          </li>
        </ol>
      ) : installEvent ? (
        <button
          type="button"
          onClick={install}
          className="mt-1 inline-flex min-h-11 w-fit items-center rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90"
        >
          Installa l&apos;app
        </button>
      ) : (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>
            Tocca il menu <strong className="font-medium">⋮</strong> in alto a destra del browser
          </li>
          <li>
            Scegli <strong className="font-medium">Installa app</strong> oppure{" "}
            <strong className="font-medium">Aggiungi a schermata Home</strong>
          </li>
        </ol>
      )}
    </aside>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      className="inline-block align-[-2px]"
    >
      <path d="M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8" />
    </svg>
  );
}
