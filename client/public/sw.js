/* Home Buddy PWA. Never cache authenticated data, app JS, or the HTML shell. */
const CACHE_NAME = "homebuddy-offline-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_CSS_URL = "/offline.css";
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([OFFLINE_URL, OFFLINE_CSS_URL]);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // Clear stale legacy cache-first caches, including cached JS and private pages.
    const all = await caches.keys();
    await Promise.all(all.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === OFFLINE_CSS_URL) {
    event.respondWith(caches.match(OFFLINE_CSS_URL).then(r => r || fetch(request)));
    return;
  }
  // Only network navigation receives an offline fallback. No API, objects,
  // auth, dynamic JS/CSS, or user-specific HTML is ever written to cache.
  if (
    request.mode !== "navigate" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/v2/") ||
    url.pathname.startsWith("/objects/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname === OFFLINE_URL
  ) return;
  event.respondWith(fetch(request).catch(async () =>
    (await caches.match(OFFLINE_URL)) || new Response(
      "Home Buddy is offline. Reconnect to continue.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    )
  ));
});
