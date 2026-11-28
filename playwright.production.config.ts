import { defineConfig, devices } from "@playwright/test";

// Build dist with npm run build before running this production Web smoke test.
const baseURL = "http://127.0.0.1:5190/teto-pizza-game/";

export default defineConfig({
  testDir: "./e2e-production",
  use: { ...devices["Desktop Chrome"], baseURL, viewport: { width: 390, height: 844 } },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 5190 --strictPort",
    url: baseURL,
  },
});
