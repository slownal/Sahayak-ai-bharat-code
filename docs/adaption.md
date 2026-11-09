# Sahayak — Model Adaption Guide

This document explains how the Sahayak harness is designed for easy model
swapping, and gives a concrete example of how a fine-tuned Hindi explain
model would be integrated.

---

## Current architecture

All model calls flow through a single function:

```
lib/bharatcode.ts → callModel({ system, user, image?, json? })
```

The model identifier is read from the `BHARATCODE_MODEL` environment variable.
No model name is hard-coded anywhere in the application.

---

## How the harness uses the model

```
Request
  │
  ▼
Step 1 — Extract      callModel({ image: base64, user: EXTRACT_PROMPT })
  │                   → structured page text + subject + language
  ▼
Step 2 — Explain      callModel({ system: buildExplainPrompt(lang, grade), user: pageText })
  │                   → explanation string
  ▼
Step 3 — Quiz         callModel({ system: buildQuizPrompt(lang, grade), user: pageText, json: true })
  │                   → { questions: [...] }  (Zod-validated)
  ▼
Step 4 — Cache        IndexedDB.set(hash(image|lang|grade), result)
```

---

## Swapping in a fine-tuned Hindi explain model

Suppose you have trained a BharatCode model specialised in Hindi
middle-school explanations, with identifier `qwen-hindi-edu-7b`.

### Option A — Single global model (simplest)

Change one line in `.env`:

```env
BHARATCODE_MODEL=qwen-hindi-edu-7b
```

This routes **all three steps** (extract, explain, quiz) through the new
model. Suitable if the fine-tuned model also handles vision and JSON quiz
generation.

### Option B — Per-step model selection (recommended for production)

Add a second env var:

```env
BHARATCODE_MODEL=qwen-3.8-27b          # vision + quiz
BHARATCODE_EXPLAIN_MODEL=qwen-hindi-edu-7b  # explain only
```

Then extend `lib/bharatcode.ts → callModel()` to accept an optional `model`
override:

```typescript
// lib/bharatcode.ts (addition only)
export async function callModel(
  input: CallModelInput & { modelOverride?: string }
): Promise<string> {
  const env = loadEnv();
  const model = input.modelOverride ?? env.BHARATCODE_MODEL;
  // ... rest of implementation unchanged
}
```

And update `app/api/explain/route.ts` Step 2:

```typescript
// Step 2 — Explain (with per-step model)
explanation = await callModel({
  system: buildExplainPrompt(language, grade),
  user: `Here is the textbook content:\n\n${pageText}`,
  modelOverride: process.env["BHARATCODE_EXPLAIN_MODEL"],
});
```

No other files need changing.

---

## What does NOT need to change

| Component | Stable? | Why |
|---|---|---|
| `lib/prompts.ts` | ✅ Yes | Prompt text is model-agnostic |
| `lib/extract.ts` | ✅ Yes | Vision interface is unchanged |
| `lib/queue.ts` | ✅ Yes | Queue is model-agnostic |
| `lib/types.ts` | ✅ Yes | Types describe data, not models |
| All UI components | ✅ Yes | UI only reads `result.meta.model` for display |
| `/api/health` | ✅ Yes | Reads `BHARATCODE_MODEL` from env |

---

## Adding a non-BharatCode fallback

If you need a secondary OCR provider (e.g., Google Cloud Vision) as a
fallback for image extraction:

1. Implement it in `lib/extract.ts` behind the existing `extractText()` signature.
2. Document it in `README.md § "Model usage"` — the spec requires no hidden substitutions.
3. Add the new provider's API key as an env var and validate it in `lib/env.ts`.

The calling code in `app/api/explain/route.ts` remains unchanged.

---

*Generated for the BharatCode Build League hackathon. Sahayak, 2026.*

