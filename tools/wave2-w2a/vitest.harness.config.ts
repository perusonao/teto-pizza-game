import { defineConfig } from "vitest/config";

/**
 * Wave 2 W2-A Authoring Gate harness: runs the real Scoring 2.0 / Completion Gate / persistence /
 * entitlement code against the W2-A authoring CANDIDATES without changing any src file. Not part
 * of `npm test`. Run: npx vitest run --config tools/wave2-w2a/vitest.harness.config.ts
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tools/wave2-w2a/*.harness.test.ts"],
  },
});
