import { defineConfig, devices } from "@playwright/test";

/** Discovery 3.0 S1 (I) browser reproduction config: measurement tooling, NOT part of `npm run test:e2e` or CI.
 *  Run: npx playwright test --config tools/discovery3-s1/playwright.s1.config.ts */
export default defineConfig({
  testDir: ".",
  testMatch: /almost-there-oracle\.spec\.ts$/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5183/teto-pizza-game/", screenshot: "only-on-failure", trace: "off", video: "off" },
  projects: [{ name: "iphone-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: { command: "npm run dev -- --port 5183 --strictPort", cwd: "../..", url: "http://localhost:5183/teto-pizza-game/", reuseExistingServer: true, timeout: 30_000 },
});
