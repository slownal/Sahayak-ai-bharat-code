/**
 * app/api/health/route.ts
 *
 * GET /api/health
 *
 * Returns 200 { ok: true, model, timestamp } when all required env vars
 * are present and correctly loaded.  Returns 500 with an error message if
 * any required var is missing (without leaking the key value).
 *
 * Manual test: curl http://localhost:3000/api/health
 */

import { NextResponse } from "next/server";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const env = loadEnv();

    return NextResponse.json(
      {
        ok: true,
        model: env.BHARATCODE_MODEL,
        baseUrl: env.BHARATCODE_BASE_URL,
        // Key presence only — never log the key value
        apiKeyPresent: env.BHARATCODE_API_KEY.length > 0,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown startup error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

