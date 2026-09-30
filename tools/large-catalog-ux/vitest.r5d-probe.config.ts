import { defineConfig } from "vitest/config";

// LC-R5-d Fresh Audit probe only (manual; not part of `npm test` / CI).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tools/large-catalog-ux/r5d-hand-probe.test.ts"],
  },
});
