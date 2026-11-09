# Sahayak — Offline-Capable Multilingual AI Tutor

Photograph a textbook page and get a grade-appropriate explanation with a 3-question practice quiz in your preferred language. Requests made offline are queued and processed when you reconnect.

Built for the **BharatCode Build League** hackathon.

## How It Works

Sahayak follows a four-step workflow:

| Step | Process | Description |
|---|---|---|
| **1. Extract** | Image to text | Uses the BharatCode vision model to extract textbook content and identify the subject and source language. If image extraction fails, the user can enter the text manually. |
| **2. Explain** | AI explanation | Uses `SYSTEM_EXPLAIN` to generate grade-appropriate explanations in the selected language, with short paragraphs and a worked example. |
| **3. Quiz** | Practice questions | Uses `SYSTEM_QUIZ` to generate a 3-question quiz in JSON format. Responses are validated using Zod and retried once if parsing fails. |
| **4. Cache** | Offline storage | Stores results in IndexedDB using a SHA-256 key based on the image, language, and grade. Identical requests can be served instantly from cache. |

## Model Usage

| Feature | Model | Implementation |
|---|---|---|
| Explanation | `BHARATCODE_MODEL` environment variable | `lib/bharatcode.ts` |
| Quiz generation | `BHARATCODE_MODEL` environment variable | `lib/bharatcode.ts` |
| OCR / Vision | `BHARATCODE_MODEL` environment variable | `lib/extract.ts` |
| Fallback OCR | Manual text entry | `lib/extract.ts` |

All model requests go through `lib/bharatcode.ts` using the shared `callModel()` function.

There are no undocumented model substitutions or hidden fallbacks.

See `docs/adaption.md` for instructions on integrating a fine-tuned Hindi model.

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/sahayak.git
cd sahayak
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
BHARATCODE_API_KEY=your_api_key
BHARATCODE_BASE_URL=https://bharatcode.ai/api/model/v1
BHARATCODE_MODEL=qwen-3.8-27b
BHARATCODE_TIMEOUT_MS=10000
```

Replace the API key and model identifier with values available to your BharatCode account.

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BHARATCODE_API_KEY` | Yes | BharatCode API key. Keep this secret. |
| `BHARATCODE_BASE_URL` | Yes | BharatCode API base URL. |
| `BHARATCODE_MODEL` | Yes | Model identifier available to your account. |
| `BHARATCODE_TIMEOUT_MS` | No | Request timeout in milliseconds. Defaults to `10000` (10 seconds). |

Environment variables are validated by `lib/env.ts`. The application throws an error if a required variable is missing.

For deployment, configure these variables in your hosting provider's environment variable settings.

## Project Structure

```text
app/
  page.tsx
  layout.tsx
  api/
    health/
      route.ts
    explain/
      route.ts

components/
  UploadCard.tsx
  ResultView.tsx
  OfflineBanner.tsx
  ServiceWorkerRegistrar.tsx

lib/
  bharatcode.ts
  env.ts
  extract.ts
  prompts.ts
  queue.ts
  types.ts

public/
  sw.js
  manifest.json
  favicon.svg

docs/
  adaption.md

BharatCode.txt
```

## PWA and Offline Behaviour

Sahayak supports offline usage through a Progressive Web App (PWA) architecture.

1. **Online:** Requests are sent directly to `/api/explain`.
2. **Offline:** Images and request settings are saved in an IndexedDB queue.
3. **Reconnect:** The service worker sends a `SAHAYAK_ONLINE` message, triggering `drainQueue()` to process pending requests.
4. **Cache hit:** Previously processed requests with the same image, language, and grade return instantly without another API call.

The interface displays a notification when a request is saved for later processing.

## Security

- API keys are accessed exclusively through server-side environment variables.
- `.env` and `.env.local` are excluded from Git using `.gitignore`.
- Only `.env.example` is committed to the repository.
- Authorization headers are redacted in development logs.
- API keys are never exposed through `NEXT_PUBLIC_` variables.
- `lib/env.ts` validates required configuration rather than silently accepting missing credentials.

## Hackathon Notes

- **Project:** Sahayak — Offline-Capable Multilingual AI Tutor
- **Event:** BharatCode Build League
- **Model provider:** BharatCode API
- **API client:** OpenAI-compatible chat completions
- **Architecture:** Next.js application with server-side API routes and client-side IndexedDB storage
- **Database:** No external database required
- **Authentication:** No user accounts required
- **Offline support:** Service worker and IndexedDB

See `BharatCode.txt` in the repository root for the hackathon-related information.

## License

MIT License
