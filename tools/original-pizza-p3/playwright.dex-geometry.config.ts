import { defineConfig, devices } from "@playwright/test";

/**
 * Original Pizza Recovery P3 Fresh Audit: Dex geometry harness (manual, NOT part of CI or
 * `npm run test:e2e`). Measures the CURRENT Recipe Dex at 390x844 and 360x800 so the P3 Dex /
 * Notebook alternatives can be sized against real card heights. Read-only; it changes no app code.
 *   npx playwright test -c tools/original-pizza-p3/playwright.dex-geometry.config.ts
 */
export default defineConfig({
  testDir: ".",
  testMatch: /dex-geometry\.measure\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5184/teto-pizza-game/" },
  webServer: {
    command: "VITE_PREVIEW_MODE=1 npm run dev -- --port 5184 --strictPort",
    url: "http://localhost:5184/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
