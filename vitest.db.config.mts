import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test su Postgres vero (npm run test:db). Richiede TEST_DATABASE_URL verso un database
 * LOCALE usa-e-getta: il setup lo svuota e riapplica le migrazioni.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.dbtest.ts"],
    globalSetup: ["./test/db-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      DATABASE_URL_UNPOOLED: process.env.TEST_DATABASE_URL ?? "",
    },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
