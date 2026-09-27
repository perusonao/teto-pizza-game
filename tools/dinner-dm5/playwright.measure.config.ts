import { defineConfig, devices } from "@playwright/test";

/**
 * Dinner DM-4 / DM-5 Fresh Audit measurement config (tools only, never CI). Run from a checkout of
 * PR #252's head with this directory copied into it:
 *   DM5_OUT=/abs/path/dm5-measure.jsonl npx playwright test -c tools/dinner-dm5/playwright.measure.config.ts
 */
export default defineConfig({
  testDir: ".",
  testMatch: /measure\.play\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5183/teto-pizza-game/", screenshot: "off", trace: "off", video: "off" },
  projects: [
    { name: "iphone-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "iphone-360x800", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 60_000,
    cwd: "../..",
  },
});
