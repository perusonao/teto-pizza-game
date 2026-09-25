import { defineConfig, devices } from "@playwright/test";

/**
 * Production Visual P1 -- BEFORE/AFTER zero-regression harness (not part of `npm test` / CI).
 * Serves nothing itself: point W1_P1_BEFORE_URL / W1_P1_AFTER_URL at two static builds of the
 * production app (e.g. main vs the P1 commit, both `vite build`) and run
 *   npx playwright test -c tools/p1_visual_regression/playwright.config.ts
 * Every capture is pixel-compared; W1_P1_SHOTS_DIR (optional) keeps the PNGs and diff images.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /before-after\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../test-results/p1-visual-regression",
  projects: [
    { name: "chromium-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "chromium-360x800", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
    { name: "webkit-390x844", use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } } },
    { name: "webkit-360x800", use: { ...devices["Desktop Safari"], viewport: { width: 360, height: 800 } } },
  ],
});
