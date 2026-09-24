import { defineConfig } from "vitest/config";

// Standalone config: this harness is not part of `npm test` (the root config only includes
// src/**). See ./run.sh.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tools/pr206-forward-compat-sim/**/*.test.ts"],
  },
  server: { fs: { strict: false } },
});
