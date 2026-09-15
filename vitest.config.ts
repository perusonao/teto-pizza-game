import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom (added for Issue #24's HOME/GAME component tests) is a superset of what the
    // existing pure-logic/data `.test.ts` suite needs -- none of it depends on `window`
    // being absent, so switching the whole project over (rather than per-file) keeps one
    // config for every test.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
