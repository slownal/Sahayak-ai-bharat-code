/**
 * lib/types.ts
 *
 * Shared TypeScript types used across the entire Sahayak application.
 * No runtime logic lives here — pure type definitions only.
 */

// ── Language & Grade ────────────────────────────────────────────────────────

/** Supported UI languages for explanation output. */
export type Language = "en" | "hi" | "ta" | "te" | "kn" | "mr" | "bn";

/** Human-readable label for each language. */
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "हिंदी (Hindi)",
  ta: "தமிழ் (Tamil)",
  te: "తెలుగు (Telugu)",
  kn: "ಕನ್ನಡ (Kannada)",
  mr: "मराठी (Marathi)",
  bn: "বাংলা (Bengali)",
};

/** Class level (Indian school curriculum). */
export type Grade = 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Allowed languages for validation (mirrors the Language union). */
export const VALID_LANGUAGES: Language[] = ["en", "hi", "ta", "te", "kn", "mr", "bn"];

/** Allowed grade values for validation. */
export const VALID_GRADES: Grade[] = [6, 7, 8, 9, 10, 11, 12];

// ── BharatCode client ────────────────────────────────────────────────────────

/** Input to the callModel wrapper in lib/bharatcode.ts */
export interface CallModelInput {
  /** System prompt setting the model's role / constraints. */
  system: string;
  /** User-facing message / instruction. */
  user: string;
  /** Optional base64-encoded image (JPEG/PNG) for vision calls. */
  image?: string;
  /** If true, the caller expects a JSON string back and will parse it. */
  json?: boolean;
}

// ── Extraction ───────────────────────────────────────────────────────────────

/** Structured result from lib/extract.ts Step 1. */
export interface ExtractResult {
  /** Raw text content of the textbook page. */
  pageText: string;
  /** Best-guess subject (e.g. "Mathematics", "Biology"). */
  subject: string;
  /** Detected source language of the textbook (BCP-47 tag). */
  detectedLanguage: string;
  /** Whether the text came from vision model (true) or fallback OCR (false). */
  usedVision: boolean;
  /** Set true when the failure was specifically a 402 subscription error. */
  subscriptionRequired?: boolean;
  /** The BharatCode account/upgrade URL when subscriptionRequired is true. */
  actionUrl?: string;
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

/** A single multiple-choice practice question. */
export interface QuizQuestion {
  q: string;
  options: [string, string, string, string]; // exactly 4 options
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

/** Validated response from the quiz step (Step 3 of harness). */
export interface QuizResponse {
  questions: QuizQuestion[];
}

// ── Explain API ──────────────────────────────────────────────────────────────

/** Request body for POST /api/explain */
export interface ExplainRequest {
  /** Base64-encoded image of the textbook page. */
  imageBase64: string;
  /** Target output language for explanation + quiz. */
  language: Language;
  /** Student's grade level. */
  grade: Grade;
}

/** Successful response from POST /api/explain */
export interface ExplainResponse {
  explanation: string;
  questions: QuizQuestion[];
  /** Metadata for transparency / judge review. */
  meta: {
    subject: string;
    detectedLanguage: string;
    usedVision: boolean;
    model: string;
  };
}

// ── Offline Queue ────────────────────────────────────────────────────────────

export type QueueItemStatus = "pending" | "processing" | "done" | "error";

/** A single item in the IndexedDB offline queue. */
export interface OfflineQueueItem {
  /** Stable hash of (imageBlob + language + grade) — doubles as cache key. */
  id: string;
  imageBlob: Blob;
  language: Language;
  grade: Grade;
  status: QueueItemStatus;
  /** Populated once the request is processed. */
  result?: ExplainResponse;
  /** Human-readable error if status === "error". */
  errorMessage?: string;
  createdAt: number; // Date.now()
  updatedAt: number;
}

