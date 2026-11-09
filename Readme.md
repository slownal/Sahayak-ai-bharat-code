# Sahayak — Offline-Capable Multilingual AI Tutor

> Photograph a textbook page → get a grade-appropriate explanation and a
> 3-question practice quiz in your language. Requests made offline are
> queued and answered when you reconnect.

Built for the **BharatCode Build League** hackathon.

---

## How it works — 4-step harness

| Step | What happens |
|------|-------------|
| **1. Extract** | Image → structured text via BharatCode vision model; subject & source language detected. If vision fails, UI prompts manual text entry. |
| **2. Explain** | `callModel()` with `SYSTEM_EXPLAIN` prompt; enforces target language, grade reading level, short paragraphs, one worked example. |
| **3. Quiz** | `callModel()` with `SYSTEM_QUIZ` prompt; strict JSON schema; validated with Zod; retried once on parse failure. |
| **4. Cache** | Result stored in IndexedDB keyed by SHA-256(`image|language|grade`). Identical requests resolve instantly from cache. |

---

## Model usage

| Path | Model | File |
|------|-------|------|
| Explain | `BHARATCODE_MODEL` env var (BharatCode API) | `lib/bharatcode.ts` |
| Quiz | `BHARATCODE_MODEL` env var (BharatCode API) | `lib/bharatcode.ts` |
| OCR / vision | `BHARATCODE_MODEL` env var — same model, vision call | `lib/extract.ts` |
| Fallback OCR | None (UI prompts manual entry instead) | `lib/extract.ts` |

**No hidden substitutions.** Every model call goes through `lib/bharatcode.ts → callModel()`. Any future fallback must be documented here.

> See `docs/adaption.md` for how to swap in a fine-tuned Hindi model.

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/sahayak.git
cd sahayak

# 2. Copy env template and fill in real values
cp .env.example .env
# Edit .env — add BHARATCODE_API_KEY, confirm BHARATCODE_BASE_URL and BHARATCODE_MODEL

# 3. Install dependencies
npm install

# 4. Run the dev server
npm run dev
# → open http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `BHARATCODE_API_KEY` | ✅ Yes | Your BharatCode API key (keep secret) |
| `BHARATCODE_BASE_URL` | ✅ Yes | BharatCode API base URL (e.g. `https://api.bharatcode.ai/v1`) |
| `BHARATCODE_MODEL` | ✅ Yes | Model identifier (e.g. `qwen-3.8-27b`) |
| `BHARATCODE_TIMEOUT_MS` | No | Request timeout in ms (default: `30000`) |

> `lib/env.ts` validates all required vars at startup and throws a clear error if any is missing.

---

## Project structure

```
app/
  page.tsx                  ← Single-screen UI
  layout.tsx                ← PWA metadata + service worker registrar
  api/
    health/route.ts         ← GET /api/health — env validation check
    explain/route.ts        ← POST /api/explain — 4-step harness
components/
  UploadCard.tsx            ← Image upload, language/grade selectors
  ResultView.tsx            ← Explanation + quiz with reveal
  OfflineBanner.tsx         ← Offline status banner
  ServiceWorkerRegistrar.tsx← Registers public/sw.js
lib/
  bharatcode.ts             ← callModel() — single BharatCode client
  env.ts                    ← Env var validation at startup
  extract.ts                ← Step 1: image → page text
  prompts.ts                ← All LLM prompts with design comments
  queue.ts                  ← IndexedDB offline queue + result cache
  types.ts                  ← Shared TypeScript types
public/
  sw.js                     ← Service worker (shell cache + online drain)
  manifest.json             ← PWA manifest
  favicon.svg               ← SVG favicon (saffron + "स")
docs/
  adaption.md               ← How to swap in a fine-tuned model
BharatCode.txt              ← Hackathon required file
```

---

## PWA / Offline behaviour

1. **Online** — requests go straight to `/api/explain`.
2. **Offline** — image + settings stored in IndexedDB (`lib/queue.ts`).  
   Banner reads: *"Saved — will answer when you reconnect."*
3. **Reconnect** — service worker fires `SAHAYAK_ONLINE` message →  
   `drainQueue()` processes all pending items automatically.
4. **Cache hit** — same image + language + grade → instant result, no API call.

---

## Security

- API key is read **only** from `process.env.BHARATCODE_API_KEY`.
- `.env` is in `.gitignore` from the first commit. Only `.env.example` is committed.
- `lib/bharatcode.ts` redacts the `Authorization` header value in any log output.
- `lib/env.ts` throws a clear error if the key is missing — it is never silently `undefined`.

---

## Hackathon notes

> No secrets are committed; the repo passes the hackathon's no-secrets rule.

- Model: BharatCode API — see `BharatCode.txt` in repo root.
- No database, no accounts, no payments — everything is client-side except model calls.
- One screen, no routing complexity.
- Fully offline-capable via PWA service worker + IndexedDB queue.

---

## License

MIT

# → open http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `BHARATCODE_API_KEY` | ✅ Yes | Your BharatCode API key (keep secret) |
| `BHARATCODE_BASE_URL` | ✅ Yes | BharatCode API base URL (e.g. `https://api.bharatcode.ai/v1`) |
| `BHARATCODE_MODEL` | ✅ Yes | Model identifier (e.g. `qwen-3.8-27b`) |
| `BHARATCODE_TIMEOUT_MS` | No | Request timeout in ms (default: `30000`) |

> `lib/env.ts` validates all required vars at startup and throws a clear error if any is missing.

---

## Project structure

```
app/
  page.tsx                  ← Single-screen UI
  layout.tsx                ← PWA metadata + service worker registrar
  api/
    health/route.ts         ← GET /api/health — env validation check
    explain/route.ts        ← POST /api/explain — 4-step harness
components/
  UploadCard.tsx            ← Image upload, language/grade selectors
  ResultView.tsx            ← Explanation + quiz with reveal
  OfflineBanner.tsx         ← Offline status banner
  ServiceWorkerRegistrar.tsx← Registers public/sw.js
lib/
  bharatcode.ts             ← callModel() — single BharatCode client
  env.ts                    ← Env var validation at startup
  extract.ts                ← Step 1: image → page text
  prompts.ts                ← All LLM prompts with design comments
  queue.ts                  ← IndexedDB offline queue + result cache
  types.ts                  ← Shared TypeScript types
public/
  sw.js                     ← Service worker (shell cache + online drain)
  manifest.json             ← PWA manifest
  favicon.svg               ← SVG favicon (saffron + "स")
docs/
  adaption.md               ← How to swap in a fine-tuned model
BharatCode.txt              ← Hackathon required file
```

---

## PWA / Offline behaviour

1. **Online** — requests go straight to `/api/explain`.
2. **Offline** — image + settings stored in IndexedDB (`lib/queue.ts`).  
   Banner reads: *"Saved — will answer when you reconnect."*
3. **Reconnect** — service worker fires `SAHAYAK_ONLINE` message →  
   `drainQueue()` processes all pending items automatically.
4. **Cache hit** — same image + language + grade → instant result, no API call.

---

## Security

- API key is read **only** from `process.env.BHARATCODE_API_KEY`.
- `.env` is in `.gitignore` from the first commit. Only `.env.example` is committed.
- `lib/bharatcode.ts` redacts the `Authorization` header value in any log output.
- `lib/env.ts` throws a clear error if the key is missing — it is never silently `undefined`.

---

## Hackathon notes

> No secrets are committed; the repo passes the hackathon's no-secrets rule.

- Model: BharatCode API — see `BharatCode.txt` in repo root.
- No database, no accounts, no payments — everything is client-side except model calls.
- One screen, no routing complexity.
- Fully offline-capable via PWA service worker + IndexedDB queue.

---

## License

MIT