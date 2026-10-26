import { defineConfig, devices } from "@playwright/test";

/** Phase 0 measurement only (Issue #676). Reads the app; writes nothing outside OUT_DIR. Run from the repo root:
 *  npx playwright test -c tools/discovery-failure-guidance-audit/playwright.config.ts */
export default defineConfig({
  testDir: ".",
  testMatch: /capture\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5185/teto-pizza-game/", video: "off", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } }],
  webServer: {
    command: "npm run dev -- --port 5185 --strictPort",
    url: "http://localhost:5185/teto-pizza-game/",
    env: { TETO_TEST_HOOKS: "1" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
