"use client";

import { useEffect } from "react";

/** Registra il service worker (solo in produzione: in sviluppo darebbe pagine vecchie). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Senza service worker l'app funziona lo stesso: manca solo la pagina "Sei offline".
    });
  }, []);
  return null;
}
