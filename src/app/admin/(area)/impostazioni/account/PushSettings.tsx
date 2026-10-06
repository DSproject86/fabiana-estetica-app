"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { detectPlatform, isStandalone } from "@/components/pwa/platform";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { disablePushAction, enablePushAction, removeDeviceAction, sendTestPushAction, type PushActionResult } from "./actions";

/**
 * "Notifiche su questo dispositivo": attiva/disattiva, prova ed elenco dei propri dispositivi.
 * Il permesso del browser si chiede solo al tocco di "Attiva notifiche".
 */

export type DeviceRow = { id: string; endpoint: string; name: string; createdLabel: string; lastUsedLabel: string | null };

type Support = "unsupported" | "ios-browser" | "ok";

function readSupport(): Support {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (detectPlatform() === "ios" && !isStandalone()) return "ios-browser"; // Safari: solo dall'icona della Home
  return supported ? "ok" : "unsupported";
}
const noSubscribe = () => () => {};

/** Chiave pubblica VAPID (base64url) → byte per pushManager.subscribe. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((x, i) => x === b[i]);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export function PushSettings({
  vapidPublicKey,
  suggestedName,
  devices,
}: {
  vapidPublicKey: string | null;
  suggestedName: string;
  devices: DeviceRow[];
}) {
  const support = useSyncExternalStore<Support | null>(noSubscribe, readSupport, () => null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [feedback, setFeedback] = useState<PushActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Stato attuale del browser: permesso e abbonamento già presente.
  useEffect(() => {
    if (support !== "ok") return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .catch(() => null)
      .then((sub) => {
        if (cancelled) return;
        setPermission(Notification.permission);
        setEndpoint(sub?.endpoint ?? null);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [support]);

  const run = useCallback(
    (fn: () => Promise<PushActionResult>) =>
      startTransition(async () => {
        setFeedback(null);
        try {
          setFeedback(await fn());
        } catch (error) {
          setFeedback({ error: error instanceof Error ? error.message : "Qualcosa non ha funzionato. Riprova." });
        }
      }),
    [],
  );

  const enable = () =>
    run(async () => {
      if (!vapidPublicKey) return { error: "Le notifiche non sono configurate sul server." };
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return { error: "Permesso non concesso: senza permesso le notifiche non possono arrivare." };
      const reg = await registration();
      const key = keyBytes(vapidPublicKey);
      let sub = await reg.pushManager.getSubscription();
      // Abbonamento fatto con chiavi vecchie (chiavi VAPID cambiate): si rifà.
      if (sub && !sameKey(sub.options.applicationServerKey, key)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const saved = await enablePushAction(sub.toJSON(), name);
      if (saved.ok) setEndpoint(sub.endpoint);
      return saved.ok ? { ok: true, message: "Notifiche attivate su questo dispositivo." } : saved;
    });

  const disable = () =>
    run(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (endpoint) await disablePushAction(endpoint);
      await sub?.unsubscribe();
      setEndpoint(null);
      return { ok: true, message: "Notifiche disattivate su questo dispositivo." };
    });

  const sendTest = () =>
    run(async () => {
      if (!current) return { error: "Attiva prima le notifiche." };
      const result = await sendTestPushAction(current.endpoint);
      if (result.expired) {
        // Il servizio push l'ha rifiutato e il server l'ha già tolto: anche il browser lo butta via.
        const reg = await navigator.serviceWorker.getRegistration("/");
        await (await reg?.pushManager.getSubscription())?.unsubscribe();
        setEndpoint(null);
      }
      return result;
    });

  const remove = (device: DeviceRow) =>
    run(async () => {
      const result = await removeDeviceAction(device.id);
      if (result.ok && device.endpoint === endpoint) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        await (await reg?.pushManager.getSubscription())?.unsubscribe();
        setEndpoint(null);
      }
      return result.ok ? { ok: true, message: `${device.name} rimosso.` } : result;
    });

  const current = devices.find((d) => d.endpoint === endpoint) ?? null;
  const active = !!current && permission === "granted";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-prugna/5">
        {!vapidPublicKey ? (
          <p className="text-sm text-prugna/70">
            Le notifiche non sono ancora configurate sul server (mancano le chiavi VAPID su Vercel).
          </p>
        ) : support === null || (support === "ok" && !checked) ? (
          <p className="text-sm text-prugna/60">Controllo del dispositivo…</p>
        ) : support === "ios-browser" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">Su iPhone e iPad le notifiche arrivano solo all&apos;app aperta dall&apos;icona.</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              <li>Serve iOS 16.4 o successivo (Impostazioni → Generali → Info).</li>
              <li>
                In Safari tocca <strong className="font-medium">Condividi</strong> →{" "}
                <strong className="font-medium">Aggiungi alla schermata Home</strong>.
              </li>
              <li>Apri l&apos;app dall&apos;icona, accedi e torna qui: Impostazioni → Il mio account.</li>
            </ol>
          </div>
        ) : support === "unsupported" ? (
          <p className="text-sm">
            Questo browser non supporta le notifiche. Su Android usa Chrome; su iPhone servono iOS 16.4+ e l&apos;app aggiunta alla
            schermata Home e aperta dall&apos;icona.
          </p>
        ) : permission === "denied" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">Le notifiche sono bloccate per questa app.</p>
            <p className="text-prugna/75">
              Per riattivarle: su iPhone Impostazioni → Notifiche → {"Fabiana L."} → Consenti notifiche; su Android tieni premuta
              l&apos;icona → Informazioni app → Notifiche; sul computer tocca il lucchetto accanto all&apos;indirizzo → Notifiche →
              Consenti. Poi torna qui.
            </p>
          </div>
        ) : active ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-salvia/40 px-2.5 py-0.5 text-xs font-medium">Attive</span>
              su questo dispositivo ({current.name})
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={sendTest}>
                Invia notifica di prova
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={disable}>
                Disattiva
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-prugna/75">
              <span className="mr-2 rounded-full bg-prugna/10 px-2.5 py-0.5 text-xs font-medium">Non attive</span>
              Ricevi una notifica a ogni prenotazione fatta da una cliente (se in Impostazioni hai acceso l&apos;avviso delle nuove
              prenotazioni).
            </p>
            <TextField
              id="device-name"
              label="Nome di questo dispositivo"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              hint="Serve solo a riconoscerlo nell'elenco qui sotto."
            />
            <Button type="button" className="w-fit" disabled={pending} onClick={enable}>
              {pending ? "Attendi…" : "Attiva notifiche"}
            </Button>
          </div>
        )}

        {feedback?.error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {feedback.error}
          </p>
        ) : feedback?.message ? (
          <p role="status" className="rounded-xl bg-salvia/25 px-3 py-2 text-sm">
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">I miei dispositivi</h3>
        {devices.length === 0 ? (
          <p className="text-sm text-prugna/60">Nessun dispositivo con le notifiche attive.</p>
        ) : (
          <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white ring-1 ring-prugna/5">
            {devices.map((d) => (
              <DeviceItem key={d.id} device={d} isCurrent={d.endpoint === endpoint} disabled={pending} onRemove={() => remove(d)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeviceItem({
  device,
  isCurrent,
  disabled,
  onRemove,
}: {
  device: DeviceRow;
  isCurrent: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {device.name}
            {isCurrent ? <span className="rounded-full bg-cipria/30 px-2 py-0.5 text-xs font-medium">questo dispositivo</span> : null}
          </span>
          <span className="text-xs text-prugna/60">
            Aggiunto il {device.createdLabel} · {device.lastUsedLabel ? `ultima notifica ${device.lastUsedLabel}` : "nessuna notifica ancora"}
          </span>
        </div>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-9 shrink-0 rounded-full bg-red-50 px-3 text-xs font-medium text-red-800 hover:bg-red-100"
          >
            Rimuovi
          </button>
        ) : null}
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label="Conferma rimozione" className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-3 text-sm">
          <span className="basis-full">Rimuovere {device.name}? Non riceverà più notifiche.</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setConfirming(false);
              onRemove();
            }}
            className="min-h-10 rounded-full bg-red-800 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            Sì, rimuovi
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-full px-3 text-sm">
            No
          </button>
        </div>
      ) : null}
    </li>
  );
}
