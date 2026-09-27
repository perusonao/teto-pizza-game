import { defineConfig, devices } from "@playwright/test";

/**
 * Wave 2 W2-A Authoring Gate: a read-only prototype / measurement harness. NOT part of the e2e
 * suite or CI, and it changes no src file: the 8 W2-A ingredients and the white-sauce colour
 * candidates are injected only into the browser, by rewriting the dev server's response for
 * src/data/ingredients.ts (page.route). Writes docs/reports/data/TETO_WAVE2_W2A_UI-PROBE.json and
 * screenshots under docs/reports/screenshots/wave2-w2a-authoring/.
 *
 *   npx playwright test -c tools/wave2-w2a/playwright.probe.config.ts
 */
export default defineConfig({
  testDir: ".",
  testMatch: /probe\.spec\.ts$/,
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
