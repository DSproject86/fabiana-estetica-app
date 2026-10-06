/*
 * Service worker di Fabiana L. · Estetica: volutamente semplice.
 * - Nessuna prenotazione offline e nessun dato in cache: le pagine arrivano sempre dalla rete.
 * - Se la rete manca durante la navigazione si mostra la pagina "Sei offline", tenuta in cache
 *   insieme ai suoi stili e font (usati solo quando la rete non risponde).
 * - Notifiche push per gli admin (src/lib/push): le mostra e, al tocco, apre la pagina indicata.
 */
const CACHE = "fl-offline-v1";
const OFFLINE_URL = "/offline";

/** File statici di Next (/_next/static/…) citati in un testo HTML o CSS (anche con percorso relativo). */
const staticAssets = (text, pattern, base) => [
  ...new Set(
    [...text.matchAll(pattern)]
      .map((m) => new URL(m[1].replace(/["']/g, ""), base))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"))
      .map((url) => url.pathname),
  ),
];

async function precache() {
  const cache = await caches.open(CACHE);
  const page = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!page.ok) throw new Error("Pagina offline non disponibile");
  await cache.put(OFFLINE_URL, page.clone());
  const html = await page.text();
  const css = staticAssets(html, /(\/_next\/static\/[^"'\s)]+\.css)/g, self.location.origin);
  await cache.addAll([...css, "/icons/icon-192.png"]);
  for (const url of css) {
    const text = await (await cache.match(url)).text();
    await cache.addAll(staticAssets(text, /url\(([^)]+\.woff2?["']?)\)/g, new URL(url, self.location.origin)));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()));
    return;
  }
  // Stili e font della pagina offline: prima la rete, la copia in cache solo se la rete non c'è.
  if (new URL(request.url).pathname.startsWith("/_next/static/")) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? Response.error()));
  }
});

// ─────────────── Notifiche push (solo admin) ───────────────

/** Solo percorsi interni all'app: una notifica non apre mai siti esterni. */
function internalUrl(url) {
  const target = new URL(typeof url === "string" ? url : "/admin/agenda", self.location.origin);
  return target.origin === self.location.origin ? target.href : new URL("/admin/agenda", self.location.origin).href;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Fabiana L. · Estetica";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      lang: "it",
      data: { url: internalUrl(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = internalUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Se l'app è già aperta la si porta su quella pagina e in primo piano, altrimenti se ne apre una.
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        const target = await existing.navigate(url).catch(() => null); // null se la finestra non è gestita da qui
        if (target) {
          await target.focus().catch(() => undefined);
          return undefined;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
