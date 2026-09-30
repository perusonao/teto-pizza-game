import { defineConfig } from "vitest/config";

/** Discovery 3.0 S1 measurement probe (tooling, NOT a CI test, NOT production code).
 *  Run: npx vitest run --config tools/discovery3-s1/vitest.s1.config.ts */
export default defineConfig({
  test: { include: ["tools/discovery3-s1/**/*.test.ts"], environment: "node" },
});
