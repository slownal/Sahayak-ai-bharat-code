# Sahayak Build Specification

You are building Sahayak, an offline-capable multilingual AI tutor for Indian
students. This is a BharatCode Build League hackathon submission. Judging
criteria: working product, GitHub stars, community votes, judges' evaluation.
BharatCode API is the primary model path. Repo must have BharatCode.txt in root.

## Product definition (MVP — do not scope-creep)

A student can:
1. Photograph a textbook page (or upload an image).
2. Get an explanation in their chosen language (English, Hindi, configurable
   regional language — default Hindi) at a grade level (Class 6–12).
3. Get 3 practice questions from the same page, answers hidden behind reveal.
4. Queue requests offline — photo + prompt stored locally, "Saved — will answer
   when online", auto-processed on reconnect.

No accounts, no payments, no teacher dashboards. One clean workflow.

## Tech stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind. PWA with service worker.
- Backend: Next.js API routes (no separate server).
- Model calls: BharatCode API. Abstract behind lib/bharatcode.ts with a single
  callModel({ system, user, image?, json? }) function. Read BHARATCODE_API_KEY,
  BHARATCODE_BASE_URL, BHARATCODE_MODEL from env. If exact endpoint shape is
  unknown, scaffold with a clearly-marked TODO — do not invent URLs.
- OCR/vision: send image to vision-capable BharatCode model if available;
  otherwise fallback OCR behind lib/extract.ts with clean interface.
- Offline queue: IndexedDB (idb library) storing { id, imageBlob, language,
  grade, status, result }. Service worker + online event drains queue.
- No database. Everything client-side.

## Harness design (make explicit — judges read this)

- Step 1 — Extract: image → structured text (page content, subject, language).
- Step 2 — Explain: system prompt enforces target language, grade reading
  level, short paragraphs, one worked example, no hallucinated facts — if
  unsure, say so.
- Step 3 — Quiz: strict JSON ({ questions: [{ q, options, answerIndex,
  explanation }] }). Validate; retry once on parse fail with "return ONLY
  valid JSON" nudge.
- Step 4 — Cache: IndexedDB keyed by hash of (image + language + grade).

Put prompts in lib/prompts.ts as named exports with design-intent comments.

## Model usage policy

- BharatCode is the mandated primary model path for explain and quiz steps.
- Any fallback (e.g., OCR/vision) lives behind lib/extract.ts and MUST be
  documented in README under "Model usage" — no hidden substitutions.
- BHARATCODE_MODEL selects model; default to standard text model from docs.

## Security (non-negotiable)

- API key read ONLY from process.env.BHARATCODE_API_KEY. Never in source,
  README, BharatCode.txt, tests, or logs.
- .env in .gitignore from first commit. Commit only .env.example.
- lib/env.ts validates required env vars at startup, throws clear error if
  missing.
- Redact Authorization if logging request headers.
- README "Hackathon notes" must state: "No secrets are committed; the repo
  passes the hackathon's no-secrets rule."

## Engineering rules

- TypeScript strict mode. No any in exported function signatures.
- All money/grade logic deterministic — never let model do arithmetic/grading.
- Validate every model response with Zod (or hand-rolled). On failure, friendly
  error, never crash.
- Graceful degradation: if vision fails, offer text input instead.
- Accessibility: large tap targets, readable fonts, aria-live on results.
- Keep UI to one screen. No routing complexity.

## Files to create

app/page.tsx, app/api/explain/route.ts, app/api/health/route.ts,
components/UploadCard.tsx, components/ResultView.tsx,
components/OfflineBanner.tsx, lib/bharatcode.ts, lib/extract.ts,
lib/prompts.ts, lib/queue.ts, lib/env.ts, lib/types.ts, public/sw.js,
public/manifest.json, BharatCode.txt (REQUIRED), README.md,
docs/adaption.md, .env.example, .gitignore.

## Process

1. First output: phased plan (Phase 1: scaffold + env validation + BharatCode
   client + health route; Phase 2: extract/explain/quiz API; Phase 3: UI;
   Phase 4: offline queue + PWA; Phase 5: README/BharatCode.txt/
   docs/adaption.md/polish). Ask blocking questions (e.g., exact BharatCode
   endpoint if unknown).
2. Wait for "go".
3. Build phase by phase, pausing for review.
4. After each phase, list manual tests and required env vars.

Begin with the phased plan and blocking questions. Do not write code yet.