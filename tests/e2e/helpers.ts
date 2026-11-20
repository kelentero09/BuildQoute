import { execSync } from "node:child_process";
import { request, type APIRequestContext } from "@playwright/test";
import { TEST_PORT, TEST_STATE_DIR } from "../../playwright.config";

export const ORIGIN = `http://localhost:${TEST_PORT}`;
export const PASSWORD = "correct-horse-battery-9";
export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** A separate cookie jar, sending the Origin header a browser would send. */
export function newClient(origin: string | null = ORIGIN): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: ORIGIN,
    extraHTTPHeaders: { "User-Agent": BROWSER_UA, ...(origin ? { Origin: origin } : {}) },
  });
}

export async function register(client: APIRequestContext, name: string, email: string, extra: Record<string, unknown> = {}) {
  return client.post("/api/auth/sign-up/email", { data: { name, email, password: PASSWORD, ...extra } });
}

/** Runs SQL against the test database, the same way an operator provisions an administrator. */
export function sql(command: string): void {
  execSync(`npx wrangler d1 execute buildquote --local --persist-to ${TEST_STATE_DIR} --command "${command}"`, {
    stdio: "pipe",
    env: { ...process.env, CI: "1" },
  });
}

export function sampleQuotation(overrides: Record<string, unknown> = {}) {
  return {
    number: "BQ-20261120-TEST",
    projectName: "Test Project",
    clientName: "Test Client",
    location: "",
    date: "2026-11-20",
    validUntil: "2026-12-20",
    mode: "detailed",
    items: [
      { id: "a", description: "Tiles", amount: "", quantity: "12.5", unit: "sq.m", unitPrice: "850.75" },
      { id: "b", description: "Labor", amount: "", quantity: "3", unit: "day", unitPrice: "1200" },
    ],
    discountType: "percent",
    discountValue: "10",
    paymentTerms: "",
    duration: "",
    scopeNotes: "",
    exclusions: "",
    remarks: "",
    template: "modern",
    ...overrides,
  };
}

/** Smallest valid PNG (1x1 transparent pixel). */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
