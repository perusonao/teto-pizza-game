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
    /* PR-A (Issue #167 §13): Phase 0's own Fresh Audit (docs/reports/
       TETO_COOKING-UI_1SCREEN-2.0_Phase0_Fresh-Audit.md §3/§5) named "both projects above run on
       Desktop Chrome, never WebKit" as a concrete, verifiable reason this suite can PASS while a
       real iPhone Safari clips/scrolls. This project is this PR-A's own local verification step,
       not yet PR-C's full Verification Hardening -- see the Result Report for whether WebKit was
       actually reachable in this session's environment, and its own results if so. Not run by CI
       (this file is not wired into `.github/workflows/ci.yml` at all, per the file header above)
       and not a claim that Playwright WebKit is equivalent to real hardware -- font *availability*
       on this machine is still not Apple's own (Phase 0 §3.2) -- only that it is structurally
       closer than Desktop Chrome, and free to add locally regardless. */
    {
      name: "webkit-390x844",
      use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-360x800",
      use: { ...devices["Desktop Safari"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
