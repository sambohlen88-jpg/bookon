import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next compiles JSX itself; tests need the React 17+ transform.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
