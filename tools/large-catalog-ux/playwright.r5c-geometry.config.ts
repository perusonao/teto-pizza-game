import { defineConfig, devices } from "@playwright/test";

/**
 * LC-R5-c Fresh Audit geometry harness config (manual, NOT part of CI or `npm run test:e2e`):
 *   npx playwright test -c tools/large-catalog-ux/playwright.r5c-geometry.config.ts
 * Chromium only; the spec drives its own viewports.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /r5c-geometry\.measure\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5183/teto-pizza-game/" },
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
