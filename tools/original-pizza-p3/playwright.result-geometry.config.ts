import { defineConfig, devices } from "@playwright/test";

/**
 * Original Pizza Recovery P3-3 Fresh Audit: ORIGINAL RESULT geometry harness (manual, NOT part of CI or
 * `npm run test:e2e`). Read-only: it plays real Free Cooking rounds to an ORIGINAL result and measures the
 * current layout, then injects stand-in DOM (with the app's own classes) to predict the height of a
 * duplicate notice and a Notebook entry CTA. It changes no app code.
 *   npx playwright test -c tools/original-pizza-p3/playwright.result-geometry.config.ts
 */
export default defineConfig({
  testDir: ".",
  testMatch: /result-geometry\.measure\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5185/teto-pizza-game/" },
  webServer: {
    command: "npm run dev -- --port 5185 --strictPort",
    url: "http://localhost:5185/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
