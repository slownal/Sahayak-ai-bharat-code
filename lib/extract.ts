/**
 * lib/extract.ts
 *
 * Step 1 — Extract: image → structured page text.
 *
 * Primary path:  Send the image to the vision-capable BharatCode model.
 *                The model returns SUBJECT / LANGUAGE / CONTENT blocks.
 *
 * Fallback:      If vision fails (model unavailable, image unreadable, etc.),
 *                `extractText` returns `usedVision: false` with empty pageText
 *                so the caller (api/explain/route.ts) can offer manual text
 *                entry in the UI instead of crashing.
 *
 * Model usage:   Documented here and in README "Model usage" section.
 *                Primary: BHARATCODE_MODEL (env var) with image payload.
 *                Fallback: none — returns signal to UI for manual entry.
 *
 * NOTE: This module is server-only (uses process.env, calls BharatCode).
 *       Never import it from client components.
 */

import { callModel } from "./bharatcode";
import { EXTRACT_PROMPT } from "./prompts";
import type { ExtractResult } from "./types";

// ── Response parser ──────────────────────────────────────────────────────────

/**
 * parseExtractResponse
 *
 * Parses the structured text returned by the extraction prompt.
 * Expected format:
 *   SUBJECT: <subject>
 *   LANGUAGE: <bcp47>
 *   CONTENT:
 *   <text...>
 *
 * On parse failure, returns safe defaults rather than throwing.
 */
function parseExtractResponse(raw: string): {
  pageText: string;
  subject: string;
  detectedLanguage: string;
} {
  if (raw.trim() === "NOT_A_TEXTBOOK_PAGE") {
    return {
      pageText: "",
      subject: "Unknown",
      detectedLanguage: "en",
    };
  }

  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)$/im);
  const languageMatch = raw.match(/^LANGUAGE:\s*(.+)$/im);
  const contentMatch = raw.match(/^CONTENT:\s*\n([\s\S]*)/im);

  return {
    subject: subjectMatch?.[1]?.trim() ?? "Unknown",
    detectedLanguage: languageMatch?.[1]?.trim() ?? "en",
    pageText: contentMatch?.[1]?.trim() ?? raw.trim(),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * extractText
 *
 * Sends the image to the BharatCode vision model and returns structured
 * page content. On any failure, returns a safe fallback result with
 * `usedVision: false` so the UI can offer manual text entry.
 *
 * @param imageBase64 - Base64-encoded JPEG or PNG (no data-URL prefix).
 * @returns ExtractResult — always resolves, never rejects.
 */
export async function extractText(imageBase64: string): Promise<ExtractResult> {
  try {
    const raw = await callModel({
      system:
        "You are a precise document parser for Indian school textbooks. " +
        "Follow the user's format instructions exactly.",
      user: EXTRACT_PROMPT,
      image: imageBase64,
    });

    const { pageText, subject, detectedLanguage } = parseExtractResponse(raw);

    return {
      pageText,
      subject,
      detectedLanguage,
      usedVision: true,
    };
  } catch (err) {
    const isSubscription =
      (err as { code?: string }).code === "subscription_required";
    const actionUrl = isSubscription
      ? (err as { actionUrl?: string }).actionUrl
      : undefined;

    console.warn(
      "[Sahayak/extract] Vision extraction failed" +
        (isSubscription ? " (subscription required)" : "") +
        ":",
      err instanceof Error ? err.message : String(err)
    );

    return {
      pageText: "",
      subject: "Unknown",
      detectedLanguage: "en",
      usedVision: false,
      subscriptionRequired: isSubscription,
      actionUrl,
    };
  }
}
