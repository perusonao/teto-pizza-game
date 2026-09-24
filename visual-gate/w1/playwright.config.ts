import { defineConfig, devices } from "@playwright/test";

/**
 * W1 Ingredient Visual Preview Gate -- preview-only Playwright suite. Separate from the root
 * `playwright.config.ts` (testDir ./e2e) so neither the local e2e suite nor the WebKit CI job
 * picks it up. Run: `npx playwright test -c visual-gate/w1/playwright.config.ts`.
 * `W1_GATE_SCREENSHOTS=1` also writes the evidence PNGs under
 * docs/reports/screenshots/w1-ingredient-visual-gate-2/<viewport>/.
 * `W1_GATE_BASE_URL=<url>` runs the same suite against an already-built/served Preview bundle
 * (e.g. the exact bytes being deployed) instead of the dev server.
 */
const externalBaseURL = process.env.W1_GATE_BASE_URL;
const video =
  process.env.W1_GATE_VIDEO === "1"
    ? { mode: "on" as const, size: { width: 390, height: 844 } }
    : ("off" as const);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../test-results/w1-visual-gate",
  use: { baseURL: externalBaseURL ?? "http://localhost:5184/w1-gate/", video },
  projects: [
    { name: "chromium-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "chromium-360x800", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
    { name: "webkit-390x844", use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } } },
    { name: "webkit-360x800", use: { ...devices["Desktop Safari"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: externalBaseURL ? undefined : {
    command: "npx vite --config visual-gate/w1/vite.config.ts --port 5184 --strictPort",
    cwd: "../..",
    url: "http://localhost:5184/w1-gate/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
