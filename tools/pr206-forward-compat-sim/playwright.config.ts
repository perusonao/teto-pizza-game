import { defineConfig, devices } from "@playwright/test";

// Standalone config for the PR #206 forward-compat real-browser session (not part of the repo's
// e2e suite). SIM_TREE = source tree to serve (A = main, B = main + #206). See ./run-e2e.sh.
const tree = process.env.SIM_TREE ?? ".";
const port = Number(process.env.SIM_PORT ?? 5190);

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}/teto-pizza-game/` },
  projects: [
    {
      name: "chromium-390x844",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    cwd: tree,
    url: `http://localhost:${port}/teto-pizza-game/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
