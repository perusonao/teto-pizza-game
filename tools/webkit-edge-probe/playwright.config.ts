import { defineConfig, devices } from "@playwright/test";

/**
 * #427/#426 investigation (NOT product code, never merged): reproduce the right-edge clipping the Owner saw on
 * iPhone RESULT after "two close cuts + one crossing cut". Runs the same probe on WebKit (the iPhone engine) and
 * Chromium (control) at 390x844 and 360x800, and writes screenshots + layer experiments under PROBE_OUT.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /(probe|search)\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5190/teto-pizza-game/", trace: "off", video: "off", screenshot: "off" },
  projects: [
    { name: "webkit-390x844", use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } } },
    // The iPhone's real pixel density (the CI default above is DPR 2); the SVG filter / clip-path raster may differ.
    { name: "webkit-390x844-dpr3", use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 } },
    { name: "webkit-360x800", use: { ...devices["Desktop Safari"], viewport: { width: 360, height: 800 } } },
    { name: "chromium-390x844", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "chromium-360x800", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev -- --port 5190 --strictPort",
    url: "http://localhost:5190/teto-pizza-game/",
    env: { TETO_TEST_HOOKS: "1" },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
