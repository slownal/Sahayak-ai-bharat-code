/**
 * lib/env.ts
 *
 * Validates required environment variables at startup.
 * Called at the top of lib/bharatcode.ts so any missing var throws
 * a clear, actionable error before any model call is attempted.
 *
 * Security: API key is read from process.env only — never from source,
 * logs, or any other path.
 */

export interface Env {
  BHARATCODE_API_KEY: string;
  BHARATCODE_BASE_URL: string;
  BHARATCODE_MODEL: string;
  BHARATCODE_TIMEOUT_MS: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[Sahayak] Missing required environment variable: ${name}\n` +
        `  Copy .env.example → .env and fill in the real values.\n` +
        `  See README.md § "Setup" for details.`
    );
  }
  return value.trim();
}

/** Validated env — call once at module load in server-only files. */
export function loadEnv(): Env {
  return {
    BHARATCODE_API_KEY: requireEnv("BHARATCODE_API_KEY"),
    BHARATCODE_BASE_URL: requireEnv("BHARATCODE_BASE_URL"),
    BHARATCODE_MODEL: requireEnv("BHARATCODE_MODEL"),
    BHARATCODE_TIMEOUT_MS: parseInt(
      process.env["BHARATCODE_TIMEOUT_MS"] ?? "90000",
      10
    ),
  };
}

