import { defineConfig } from "vitest/config";

export default defineConfig({
  // Starting an in-memory database takes a few seconds, more while other packages test too.
  test: { hookTimeout: 60_000 },
});
