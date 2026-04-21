/**
 * Global fetch wrapper that auto-injects the CSRF header on same-origin
 * mutating requests.
 *
 * Why a global wrapper instead of patching every callsite:
 * the app has ~80 direct `fetch()` callers (plus `apiRequest` in queryClient,
 * inline fetches in signup/login/onboarding, etc.). Patching them one-by-one
 * is churn-heavy and easy to miss. Wrapping `window.fetch` once at startup
 * means every callsite — current and future — gets CSRF handling for free.
 *
 * Contract (matches server/lib/csrf.ts):
 *   - Cookie: `csrf-token` (non-httpOnly, set by server on first GET)
 *   - Header: `x-csrf-token` (must match cookie on POST/PUT/PATCH/DELETE)
 *   - `/api/stripe/webhook` is skipped on the server so we don't need to care.
 *
 * The wrapper:
 *   1. Leaves GET/HEAD/OPTIONS untouched (safe methods, no CSRF needed).
 *   2. For cross-origin URLs, passes through unchanged (header would leak).
 *   3. Reads the cookie; if absent, fetches `/api/csrf-token` once to prime it.
 *   4. Injects `x-csrf-token` if the caller hasn't already set one.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";

/** Read `csrf-token` cookie value, or null. */
function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** In-flight promise to avoid duplicate /api/csrf-token fetches. */
let priming: Promise<string | null> | null = null;

/** Ensure the csrf-token cookie exists; return its value (or null on failure). */
async function ensureCsrfToken(originalFetch: typeof fetch): Promise<string | null> {
  const existing = readCsrfCookie();
  if (existing) return existing;

  if (!priming) {
    priming = originalFetch("/api/csrf-token", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return null;
        try {
          const data = (await res.json()) as { token?: string };
          return data.token ?? readCsrfCookie();
        } catch {
          return readCsrfCookie();
        }
      })
      .catch(() => null)
      .finally(() => {
        // Allow a future prime attempt if the cookie still isn't set.
        priming = null;
      });
  }
  return priming;
}

/** Decide if a URL is same-origin. Relative URLs are same-origin by definition. */
function isSameOrigin(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return true;
  }
}

/** Extract method + URL + headers from a fetch() call's polymorphic args. */
function inspectInit(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  return { method, url };
}

/** Check if init already carries an x-csrf-token header (case-insensitive). */
function initHasCsrfHeader(init?: RequestInit): boolean {
  if (!init?.headers) return false;
  const h = init.headers;
  if (h instanceof Headers) return h.has(CSRF_HEADER);
  if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === CSRF_HEADER);
  return Object.keys(h).some((k) => k.toLowerCase() === CSRF_HEADER);
}

/** Merge a new header into an init.headers value, preserving its existing shape. */
function withCsrfHeader(init: RequestInit | undefined, token: string): RequestInit {
  const next: RequestInit = { ...(init ?? {}) };
  const existing = next.headers;
  if (existing instanceof Headers) {
    const h = new Headers(existing);
    h.set(CSRF_HEADER, token);
    next.headers = h;
  } else if (Array.isArray(existing)) {
    next.headers = [...existing.filter(([k]) => k.toLowerCase() !== CSRF_HEADER), [CSRF_HEADER, token]];
  } else if (existing && typeof existing === "object") {
    next.headers = { ...existing, [CSRF_HEADER]: token };
  } else {
    next.headers = { [CSRF_HEADER]: token };
  }
  return next;
}

let installed = false;

export function installFetchCsrf(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { method, url } = inspectInit(input, init);

    // Safe methods and cross-origin calls: pass through unchanged.
    if (SAFE_METHODS.has(method) || !isSameOrigin(url)) {
      return originalFetch(input, init);
    }

    // Caller already set the header — respect that.
    if (initHasCsrfHeader(init)) {
      return originalFetch(input, init);
    }

    // Same-origin mutation: ensure we have a token and inject the header.
    const token = await ensureCsrfToken(originalFetch);
    if (!token) {
      // Prime failed; let the request go — server will 403 and caller will see it.
      return originalFetch(input, init);
    }

    // If the caller passed a Request object, we can't easily add headers via init.
    // Build a new Request with the header merged.
    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      headers.set(CSRF_HEADER, token);
      const rebuilt = new Request(input, { headers });
      return originalFetch(rebuilt, init);
    }

    return originalFetch(input, withCsrfHeader(init, token));
  };
}
