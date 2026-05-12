/**
 * SELF-DESTRUCT service worker.
 *
 * A prior version of this file cached assets too aggressively (cache-first
 * for everything) and served stale JS bundles after deploys, leaving users
 * stuck on broken old code — most notably missing the CSRF-injecting fetch
 * wrapper, which made onboarding mutations fail silently.
 *
 * This version does nothing useful: on install+activate it unregisters
 * itself, deletes every cache, and tells open tabs to reload. The browser
 * auto-checks /sw.js on every navigation, so existing installs pick this
 * up and dispose of themselves. New visitors never install a worker
 * because the registration call in index.html has been removed.
 *
 * If we want offline support back later, replace this file with a proper
 * network-first-for-JS/HTML worker and restore the registration script.
 */

self.addEventListener("install", () => {
  // Skip the waiting phase so we activate immediately and can clean up.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch {
      // ignore — best-effort
    }
    try {
      await self.registration.unregister();
    } catch {
      // ignore — best-effort
    }
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      // Reload so the page re-fetches /index.html and the current JS bundle
      // straight from the network, without any SW interception.
      try {
        client.navigate(client.url);
      } catch {
        // Some browsers disallow navigate(); postMessage as a fallback so
        // a client listener can reload itself.
        client.postMessage({ type: "SW_SELF_DESTRUCT" });
      }
    }
  })());
});

// Pass every fetch straight through to the network. No caching, no fallback.
self.addEventListener("fetch", () => {
  // Intentionally empty — let the browser handle the request normally.
});
