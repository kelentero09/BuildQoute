import { defineConfig } from "@playwright/test";

export const TEST_PORT = 5180;
export const TEST_STATE_DIR = ".wrangler/test-state";
const baseURL = `http://localhost:${TEST_PORT}`;

/**
 * End-to-end and security tests. They start the real app (Vite + local Worker + local D1)
 * against a throwaway database, so they need no Cloudflare account and touch nothing remote.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one database and the sign-in rate limiter, so they run in order.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    // Reset the throwaway database, then start the app.
    command: `node tests/e2e/reset-db.mjs && npx vite dev --port ${TEST_PORT} --strictPort`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BQ_STATE_DIR: TEST_STATE_DIR },
  },
  projects: [
    { name: "api", testMatch: /api\.spec\.ts/ },
    { name: "ui", testMatch: /ui\.spec\.ts/, dependencies: ["api"] },
    // Runs last: it deliberately exhausts the sign-in rate limit.
    { name: "abuse", testMatch: /abuse\.spec\.ts/, dependencies: ["ui"] },
  ],
});
