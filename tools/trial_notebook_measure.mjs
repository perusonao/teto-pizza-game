#!/usr/bin/env node
/**
 * Original Pizza Recovery P3-1: measurement of the Trial Notebook model's real data shape (NOT an authority:
 * the 50 / 2 000 limits are Owner decisions; this only reports what they cost). Loads the production TS modules
 * through Vite's SSR loader; changes nothing. Output: docs/reports/data/...P3-1_TRIAL-NOTEBOOK_Measurement.json
 * Usage: node tools/trial_notebook_measure.mjs [--out PATH]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath = outArg > -1 ? resolve(process.argv[outArg + 1]) : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-1_TRIAL-NOTEBOOK_Measurement.json");

const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const nb = await server.ssrLoadModule(resolve(root, "src/logic/discovery/trialNotebook.ts"));
  const fpm = await server.ssrLoadModule(resolve(root, "src/logic/discovery/attemptFingerprint.ts"));
  const { INGREDIENTS } = await server.ssrLoadModule(resolve(root, "src/data/ingredients.ts"));
  const sauces = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);
  const pieces = INGREDIENTS.filter((i) => i.category !== "sauce").map((i) => i.id);
  // deterministic combinations: one sauce (or none), 2..8 pieces, from the real catalogue
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const makeFp = () => {
    const sauce = rnd() < 0.85 ? [sauces[Math.floor(rnd() * sauces.length)]] : [];
    const n = 2 + Math.floor(rnd() * 7);
    const chosen = [...new Set(Array.from({ length: n }, () => pieces[Math.floor(rnd() * pieces.length)]))];
    return fpm.attemptFingerprintOfPizza({
      doughShape: [], sauceIds: sauce, sauceOrigin: null, sauceToken: 0, sauceDeposits: [], bakeResult: 70,
      toppings: chosen.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 0, y: 0 })),
    });
  };
  const fps = new Set();
  while (fps.size < 2500) fps.add(makeFp());
  const list = [...fps];
  const line = { kind: "ADD_ONE", textJa: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！" };

  const t0 = performance.now();
  let state = nb.createTrialNotebook();
  const sizes = {};
  for (let i = 0; i < 2100; i += 1) {
    state = nb.recordAttempt(state, { fingerprint: list[i], feedback: i % 3 === 0 ? null : line }).state;
    if ([50, 51, 500, 2000, 2001, 2100].includes(i + 1)) {
      sizes[i + 1] = { ...nb.notebookSize(state), jsonBytes: Buffer.byteLength(JSON.stringify(state)) };
    }
  }
  const ms = performance.now() - t0;
  const fpBytes = list.slice(0, 2000).map((f) => Buffer.byteLength(f));
  const out = {
    tool: "tools/trial_notebook_measure.mjs",
    note: "Measurement of the real data shape, not an authority. Limits 50 / 2000 are Owner decisions (OD-P3-12).",
    catalog: { sauces: sauces.length, pieceIngredients: pieces.length },
    fingerprintBytes: { n: fpBytes.length, mean: Math.round(fpBytes.reduce((a, b) => a + b, 0) / fpBytes.length), max: Math.max(...fpBytes) },
    serialisedStateBytesByAttemptCount: sizes,
    totalMsFor2100Records: Math.round(ms),
    msPerRecordMean: Number((ms / 2100).toFixed(3)),
  };
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out, null, 2));
} finally {
  await server.close();
}
