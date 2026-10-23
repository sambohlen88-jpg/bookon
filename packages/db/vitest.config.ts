import { defineConfig } from "vitest/config";

export default defineConfig({
  // Starting an in-memory database takes a few seconds, more while other packages test too.
  // Some tests start their own.
  test: { hookTimeout: 60_000, testTimeout: 60_000 },
});
