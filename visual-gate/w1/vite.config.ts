import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// W1 Visual Gate preview server (preview-only, never part of `npm run build`). Serves the real
// game (index.html) and the QA board (board.html) with the 7 W1 candidate rows injected.
const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: here,
  base: "/w1-gate/",
  publicDir: `${repoRoot}public`,
  plugins: [react()],
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: `${repoRoot}artifacts/w1-visual-gate-dist`,
    emptyOutDir: true,
    rollupOptions: { input: { game: `${here}index.html`, board: `${here}board.html` } },
  },
});
