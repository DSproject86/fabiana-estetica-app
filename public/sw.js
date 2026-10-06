/*
 * Service worker di Fabiana L. · Estetica: volutamente semplice.
 * - Nessuna prenotazione offline e nessun dato in cache: le pagine arrivano sempre dalla rete.
 * - Se la rete manca durante la navigazione si mostra la pagina "Sei offline", tenuta in cache
 *   insieme ai suoi stili e font (usati solo quando la rete non risponde).
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
