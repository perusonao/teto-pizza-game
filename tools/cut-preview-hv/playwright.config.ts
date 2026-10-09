import { defineConfig, devices } from "@playwright/test";

/**
 * #427 / #426 Human Verification, stage 1 (automatic, coordinate-injected): the REAL Preview build -- the exact build the
 * Preview pipeline makes (`VITE_PREVIEW_MODE=1`, `--base=/teto-pizza-game-preview/`) -- served locally, driven at 390x844 and
 * 360x800 with the `?cutAreaPct=&cutMinWidth=` URL query. Not part of `npm run test:e2e` / CI (its own config, its own build).
 *
 *   npx playwright test -c tools/cut-preview-hv/playwright.config.ts
 */
const PORT = 5191;
const OUT = "/tmp/cut-preview-hv-dist";

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/teto-pizza-game-preview/`,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    { name: "preview-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "preview-360x800", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    cwd: "../..", // the repo root (relative to this file)
    command: `npx vite build --base=/teto-pizza-game-preview/ --outDir ${OUT} --emptyOutDir && npx vite preview --base=/teto-pizza-game-preview/ --outDir ${OUT} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/teto-pizza-game-preview/`,
    env: { VITE_PREVIEW_MODE: "1", VITE_PREVIEW_PR: "427", VITE_PREVIEW_SHA: process.env.VITE_PREVIEW_SHA ?? "local" },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
