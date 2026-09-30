import { defineConfig } from "vitest/config";

/** Manual config for the P3-3 Fresh Audit lifecycle probe (not part of `npm test`):
 *  npx vitest run -c tools/original-pizza-p3/vitest.lifecycle-probe.config.ts */
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tools/original-pizza-p3/*.probe.test.ts"],
  },
});
