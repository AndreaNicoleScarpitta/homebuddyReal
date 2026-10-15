/**
 * Register Home Buddy as an installable PWA. This script is external to comply
 * with production Content Security Policy; it never caches private responses.
 */
if ("serviceWorker" in navigator && (window.isSecureContext || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    const previouslyControlled = Boolean(navigator.serviceWorker.controller);
    let refreshed = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // A newly activated worker replaces the old controller. Fetch current
      // HTML/hashed JS bundles once, never indefinitely reload a new install.
      if (previouslyControlled && !refreshed) {
        refreshed = true;
        location.reload();
      }
    });

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(registration => {
        registration.update().catch(() => {});
        const updateWhenVisible = () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", updateWhenVisible);
        window.addEventListener("focus", updateWhenVisible);
      })
      .catch(error => console.warn("[pwa] Registration unavailable", error));
  });
}
