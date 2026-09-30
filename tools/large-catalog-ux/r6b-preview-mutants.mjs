#!/usr/bin/env node
/**
 * Large Catalog UX LC-R6-b (measurement tooling): Preview-activation fail-closed mutation check.
 *
 * Each mutant breaks one fail-closed property of the A2 Preview activation (production reads the variant, main's
 * variant is not null, a URL reader appears, a workflow sets VITE_PREVIEW_MODE, the test transform silently stops
 * applying, ...). The R6-b gates must KILL every one (a SURVIVED line is a gate gap). Sources are restored after each
 * run. The Vitest gates are the runner (the bundle gate does real vite builds); e2e/lc-hand-preview-activation.spec.ts
 * is the browser-level counterpart and is run by hand for the mutants marked `e2e`.
 *
 *   node tools/large-catalog-ux/r6b-preview-mutants.mjs [V1 V2 ...]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POLICY = "src/logic/catalog/handPolicy.ts";
const VARIANT = "src/preview/lcHandPreview.ts";
const GUARD = "= import.meta.env.VITE_PREVIEW_MODE\n  ? isHandCapacityCandidate(LC_HAND_PREVIEW_CAPACITY)";
const ENABLED = "HAND_ENFORCEMENT_PRODUCTION || previewVariant !== null;";

const MUTANTS = [
  { id: "V1", what: "production reads the variant (VITE_PREVIEW_MODE guard removed)", file: POLICY, edits: [[GUARD, "= true\n  ? isHandCapacityCandidate(LC_HAND_PREVIEW_CAPACITY)"]] },
  { id: "V2", what: "main commits a non-null variant (12)", file: VARIANT, edits: [["LcHandPreviewCapacity = null;", "LcHandPreviewCapacity = 12;"]] },
  { id: "V3", what: "a URL query reader (?lcHand) turns the hand on", file: POLICY, edits: [[ENABLED, `HAND_ENFORCEMENT_PRODUCTION || previewVariant !== null || new URLSearchParams(location.search).has("lcHand");`]] },
  { id: "V3b", what: "a localStorage reader turns the hand on", file: POLICY, edits: [[ENABLED, `HAND_ENFORCEMENT_PRODUCTION || previewVariant !== null || localStorage.getItem("lcHand") !== null;`]] },
  { id: "V4", what: "the production deploy workflow sets VITE_PREVIEW_MODE", file: ".github/workflows/deploy.yml", edits: [["      - run: npm run build\n        env:\n", '      - run: npm run build\n        env:\n          VITE_PREVIEW_MODE: "1"\n']] },
  { id: "V5", what: "the hand-on transform's target line is refactored away (must fail closed, not silently run OFF)", file: POLICY, edits: [["export const HAND_ENFORCEMENT_PRODUCTION = false;", "export const HAND_ENFORCEMENT_PRODUCTION: boolean = false;"]] },
  { id: "V6", what: "an invalid variant (10) is accepted (candidate guard removed)", file: POLICY, edits: [["? isHandCapacityCandidate(LC_HAND_PREVIEW_CAPACITY)\n    ? LC_HAND_PREVIEW_CAPACITY\n    : null", "? (LC_HAND_PREVIEW_CAPACITY as HandCapacityCandidate | null)"]] },
  { id: "V7", what: "a Preview variant does not enable the hand", file: POLICY, edits: [[ENABLED, "HAND_ENFORCEMENT_PRODUCTION;"]] },
  { id: "V8", what: "a Preview variant does not set the capacity (production value used)", file: POLICY, edits: [["previewVariant ?? DEFAULT_HAND_CAPACITY_PRODUCTION", "DEFAULT_HAND_CAPACITY_PRODUCTION"]] },
  { id: "V9", what: "the variant module is read outside the guard (enable flag reads the raw constant)", file: POLICY, edits: [[ENABLED, "HAND_ENFORCEMENT_PRODUCTION || LC_HAND_PREVIEW_CAPACITY !== null;"]] },
  { id: "V10", what: "the badge always says HAND 12", file: VARIANT, edits: [["`HAND ${capacity}`", '"HAND 12"']] },
  { id: "V11", what: "the badge renders in production (guard removed)", file: "src/components/PreviewBadge.tsx", edits: [["if (!import.meta.env.VITE_PREVIEW_MODE) return null;", "void 0;"]] },
  { id: "V12", what: "the variant module gains an import.meta.env reader of its own", file: VARIANT, edits: [["export const LC_HAND_PREVIEW_MARK", "export const LC_HAND_ENV = import.meta.env.VITE_LC_HAND;\nexport const LC_HAND_PREVIEW_MARK"]] },
  { id: "V13", what: "production activation switch flipped (HAND_ENFORCEMENT_PRODUCTION = true)", file: POLICY, edits: [["export const HAND_ENFORCEMENT_PRODUCTION = false;", "export const HAND_ENFORCEMENT_PRODUCTION = true;"]] },
];

const SUITE = ["src/preview/lcHandPreview", "src/logic/catalog/handPolicy", "src/logic/catalog/handTray.off", "src/components/PreviewBadge", "src/logic/catalog/catalogBoundary"];

function runSuite() {
  const r = spawnSync("npx", ["vitest", "run", ...SUITE, "--reporter=dot"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0;
}

const only = new Set(process.argv.slice(2));
const selected = MUTANTS.filter((m) => only.size === 0 || only.has(m.id));
if (!runSuite()) {
  console.error("baseline suite is not green; refusing to mutate");
  process.exit(1);
}
const results = [];
for (const m of selected) {
  const path = join(ROOT, m.file);
  const original = readFileSync(path, "utf8");
  let mutated = original;
  let applicable = true;
  for (const [from, to] of m.edits) {
    if (!mutated.includes(from)) applicable = false;
    mutated = mutated.replace(from, to);
  }
  if (!applicable) {
    results.push({ id: m.id, status: "NOT_APPLICABLE", what: m.what });
    continue;
  }
  try {
    writeFileSync(path, mutated);
    results.push({ id: m.id, status: runSuite() ? "SURVIVED" : "KILLED", what: m.what });
  } finally {
    writeFileSync(path, original);
  }
}
for (const r of results) console.log(`${r.status.padEnd(15)} ${r.id.padEnd(4)} ${r.what}`);
const killed = results.filter((r) => r.status === "KILLED").length;
console.log(`\n${killed}/${results.length} killed`);
process.exit(killed === results.length ? 0 : 1);
