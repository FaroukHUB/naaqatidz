import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests exécutés contre un vrai PostgreSQL (voir docs/tests.md).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // « server-only » interdit l'import côté client ; neutralisé pour les tests Node.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
  },
});
