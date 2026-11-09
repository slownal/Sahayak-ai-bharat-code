/**
 * lib/bharatcode.ts
 *
 * Single abstraction layer for all BharatCode model calls.
 * Every explain and quiz call in Sahayak goes through callModel().
 *
 * Config is read from environment variables only — the API key is
 * never hard-coded or logged (Authorization header is redacted in logs).
 *
 * ── TODO markers ────────────────────────────────────────────────────────────
 * The BharatCode API request/response shape is not fully confirmed.
 * Search for "TODO(bharatcode-api)" to find every place that needs
 * updating once the official docs are available.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { loadEnv } from "./env";
import type { CallModelInput } from "./types";

// ── Internal request/response types ─────────────────────────────────────────

/**
 * TODO(bharatcode-api): Confirm the exact request body shape.
 * Current assumption: OpenAI-compatible chat completions format.
 * Replace this interface if BharatCode uses a different schema.
 */
interface BharatCodeMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

/**
 * BharatCode API — confirmed request body schema (OpenAI-compatible).
 * Endpoint: POST /chat/completions
 * Docs: https://bharatcode.ai/api/model/v1
 */
interface BharatCodeRequest {
  model: string;
  messages: BharatCodeMessage[];
  max_tokens?: number;
  temperature?: number;
  /** JSON mode — request a JSON object response (supported by qwen-3.8-27b). */
  response_format?: { type: "json_object" };
}

/**
 * BharatCode API — confirmed response schema (OpenAI-compatible choices array).
 */
interface BharatCodeResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Redacts the Authorization header value in log output. */
function safeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      k.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : v,
    ])
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * callModel — the single entry point for all BharatCode model calls.
 *
 * @param input - System prompt, user message, optional image (base64), json mode flag.
 * @returns The model's text response (string).
 * @throws On network error, non-2xx status, or missing response content.
 *
 * Usage:
 *   const text = await callModel({ system: SYSTEM_EXPLAIN, user: pageText });
 *   const json = await callModel({ system: SYSTEM_QUIZ, user: pageText, json: true });
 */
export async function callModel(input: CallModelInput): Promise<string> {
  const env = loadEnv();

  // Build the messages array
  const messages: BharatCodeMessage[] = [
    { role: "system", content: input.system },
  ];

  // If an image is provided, build a multimodal user message
  if (input.image) {
    // BharatCode qwen-3.8-27b supports OpenAI-compatible base64 image_url format.
    messages.push({
      role: "user",
      content: [
        { type: "text", text: input.user },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${input.image}`,
          },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: input.user });
  }

  const body: BharatCodeRequest = {
    model: env.BHARATCODE_MODEL,
    messages,
    max_tokens: 2048,
    temperature: 0.3,
    ...(input.json ? { response_format: { type: "json_object" } } : {}),
  };

  /**
   * Endpoint confirmed: BharatCode uses OpenAI-compatible /chat/completions.
   * Base URL: https://bharatcode.ai/api/model/v1
   * Full endpoint: https://bharatcode.ai/api/model/v1/chat/completions
   */
  const endpoint = `${env.BHARATCODE_BASE_URL}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.BHARATCODE_API_KEY}`,
  };

  // Log with redacted auth — never log the real key
  if (process.env["NODE_ENV"] !== "production") {
    console.debug("[BharatCode] →", endpoint, safeHeaders(headers));
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.BHARATCODE_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === "AbortError") {
      throw new Error(
        `BharatCode API request timed out after ${env.BHARATCODE_TIMEOUT_MS}ms`
      );
    }
    throw new Error(`BharatCode API network error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(unreadable)");

    // Surface subscription errors with their action URL so the UI can link
    // the user directly to the upgrade/verification page.
    if (response.status === 402) {
      let actionUrl = "https://bharatcode.ai/account";
      try {
        const parsed = JSON.parse(errorBody) as {
          error?: { action_url?: string; message?: string };
        };
        actionUrl = parsed?.error?.action_url ?? actionUrl;
      } catch {
        // ignore parse failure
      }
      const subscriptionError = new Error(
        `BharatCode API: subscription required. ` +
          `Visit ${actionUrl} to activate your account.`
      ) as Error & { code: string; actionUrl: string };
      (subscriptionError as Error & { code: string }).code =
        "subscription_required";
      (subscriptionError as Error & { actionUrl: string }).actionUrl = actionUrl;
      throw subscriptionError;
    }

    throw new Error(
      `BharatCode API error ${response.status} ${response.statusText}: ${errorBody}`
    );
  }

  /**
   * TODO(bharatcode-api): Confirm response parsing.
   * Adjust path if the API does not return choices[0].message.content.
   */
  const data = (await response.json()) as BharatCodeResponse;
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim() === "") {
    throw new Error(
      "BharatCode API returned an empty or unexpected response shape. " +
        "TODO(bharatcode-api): check the response schema."
    );
  }

  return content.trim();
}

