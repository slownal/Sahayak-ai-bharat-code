"use client";

import { useState, useCallback } from "react";
import UploadCard from "@/components/UploadCard";
import ResultView from "@/components/ResultView";
import OfflineBanner from "@/components/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ExplainResponse, Language, Grade } from "@/lib/types";
import { getCached, setCached, enqueue } from "@/lib/queue";

type AppState = "idle" | "loading" | "result" | "error";

const LOADING_STEPS = [
  "Reading your textbook page...",
  "Generating explanation...",
  "Creating practice questions...",
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [errorKind, setErrorKind] = useState<"generic" | "subscription" | "vision">("generic");
  const [actionUrl, setActionUrl] = useState<string>("");
  const [needsManualText, setNeedsManualText] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const handleSubmit = useCallback(
    async (data: {
      imageBase64?: string;
      manualText?: string;
      language: Language;
      grade: Grade;
    }) => {
      setSavedOffline(false);
      setNeedsManualText(false);
      setErrorMsg("");
      setErrorKind("generic");
      setLoadingStep(0);

      if (!navigator.onLine) {
        await enqueue({
          imageBlob: data.imageBase64
            ? base64ToBlob(data.imageBase64)
            : new Blob([data.manualText ?? ""], { type: "text/plain" }),
          language: data.language,
          grade: data.grade,
        });
        setSavedOffline(true);
        return;
      }

      const cacheKey = await computeCacheKey(
        data.imageBase64 ?? data.manualText ?? "",
        data.language,
        data.grade
      );
      const cached = await getCached(cacheKey);
      if (cached) {
        setResult(cached);
        setState("result");
        return;
      }

      setState("loading");

      let step = 0;
      const stepTimer = setInterval(() => {
        step = Math.min(step + 1, LOADING_STEPS.length - 1);
        setLoadingStep(step);
      }, 10000);

      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const json = (await res.json()) as ExplainResponse & {
          error?: string;
          needsManualText?: boolean;
          subscriptionRequired?: boolean;
          actionUrl?: string;
          cacheKey?: string;
        };

        if (!res.ok) {
          if (json.subscriptionRequired) {
            setErrorKind("subscription");
            setActionUrl(json.actionUrl ?? "https://bharatcode.ai/account");
            setErrorMsg(json.message ?? "Subscription required.");
            setState("error");
            return;
          }
          if (json.needsManualText) {
            setNeedsManualText(true);
            setState("idle");
            return;
          }
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }

        if (json.cacheKey) {
          await setCached(json.cacheKey, json as ExplainResponse);
        }

        setResult(json as ExplainResponse);
        setState("result");
      } catch (err) {
        setErrorKind("generic");
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
        setState("error");
      } finally {
        clearInterval(stepTimer);
        setLoadingStep(0);
      }
    },
    []
  );

  const handleReset = () => {
    setState("idle");
    setResult(null);
    setErrorMsg("");
    setErrorKind("generic");
    setSavedOffline(false);
    setNeedsManualText(false);
  };

  return (
    <>
      <OfflineBanner />
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col items-center justify-start py-8 px-4 pt-12">

        {savedOffline && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 w-full max-w-lg bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-xl px-4 py-3 text-sm font-medium"
          >
            Saved — will answer when you&apos;re back online.
          </div>
        )}

        {needsManualText && (
          <div
            role="alert"
            className="mb-4 w-full max-w-lg bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm"
          >
            Could not read the image automatically. Please use the{" "}
            &ldquo;type manually&rdquo; option below.
          </div>
        )}

        {state === "error" && errorKind === "subscription" && (
          <div
            role="alert"
            className="mb-4 w-full max-w-lg bg-orange-50 border border-orange-300 text-orange-800 rounded-xl px-4 py-4 space-y-3 text-sm"
          >
            <p className="font-semibold text-base">API access needed</p>
            <p>{errorMsg}</p>
            <div className="flex flex-col gap-2">
              <a
                href={actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-4 py-2 min-h-[44px] transition-colors"
              >
                Activate free student access
              </a>
              <p className="text-xs text-orange-600">
                Students with a verified college email get Qwen 3.8 27B free (up to 10M tokens/day).
                After activating, restart the app.
              </p>
              <button
                onClick={handleReset}
                className="text-orange-600 underline text-xs min-h-[44px]"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {state === "error" && errorKind === "generic" && (
          <div
            role="alert"
            className="mb-4 w-full max-w-lg bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"
          >
            {errorMsg}{" "}
            <button
              onClick={handleReset}
              className="underline font-semibold min-h-[44px] inline-block"
            >
              Try again
            </button>
          </div>
        )}

        {state === "loading" && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 w-full max-w-lg bg-white border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-gray-600 shadow-sm"
          >
            <span className="inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span>{LOADING_STEPS[loadingStep]}</span>
          </div>
        )}

        {state === "result" && result ? (
          <ErrorBoundary>
            <ResultView result={result} onReset={handleReset} />
          </ErrorBoundary>
        ) : state !== "error" ? (
          <UploadCard
            onSubmit={handleSubmit}
            isLoading={state === "loading"}
            disabled={state === "loading"}
          />
        ) : null}

        <footer className="mt-8 text-xs text-gray-400 text-center">
          Sahayak &middot; BharatCode Build League &middot; No data leaves your device except for model calls
        </footer>
      </main>
    </>
  );
}

function base64ToBlob(base64: string, type = "image/jpeg"): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function computeCacheKey(content: string, language: string, grade: number): Promise<string> {
  const input = `${content}|${language}|${grade}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
