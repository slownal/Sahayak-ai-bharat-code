/**
 * app/api/explain/route.ts
 *
 * POST /api/explain
 *
 * The core Sahayak harness — 4 steps as specified in AGENTS.md:
 *
 *   Step 1 — Extract:  image → structured page text via lib/extract.ts
 *   Step 2 — Explain:  page text → explanation in target language + grade
 *   Step 3 — Quiz:     page text → 3 MCQs (strict JSON, validated with Zod,
 *                      retried once on parse failure)
 *   Step 4 — Cache:    result stored in IndexedDB (client-side, via lib/queue.ts)
 *                      keyed by hash(imageBase64 + language + grade)
 *
 * Request body:  { imageBase64: string, language: Language, grade: Grade }
 *                OR { manualText: string, language: Language, grade: Grade }
 *                (manualText path is the graceful fallback when vision fails)
 *
 * Response:      { explanation, questions, meta }  on success
 *                { error: string }                  on failure
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callModel } from "@/lib/bharatcode";
import { extractText } from "@/lib/extract";
import {
  buildExplainPrompt,
  buildQuizPrompt,
  QUIZ_RETRY_NUDGE,
} from "@/lib/prompts";
import type {
  ExplainResponse,
  Language,
  Grade,
  QuizQuestion,
} from "@/lib/types";
import { VALID_LANGUAGES, VALID_GRADES } from "@/lib/types";

export const runtime = "nodejs";
// Allow up to 120 s — Qwen 3.8 27B + 3 sequential model calls can be slow
export const maxDuration = 120;

// ── Request validation schema ────────────────────────────────────────────────

const ExplainRequestSchema = z
  .object({
    imageBase64: z.string().optional(),
    manualText: z.string().optional(),
    language: z.enum(["en", "hi", "ta", "te", "kn", "mr", "bn"] as const),
    grade: z.number().int().refine((g): g is Grade => VALID_GRADES.includes(g as Grade), {
      message: "Grade must be between 6 and 12",
    }),
  })
  .refine((d) => d.imageBase64 || d.manualText, {
    message: "Either imageBase64 or manualText must be provided",
  });

// ── Quiz response Zod schema ─────────────────────────────────────────────────

const QuizQuestionSchema = z.object({
  q: z.string().min(1),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  answerIndex: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  explanation: z.string().min(1),
});

const QuizResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1).max(5),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * parseAndValidateQuiz
 *
 * Parses the raw model string as JSON and validates it against the quiz schema.
 * Strips markdown code fences if the model wrapped the JSON (common failure mode).
 * Returns null on failure so the caller can retry.
 */
function parseAndValidateQuiz(
  raw: string
): { questions: QuizQuestion[] } | null {
  // Strip markdown code fences e.g. ```json ... ```
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed: unknown = JSON.parse(stripped);
    const result = QuizResponseSchema.safeParse(parsed);
    if (result.success) {
      return result.data as { questions: QuizQuestion[] };
    }
    console.warn("[Sahayak/quiz] Zod validation failed:", result.error.issues);
    return null;
  } catch {
    console.warn("[Sahayak/quiz] JSON.parse failed on:", stripped.slice(0, 200));
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse + validate request body ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const parsed = ExplainRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const { imageBase64, manualText, language, grade } = parsed.data;

  // ── Step 1: Extract ────────────────────────────────────────────────────────
  let pageText: string;
  let subject: string;
  let detectedLanguage: string;
  let usedVision: boolean;

  if (imageBase64) {
    const extracted = await extractText(imageBase64);

    // Check if vision failed due to a subscription error — surface it directly
    // so the UI can show a clear upgrade/verify prompt, not "type manually".
    if (!extracted.usedVision && extracted.subscriptionRequired) {
      return NextResponse.json(
        {
          error: "subscription_required",
          message:
            "Your BharatCode account needs API access. " +
            "Students can get free access by verifying their college email.",
          actionUrl: extracted.actionUrl ?? "https://bharatcode.ai/account",
          subscriptionRequired: true,
        },
        { status: 402 }
      );
    }

    // Generic vision failure — offer manual text entry
    if (!extracted.usedVision && !extracted.pageText) {
      return NextResponse.json(
        {
          error: "vision_failed",
          message:
            "Could not read the image automatically. " +
            "Please type the text from the page manually.",
          needsManualText: true,
        },
        { status: 422 }
      );
    }

    pageText = extracted.pageText;
    subject = extracted.subject;
    detectedLanguage = extracted.detectedLanguage;
    usedVision = extracted.usedVision;
  } else {
    // Manual text path (graceful fallback)
    pageText = manualText!;
    subject = "Unknown";
    detectedLanguage = language;
    usedVision = false;
  }

  // ── Steps 2 + 3: Explain and Quiz — run in PARALLEL ─────────────────────────
  // Both only need pageText from Step 1, so fire them simultaneously.
  // This cuts wall-clock time roughly in half compared to sequential calls.
  const quizUserMessage = `Here is the textbook content to create questions from:\n\n${pageText}`;

  type ExplainResult =
    | { ok: true; explanation: string }
    | { ok: false; err: unknown };
  type QuizResult =
    | { ok: true; questions: QuizQuestion[] }
    | { ok: false };

  const [explainResult, quizResult] = await Promise.all([
    // Step 2 — Explain
    callModel({
      system: buildExplainPrompt(language, grade),
      user: `Here is the textbook content to explain:\n\n${pageText}`,
    })
      .then((explanation): ExplainResult => ({ ok: true, explanation }))
      .catch((err): ExplainResult => ({ ok: false, err })),

    // Step 3 — Quiz (with one retry on parse failure)
    callModel({
      system: buildQuizPrompt(language, grade),
      user: quizUserMessage,
      json: true,
    })
      .then((raw): QuizResult => {
        const parsed = parseAndValidateQuiz(raw);
        if (parsed) return { ok: true, questions: parsed.questions };
        // Parse failed on first attempt — return sentinel for retry below
        return { ok: false };
      })
      .catch((): QuizResult => ({ ok: false })),
  ]);

  // Handle explain failure
  if (!explainResult.ok) {
    const err = explainResult.err;
    console.error("[Sahayak/explain] Explain step failed:", err);
    if ((err as { code?: string }).code === "subscription_required") {
      return NextResponse.json(
        {
          error: "subscription_required",
          message:
            "Your BharatCode account needs API access. " +
            "Students can get free access by verifying their college email.",
          actionUrl:
            (err as { actionUrl?: string }).actionUrl ??
            "https://bharatcode.ai/account",
          subscriptionRequired: true,
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      {
        error: "Could not generate an explanation. Please try again.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  const explanation = explainResult.explanation;

  // Retry quiz once if first attempt failed
  let questions: QuizQuestion[];
  if (quizResult.ok) {
    questions = quizResult.questions;
  } else {
    console.warn("[Sahayak/quiz] First attempt failed — retrying once");
    try {
      const quizRaw2 = await callModel({
        system: buildQuizPrompt(language, grade),
        user: quizUserMessage + QUIZ_RETRY_NUDGE,
        json: true,
      });
      questions = parseAndValidateQuiz(quizRaw2)?.questions ?? [];
    } catch (err) {
      console.warn("[Sahayak/quiz] Retry also failed:", err);
      questions = [];
    }
  }

  // ── Step 4: Cache key ──────────────────────────────────────────────────────
  const cacheKey = await computeCacheKey(
    imageBase64 ?? manualText ?? "",
    language,
    grade
  );

  // ── Build response ─────────────────────────────────────────────────────────
  const { loadEnv } = await import("@/lib/env");
  const env = loadEnv();

  const response: ExplainResponse = {
    explanation,
    questions,
    meta: {
      subject,
      detectedLanguage,
      usedVision,
      model: env.BHARATCODE_MODEL,
    },
  };

  return NextResponse.json({ ...response, cacheKey }, { status: 200 });
}

// ── Cache key ────────────────────────────────────────────────────────────────

/**
 * computeCacheKey
 *
 * Returns a stable hex hash of (content + language + grade) for
 * IndexedDB cache lookups. Uses the Web Crypto API (available in Node 18+).
 */
async function computeCacheKey(
  content: string,
  language: string,
  grade: number
): Promise<string> {
  const input = `${content}|${language}|${grade}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// VALID_LANGUAGES and VALID_GRADES are defined in lib/types.ts — import from there.
