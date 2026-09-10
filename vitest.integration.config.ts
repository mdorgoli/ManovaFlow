import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    exclude: [],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000
  }
});
