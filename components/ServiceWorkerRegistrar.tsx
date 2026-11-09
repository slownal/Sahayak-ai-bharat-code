/**
 * components/ServiceWorkerRegistrar.tsx
 *
 * Client component that registers public/sw.js and listens for
 * SAHAYAK_ONLINE messages to drain the offline queue.
 */
"use client";

import { useEffect } from "react";
import { drainQueue } from "@/lib/queue";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[Sahayak] SW registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[Sahayak] SW registration failed:", err);
      });

    // Listen for the online message from the SW to drain the queue
    navigator.serviceWorker.addEventListener("message", async (event) => {
      if (event.data?.type === "SAHAYAK_ONLINE") {
        await drainQueue();
      }
    });

    // Also drain queue on window online event (belt-and-suspenders)
    const handleOnline = async () => {
      await drainQueue();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}

