import { defineConfig } from "vitest/config";

// LC-R6-a Fresh Audit probe only (manual; not part of `npm test` / CI).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tools/large-catalog-ux/r6a-bundle-probe.test.ts"],
    testTimeout: 300_000,
  },
});
