import { defineConfig, devices } from "@playwright/test";

/**
 * Ingredient Category Tabs 1.0 Phase 0: read-only measurement of the CURRENT UI (no src change).
 * Not part of the e2e suite or CI.
 *   npx playwright test -c tools/ingredient-category-tabs/playwright.measure.config.ts
 * Writes docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_UI-MEASUREMENTS.json.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /measure\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:5184/teto-pizza-game/",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: "npm run dev -- --port 5184 --strictPort",
    url: "http://localhost:5184/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 60_000,
    cwd: "../..",
  },
});
