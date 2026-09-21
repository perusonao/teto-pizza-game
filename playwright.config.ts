import { defineConfig, devices } from "@playwright/test";

/**
 * Viewport 1-screen-completion regression suite (see docs/reports/
 * TETO_VIEWPORT-1SCREEN_Result.md). Real-browser only -- vitest/jsdom (vitest.config.ts) never
 * lays out real pixels, so it cannot see page/body scroll, modal height, or overflow at all;
 * this is the one place those get asserted against real Chromium layout instead of just
 * component structure.
 *
 * Deliberately NOT wired into `npm test` or `.github/workflows/ci.yml` -- this task's own
 * "workflow変更禁止" boundary. Run locally/manually with `npm run test:e2e` (starts its own
 * dev server via `webServer` below, matching `npm run dev`'s port).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5183/teto-pizza-game/",
  },
  projects: [
    {
      name: "iphone-390x844",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "iphone-360x800",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
