import { defineConfig } from "vitest/config";

// Unit tests for shared logic. Worker integration tests use vitest.worker.config.ts.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
