/**
 * lib/queue.ts
 *
 * Phase 4 — Offline queue + cache using IndexedDB via the `idb` library.
 *
 * Two responsibilities:
 *
 *   1. OFFLINE QUEUE — stores pending explain requests when the user is
 *      offline. The service worker's "online" event drains the queue.
 *      Schema: OfflineQueueItem (see lib/types.ts)
 *
 *   2. RESULT CACHE — stores completed ExplainResponse objects keyed by
 *      SHA-256 hash of (image|language|grade) so identical requests
 *      resolve instantly from IndexedDB without hitting the API.
 *
 * This module is client-only — it uses browser APIs (IndexedDB, fetch).
 * Never import it in server-side code (API routes, lib/extract.ts, etc.).
 */

import { openDB, type IDBPDatabase } from "idb";
import type { ExplainResponse, Language, Grade, OfflineQueueItem } from "./types";

// ── DB schema ────────────────────────────────────────────────────────────────

const DB_NAME = "sahayak-db";
const DB_VERSION = 1;
const QUEUE_STORE = "offline-queue";
const CACHE_STORE = "result-cache";

type SahayakDB = {
  [QUEUE_STORE]: {
    key: string;
    value: OfflineQueueItem;
    indexes: { "by-status": string };
  };
  [CACHE_STORE]: {
    key: string;
    value: { key: string; result: ExplainResponse; cachedAt: number };
  };
};

let dbPromise: Promise<IDBPDatabase<SahayakDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SahayakDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SahayakDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Offline queue store
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const queueStore = db.createObjectStore(QUEUE_STORE, {
            keyPath: "id",
          });
          queueStore.createIndex("by-status", "status");
        }
        // Result cache store
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ── Offline queue API ─────────────────────────────────────────────────────────

/**
 * enqueue — add a pending request to the offline queue.
 */
export async function enqueue(item: {
  imageBlob: Blob;
  language: Language;
  grade: Grade;
}): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = Date.now();

  const queueItem: OfflineQueueItem = {
    id,
    imageBlob: item.imageBlob,
    language: item.language,
    grade: item.grade,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await db.put(QUEUE_STORE, queueItem);
  return id;
}

/**
 * getAllPending — returns all items with status "pending".
 */
export async function getAllPending(): Promise<OfflineQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex(QUEUE_STORE, "by-status", "pending");
}

/**
 * updateStatus — update the status and optionally the result of a queue item.
 */
export async function updateStatus(
  id: string,
  status: OfflineQueueItem["status"],
  result?: ExplainResponse,
  errorMessage?: string
): Promise<void> {
  const db = await getDB();
  const item = await db.get(QUEUE_STORE, id);
  if (!item) return;
  await db.put(QUEUE_STORE, {
    ...item,
    status,
    result,
    errorMessage,
    updatedAt: Date.now(),
  });
}

/**
 * drainQueue — process all pending offline items now that we're online.
 * Called by the service worker message handler and the online event listener.
 *
 * For each pending item:
 *   1. Mark as "processing"
 *   2. Convert imageBlob → base64
 *   3. POST to /api/explain
 *   4. Store result in cache + mark as "done"
 *   5. On error, mark as "error" (not retried — user can re-submit)
 */
export async function drainQueue(): Promise<void> {
  const pending = await getAllPending();
  if (pending.length === 0) return;

  for (const item of pending) {
    await updateStatus(item.id, "processing");
    try {
      const imageBase64 = await blobToBase64(item.imageBlob);

      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          language: item.language,
          grade: item.grade,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as ExplainResponse & { cacheKey?: string };

      // Cache the result
      if (data.cacheKey) {
        await setCached(data.cacheKey, data as ExplainResponse);
      }

      await updateStatus(item.id, "done", data as ExplainResponse);
    } catch (err) {
      await updateStatus(
        item.id,
        "error",
        undefined,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

// ── Result cache API ──────────────────────────────────────────────────────────

/**
 * getCached — look up a result by cache key.
 * Returns null on cache miss.
 */
export async function getCached(key: string): Promise<ExplainResponse | null> {
  try {
    const db = await getDB();
    const entry = await db.get(CACHE_STORE, key);
    return entry?.result ?? null;
  } catch {
    return null;
  }
}

/**
 * setCached — store a result under the given cache key.
 */
export async function setCached(
  key: string,
  result: ExplainResponse
): Promise<void> {
  try {
    const db = await getDB();
    await db.put(CACHE_STORE, { key, result, cachedAt: Date.now() });
  } catch (err) {
    // Cache write failure is non-fatal
    console.warn("[Sahayak/cache] Failed to store result:", err);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
