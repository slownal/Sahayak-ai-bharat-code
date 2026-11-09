/**
 * public/sw.js — Sahayak Service Worker
 *
 * Responsibilities:
 *   1. Cache shell assets for offline load (App Shell strategy)
 *   2. Listen for the "online" event → drain the offline queue
 *   3. Handle SKIP_WAITING and CLIENTS_CLAIM messages from the app
 *
 * This file is intentionally plain JS (not TypeScript) because Next.js
 * does not process files in /public through its compiler.
 */

const CACHE_NAME = "sahayak-shell-v1";

// Assets to pre-cache for offline shell
const SHELL_ASSETS = ["/", "/manifest.json"];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Activate immediately on first install
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Remove old caches
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API routes (never serve stale AI responses)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: "offline", message: "You are offline. Your request has been queued." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // Cache-first for shell assets
  event.respondWith(
    caches.match(request).then(
      (cached) => cached ?? fetch(request).then((res) => {
        // Cache navigations for offline use
        if (request.mode === "navigate") {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
        }
        return res;
      })
    )
  );
});

// ── Online event → drain queue ────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Notify all clients when we come back online so they can drain the queue
self.addEventListener("online", () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) =>
      client.postMessage({ type: "SAHAYAK_ONLINE" })
    );
  });
});

