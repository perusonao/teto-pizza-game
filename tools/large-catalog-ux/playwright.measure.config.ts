import { defineConfig, devices } from "@playwright/test";

/**
 * Large Catalog UX Fresh Design: a read-only measurement harness, NOT part of the e2e suite or CI.
 * It drives the current production UI (unchanged) at 360x640 / 360x800 / 390x844 and writes the
 * measured layout facts to docs/reports/data/TETO_LARGE-CATALOG-UX_UI-MEASUREMENTS.json and
 * screenshots to docs/reports/screenshots/large-catalog-ux/.
 *
 *   npx playwright test -c tools/large-catalog-ux/playwright.measure.config.ts
 *   python3 tools/large_catalog_ux_scale_model.py        # then the projection model
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
    baseURL: "http://localhost:5183/teto-pizza-game/",
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 30_000,
    cwd: "../..",
  },
});
