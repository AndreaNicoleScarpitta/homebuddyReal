import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const source = readFileSync(join(__dirname, "../../client/public/sw.js"), "utf8");

function createWorker({ offline = false } = {}) {
  const handlers: Record<string, (event: any) => void> = {};
  const contents = new Map<string, unknown>();
  const offlineResponse = { offline: true };
  const offlineCss = { css: true };
  contents.set("/offline.html", offlineResponse);
  contents.set("/offline.css", offlineCss);
  const cache = {
    addAll: vi.fn(async (paths: string[]) => {
      expect(paths.sort()).toEqual(["/offline.css", "/offline.html"]);
    }),
  };
  const mockFetch = vi.fn(async (req: any) => {
    if (offline) throw new Error("network unavailable");
    return { live: true, path: req.url };
  });
  const mockCaches = {
    open: vi.fn(async (_name: string) => cache),
    keys: vi.fn(async () => ["old-html-cache", "old-js-cache", "homebuddy-offline-v1"]),
    delete: vi.fn(async (_name: string) => true),
    match: vi.fn(async (key: string) => contents.get(key)),
  };
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  runInNewContext(source, {
    self: {
      location: { origin: "https://www.homebuddy.space" },
      addEventListener: (name: string, fn: (event: any) => void) => { handlers[name] = fn; },
      skipWaiting,
      clients: { claim },
    },
    caches: mockCaches,
    fetch: mockFetch,
    URL,
    Response,
  });
  const emit = async (name: string, request?: any) => {
    let response: Promise<unknown> | undefined;
    let waitUntil: Promise<unknown> | undefined;
    handlers[name]({
      request,
      respondWith: (promise: Promise<unknown>) => { response = Promise.resolve(promise); },
      waitUntil: (promise: Promise<unknown>) => { waitUntil = Promise.resolve(promise); },
    });
    if (waitUntil) await waitUntil;
    return response && await response;
  };
  return { emit, mockFetch, mockCaches, cache, claim, skipWaiting, offlineResponse };
}

describe("PWA worker privacy and update safety", () => {
  it("pre-caches only the public offline notice and its stylesheet", async () => {
    const w = createWorker();
    await w.emit("install");
    expect(w.cache.addAll).toHaveBeenCalledOnce();
    expect(w.skipWaiting).toHaveBeenCalledOnce();
  });

  it("cleans up all legacy caches containing stale JS and private pages", async () => {
    const w = createWorker();
    await w.emit("activate");
    expect(w.mockCaches.delete).toHaveBeenCalledTimes(2);
    expect(w.mockCaches.delete).toHaveBeenCalledWith("old-html-cache");
    expect(w.mockCaches.delete).toHaveBeenCalledWith("old-js-cache");
    expect(w.mockCaches.delete).not.toHaveBeenCalledWith("homebuddy-offline-v1");
    expect(w.claim).toHaveBeenCalledOnce();
  });

  it.each([
    ["login mutation", "POST", "/api/login", "cors"],
    ["private API", "GET", "/api/home", "cors"],
    ["V2 records", "GET", "/v2/homes/secret", "cors"],
    ["private object", "GET", "/objects/secret", "cors"],
    ["hashed JavaScript", "GET", "/assets/index-hash.js", "no-cors"],
    ["hashed CSS", "GET", "/assets/index-hash.css", "no-cors"],
    ["third-party script", "GET", "https://cdn.example.com/lib.js", "no-cors"],
  ])("never intercepts or caches %s", async (_label, method, path, mode) => {
    const w = createWorker({ offline: true });
    const url = path.startsWith("https://") ? path : `https://www.homebuddy.space${path}`;
    expect(await w.emit("fetch", { method, url, mode })).toBeUndefined();
    expect(w.mockFetch).not.toHaveBeenCalled();
    expect(w.mockCaches.match).not.toHaveBeenCalled();
  });

  it("uses the network for online navigation without storing HTML", async () => {
    const w = createWorker();
    const res = await w.emit("fetch", {
      method: "GET", mode: "navigate", url: "https://www.homebuddy.space/house",
    });
    expect(res).toMatchObject({ live: true });
    expect(w.mockCaches.match).not.toHaveBeenCalled();
    expect(w.cache.addAll).not.toHaveBeenCalled();
  });

  it("shows a static offline notice when a navigation cannot reach the network", async () => {
    const w = createWorker({ offline: true });
    const res = await w.emit("fetch", {
      method: "GET", mode: "navigate", url: "https://www.homebuddy.space/dashboard",
    });
    expect(res).toBe(w.offlineResponse);
    expect(w.mockCaches.match).toHaveBeenCalledWith("/offline.html");
  });

  it("never replaces API failures with a success-looking offline page", async () => {
    const w = createWorker({ offline: true });
    const res = await w.emit("fetch", {
      method: "GET", mode: "navigate", url: "https://www.homebuddy.space/api/home",
    });
    expect(res).toBeUndefined();
  });
});
