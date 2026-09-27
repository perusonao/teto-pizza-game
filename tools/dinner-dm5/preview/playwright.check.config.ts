import { defineConfig, devices } from "@playwright/test";

/**
 * Dinner DM-5-1 Human Timing environment check (tools only, never CI). Build both bundles of the
 * same commit into one static root, then run:
 *   ROOT=/abs/www
 *   VITE_PREVIEW_MODE=1 VITE_PREVIEW_SHA=$(git rev-parse --short HEAD) \
 *     npx vite build --base=/teto-pizza-game-preview/ --outDir $ROOT/teto-pizza-game-preview
 *   sed "s/__DM5_BUILD__/$(git rev-parse --short HEAD)/" tools/dinner-dm5/preview/dm5-timing.html \
 *     > $ROOT/teto-pizza-game-preview/dm5-timing.html
 *   npx vite build --outDir $ROOT/teto-pizza-game
 *   DM5_WWW=$ROOT DM5_CHECK_OUT=/abs/out npx playwright test -c tools/dinner-dm5/preview/playwright.check.config.ts
 */
export default defineConfig({
  testDir: ".",
  testMatch: /dm5-timing\.check\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5190", screenshot: "off", trace: "off", video: "off" },
  projects: [
    { name: "iphone-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: `python3 -m http.server 5190 --bind 127.0.0.1 --directory ${process.env.DM5_WWW ?? "www"}`,
    url: "http://localhost:5190/teto-pizza-game-preview/dm5-timing.html",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
