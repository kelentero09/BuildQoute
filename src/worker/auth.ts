import { betterAuth } from "better-auth";
import type { Env } from "./env";

export const MIN_PASSWORD_LENGTH = 10;

function buildAuth(env: Env) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET is missing or shorter than 32 characters.");
  }
  return betterAuth({
    appName: "BuildQuote",
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    // Set APP_URL in production (e.g. https://buildquote.example.com). Locally the request origin is used.
    baseURL: env.APP_URL || undefined,
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
      // Password reset needs outbound email, which is deliberately not part of the free MVP.
    },
    user: {
      additionalFields: {
        // Server-owned: `input: false` means no API request can set these.
        // Administrators are provisioned from the command line only (see README).
        role: { type: "string", required: false, defaultValue: "user", input: false },
        status: { type: "string", required: false, defaultValue: "active", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 10 },
        "/change-password": { window: 600, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "bq",
      // Cloudflare sets this header itself and overwrites any client-sent value.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}

export type Auth = ReturnType<typeof buildAuth>;

// Bindings are identical for every request handled by an isolate, so one instance is reused.
let cached: Auth | undefined;

export function getAuth(env: Env): Auth {
  cached ??= buildAuth(env);
  return cached;
}
