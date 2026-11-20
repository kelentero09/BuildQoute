// Start every test run from an empty local database with the real migrations applied.
// Runs before the dev server starts (see playwright.config.ts).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const dir = process.env.BQ_STATE_DIR;
if (!dir) throw new Error("BQ_STATE_DIR is not set");
rmSync(dir, { recursive: true, force: true });
execSync(`npx wrangler d1 migrations apply buildquote --local --persist-to ${dir}`, {
  stdio: "inherit",
  env: { ...process.env, CI: "1" },
});
