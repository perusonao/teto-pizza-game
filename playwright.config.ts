import { defineConfig, devices } from "@playwright/test";

/**
 * Viewport 1-screen-completion regression suite (see docs/reports/
 * TETO_VIEWPORT-1SCREEN_Result.md). Real-browser only -- vitest/jsdom (vitest.config.ts) never
 * lays out real pixels, so it cannot see page/body scroll, modal height, or overflow at all;
 * this is the one place those get asserted against real Chromium layout instead of just
 * component structure.
 *
 * Deliberately NOT wired into `npm test` or `.github/workflows/ci.yml`'s own fast lint/vitest/
 * build job (PR-A/PR-B's own "workflow変更禁止" boundary, still respected -- that job is
 * untouched). Run locally/manually with `npm run test:e2e` (starts its own dev server via
 * `webServer` below, matching `npm run dev`'s port).
 *
 * Issue #167 PR-C (Verification Hardening): the `webkit-*` projects below ARE now wired into CI,
 * via a dedicated `.github/workflows/e2e-webkit.yml` job that runs on every PR to `main`,
 * separately from the fast job above -- see that file's own header comment and the Result
 * Report (docs/reports/TETO_COOKING-UI_1SCREEN-2.0_PRC_Verification-Hardening_Result.md) for the
 * full before/after CI architecture and runtime trade-off. The `iphone-*` (Chromium) projects
 * remain local/manual-only, unchanged from before this PR.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5183/teto-pizza-game/",
    // I5b-5 (Design d4f96d0 §12, Preflight §8): failure artifacts only; video stays off (Human
    // Verification videos are recorded separately, per the policy). Trace is off on the WebKit
    // projects (Preflight §8 / R-4: WebKit shard time grew >10% with it; CI run 36221528804).
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "iphone-390x844",
      testIgnore: /layout-contract\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "iphone-360x800",
      testIgnore: /layout-contract\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } },
    },
    /* Progression 2.0 W1 I5b-5 Layout Contract (e2e/layout-contract.spec.ts): one Chromium
       project that cycles all 7 profiles (N390 / N360 / S390 / S360 and the CDP safe-area
       profiles P390i / E390i / E360i) inside each test -- see e2e/support/layoutProfiles.ts.
       The WebKit projects below also run the spec, cycling only the N and S profiles of their
       own width. */
    {
      name: "layout-chromium",
      testMatch: /layout-contract\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    /* PR-A (Issue #167 §13): Phase 0's own Fresh Audit (docs/reports/
       TETO_COOKING-UI_1SCREEN-2.0_Phase0_Fresh-Audit.md §3/§5) named "both projects above run on
       Desktop Chrome, never WebKit" as a concrete, verifiable reason this suite can PASS while a
       real iPhone Safari clips/scrolls. PR-A added these two projects for local use only, with
       WebKit itself unreachable in that session's own network-restricted environment (see that
       PR's Result Report). PR-C (Verification Hardening) is what actually wires these into CI --
       `.github/workflows/e2e-webkit.yml`, a dedicated job separate from `ci.yml`'s fast lint/
       vitest/build job -- and re-confirmed the same download-blocked limitation locally, so
       GitHub Actions (not this sandbox) is the authority for whether WebKit itself launches and
       passes; see the PR-C Result Report for that job's actual run evidence. Still not a claim
       that Playwright WebKit is equivalent to real hardware -- font *availability* on any of
       these machines is still not Apple's own (Phase 0 §3.2) -- only that it is structurally
       closer than Desktop Chrome, and now CI-enforced on every PR rather than opt-in local-only. */
    {
      name: "webkit-390x844",
      use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 }, trace: "off" },
    },
    {
      name: "webkit-360x800",
      use: { ...devices["Desktop Safari"], viewport: { width: 360, height: 800 }, trace: "off" },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183/teto-pizza-game/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
