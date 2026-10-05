import { defineConfig, devices } from "@playwright/test";

/**
 * Ingredient Pantry / Category Tabs geometry harness config (manual, NOT part of CI or `npm run test:e2e`):
 *   GEOMETRY_OUT=<file> [GEOMETRY_PORT=5183] npx playwright test -c tools/ingredient-category-tabs/playwright.pantry-family-geometry.config.ts
 * Chromium only; the spec drives its own viewports.
 */
const port = process.env.GEOMETRY_PORT ?? "5183";
export default defineConfig({
  testDir: ".",
  testMatch: /pantry-family-geometry\.measure\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${port}/teto-pizza-game/` },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/teto-pizza-game/`,
    reuseExistingServer: true,
    env: { TETO_TEST_HOOKS: "1" },
    timeout: 60_000,
  },
});
