import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

/**
 * LC-R6-a Fresh Audit probe (manual, not CI):
 *   npx vitest run --config tools/large-catalog-ux/vitest.r6a-probe.config.ts
 *
 * Builds the app twice in memory (production: no VITE_PREVIEW_MODE; Preview: VITE_PREVIEW_MODE=1, what the
 * teto-pizza-game-preview pipeline sets) exactly like src/preview/previewIsolation.gate.test.ts, and records which
 * Large Catalog hand / pin strings each JS bundle carries today. Output:
 * docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6a_BUNDLE-PROBE.json
 */
const root = path.resolve(__dirname, "../..");

async function bundle(previewMode: boolean) {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production";
  try {
    const result = await build({ root, logLevel: "silent", mode: "production", build: { write: false, minify: true, reportCompressedSize: false } });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    const js = outputs.map((o) => (o.type === "chunk" ? o.code : "")).join("\n");
    const css = outputs.map((o) => (o.type === "asset" && o.fileName.endsWith(".css") ? String(o.source) : "")).join("\n");
    return { js, css };
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (saved === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved;
  }
}

/** Strings that exist only in the dormant R5-c / R5-d hand + pin code paths (UI copy and class names). */
const HAND_MARKERS = [
  "おまかせに戻す",
  "選択中の材料",
  "を外す",
  "ざいこなし",
  "pantry-tile__toggle",
  "pantry-sheet__pins",
  "pantry-tile__pin-badge",
];
/** Existing Preview-only strings (the H5-5 gate's list, abridged): must be absent from production. */
const PREVIEW_ONLY = ["h5-preview-helper-v1", "teto-pizza-preview-hint5-optin", "teto-pizza-preview-save-v1"];
/** Always-present production strings (sanity: the scan sees the app). */
const CONTROL = ["食材庫", "材料を検索"];

describe("LC-R6-a bundle probe", () => {
  it("records hand / pin / Preview markers in the production and Preview bundles", async () => {
    const production = await bundle(false);
    const preview = await bundle(true);
    const scan = (text: string, needles: string[]) => Object.fromEntries(needles.map((n) => [n, text.includes(n)]));
    const report = {
      generatedBy: "tools/large-catalog-ux/r6a-bundle-probe.test.ts",
      note: "In-memory vite builds (minified). production = no VITE_PREVIEW_MODE; preview = VITE_PREVIEW_MODE=1. HAND_ENFORCEMENT_ENABLED = false in source.",
      bytes: { productionJs: production.js.length, previewJs: preview.js.length, productionCss: production.css.length, previewCss: preview.css.length },
      production: { handJs: scan(production.js, HAND_MARKERS), handCss: scan(production.css, HAND_MARKERS.filter((m) => m.startsWith("pantry-"))), previewOnly: scan(production.js, PREVIEW_ONLY), control: scan(production.js, CONTROL) },
      preview: { handJs: scan(preview.js, HAND_MARKERS), previewOnly: scan(preview.js, PREVIEW_ONLY), control: scan(preview.js, CONTROL) },
    };
    fs.mkdirSync(path.join(root, "docs/reports/data"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6a_BUNDLE-PROBE.json"), JSON.stringify(report, null, 2) + "\n");
    expect(Object.values(report.production.control).every(Boolean)).toBe(true);
    expect(Object.values(report.production.previewOnly).some(Boolean)).toBe(false);
  });
});
