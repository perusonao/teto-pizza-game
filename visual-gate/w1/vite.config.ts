import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// W1 Visual Gate preview server/build (preview-only, never part of `npm run build`). Serves the
// Human Verification hub (index.html), the real game (game.html) and the QA board (board.html)
// with the 7 W1 candidate rows injected.
const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const glyphModule = `${here}W1Glyph.tsx`;

function sourceSha(): string {
  if (process.env.W1_GATE_SHA) return process.env.W1_GATE_SHA;
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();
    const dirty = execSync("git status --porcelain -- src visual-gate", { cwd: repoRoot }).toString().trim();
    return dirty ? `${sha}+dirty` : sha;
  } catch {
    return "unknown";
  }
}

/**
 * Preview-bundle-only source rewrites of production files (files on disk are never changed):
 * - every `ingredient.emoji` render site -> `<W1Glyph ingredient={...} />` (W1Glyph.tsx renders
 *   the identical emoji text for every ingredient without an active dedicated visual);
 * - persistence's production save key -> the gate's own isolated key.
 * Each rewrite must match exactly `count` times, so a production refactor that moves or renames
 * a render site fails the preview build loudly instead of silently showing the old emoji.
 */
const REWRITES: Record<string, Array<{ from: string; to: string; count: number }>> = {
  "src/components/IngredientPieceVisual.tsx": [
    { from: "{ingredient.emoji}", to: "<W1Glyph ingredient={ingredient} />", count: 1 },
  ],
  "src/components/IngredientTray.tsx": [
    { from: "{ingredient.emoji}", to: "<W1Glyph ingredient={ingredient} />", count: 1 },
    { from: "{preview.ingredient.emoji}", to: "<W1Glyph ingredient={preview.ingredient} />", count: 1 },
  ],
  "src/components/ResultPanel.tsx": [
    {
      from: "{ingredient ? `${ingredient.emoji} ${ingredient.nameJa}` : id}",
      to: '{ingredient ? <><W1Glyph ingredient={ingredient} />{" "}{ingredient.nameJa}</> : id}',
      count: 1,
    },
  ],
  "src/components/PizzaThumbnail.tsx": [
    { from: "{ingredient.emoji}", to: "<W1Glyph ingredient={ingredient} />", count: 1 },
  ],
  "src/components/InventoryOverlay.tsx": [
    { from: "{ingredient.emoji}", to: "<W1Glyph ingredient={ingredient} />", count: 1 },
  ],
  "src/components/ShopOverlay.tsx": [
    { from: "{ingredient.emoji}", to: "<W1Glyph ingredient={ingredient} />", count: 1 },
  ],
  "src/components/DexOverlay.tsx": [
    {
      from: "{ingredient?.emoji} {ingredient?.nameJa}",
      to: '{ingredient ? <W1Glyph ingredient={ingredient} /> : null} {ingredient?.nameJa}',
      count: 1,
    },
  ],
  "src/state/persistence.ts": [
    { from: '"teto-pizza-save-v1"', to: '"teto-pizza-w1-visual-gate-save-v1"', count: 1 },
    { from: '"teto-pizza-preview-save-v1"', to: '"teto-pizza-w1-visual-gate-save-v1"', count: 1 },
  ],
};

export const W1_GATE_REWRITTEN_FILES = Object.keys(REWRITES);

function w1GlyphTransform(): Plugin {
  const applied = new Set<string>();
  let isBuild = false;
  return {
    name: "w1-visual-gate-glyph-transform",
    enforce: "pre",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    transform(code, id) {
      const path = id.split("?")[0];
      if (!path.startsWith(repoRoot)) return null;
      const rel = path.slice(repoRoot.length);
      const rewrites = REWRITES[rel];
      if (!rewrites) return null;
      let out = code;
      for (const { from, to, count } of rewrites) {
        const found = out.split(from).length - 1;
        if (found !== count) {
          throw new Error(`W1 visual gate: expected ${count}x ${JSON.stringify(from)} in ${rel}, found ${found}`);
        }
        out = out.split(from).join(to);
      }
      if (rel.endsWith(".tsx")) out = `import { W1Glyph } from ${JSON.stringify(glyphModule)};\n${out}`;
      applied.add(rel);
      return { code: out, map: null };
    },
    buildEnd(error) {
      if (error || !isBuild) return;
      const missing = W1_GATE_REWRITTEN_FILES.filter((rel) => !applied.has(rel));
      if (missing.length) this.error(`W1 visual gate: rewrites never applied to ${missing.join(", ")}`);
    },
  };
}

export default defineConfig(({ command }) => ({
  root: here,
  base: process.env.W1_GATE_BASE ?? "/w1-gate/",
  publicDir: `${repoRoot}public`,
  plugins: [w1GlyphTransform(), react()],
  define: { __W1_GATE_SHA__: JSON.stringify(command === "build" ? sourceSha() : `${sourceSha()} (dev)`) },
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: process.env.W1_GATE_OUT_DIR ?? `${repoRoot}artifacts/w1-visual-gate-dist`,
    emptyOutDir: true,
    rollupOptions: {
      input: { hub: `${here}index.html`, game: `${here}game.html`, board: `${here}board.html` },
    },
  },
}));
