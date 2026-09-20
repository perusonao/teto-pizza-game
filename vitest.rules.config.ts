import { defineConfig } from "vitest/config";

// Firebase Ranking 1.0 Phase 1B (Issue #87). A separate config from the root `vitest.config.ts`
// on purpose: `firestore.rules.test.ts` needs a running Firestore emulator and
// `@firebase/rules-unit-testing` (not a project dependency -- see that file's own header), so
// it is never picked up by the root `npm test` / CI run, only by an explicit, manually-invoked
// `vitest run --config vitest.rules.config.ts`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["firestore.rules.test.ts"],
    testTimeout: 20_000,
  },
});
