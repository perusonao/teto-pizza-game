#!/usr/bin/env node
/**
 * Large Catalog UX LC-R6-c (measurement tooling only): mutation probe for the pantry pin UI (OD-R5e-1 / OD-R5e-3 /
 * OD-R6a-4 / OD-R5c-5 / OD-R6a-5). Each mutant must be KILLED by the R6-c suite below; a SURVIVED line is a test gap.
 * Sources are restored after each run. Exit code 1 if any applicable mutant survives.
 *
 *   node tools/large-catalog-ux/r6c-pin-ui-mutants.mjs [X1 X2 ...]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PANTRY = "src/components/IngredientPantry.tsx";

const MUTANTS = [
  { id: "X1", what: "pin UI for an INACTIVE hand (the pre-R6-c rule)", file: "src/screens/GameScreen.tsx",
    edits: [["handEditing={HAND_ENFORCEMENT_ENABLED && trayHand?.ids != null}", "handEditing={HAND_ENFORCEMENT_ENABLED}"]] },
  { id: "X2", what: "notice lasts 30 s instead of 3 s", file: PANTRY, edits: [["const PIN_NOTICE_MS = 3000;", "const PIN_NOTICE_MS = 30000;"]] },
  { id: "X3", what: "notice never expires by timer", file: PANTRY, edits: [["const timer = window.setTimeout(() => setCapacityNotice(null), PIN_NOTICE_MS);", "const timer = window.setTimeout(() => {}, PIN_NOTICE_MS);"]] },
  { id: "X4", what: "a successful tap does not clear a showing notice", file: PANTRY,
    edits: [["    setCapacityNotice(null);\n    editPins((previous) => togglePin(previous, id, pinContext, pinFits).session);", "    editPins((previous) => togglePin(previous, id, pinContext, pinFits).session);"]] },
  { id: "X5", what: "a refused pin is written anyway (capacity rule ignored by the tile)", file: PANTRY,
    edits: [['    if (result.outcome === "rejected-capacity") {\n      setCapacityNotice({});\n      return;\n    }', '    if (result.outcome === "rejected-capacity") {\n      setCapacityNotice({});\n    }']] },
  { id: "X6", what: "the status region is mounted without pin editing (production / inactive DOM changes)", file: PANTRY, edits: [["        {handEditing && (\n          <p\n            className={`pantry-sheet__notice", "        {(\n          <p\n            className={`pantry-sheet__notice"]] },
  { id: "X7", what: "the notice names a number", file: PANTRY, edits: [['export const PIN_CAPACITY_NOTICE = "手元がいっぱいです。使わない食材のピンを外してね";', 'export const PIN_CAPACITY_NOTICE = "手元がいっぱいです(12)。使わない食材のピンを外してね";']] },
  { id: "X8", what: "a tile press always takes the focus away from the search field (no keyboard rule)", file: PANTRY, edits: [["if (fieldFocused) event.preventDefault();", "void fieldFocused;"]] },
  { id: "X9", what: "a tile press always prevents default (also without a focused field)", file: PANTRY, edits: [["if (fieldFocused) event.preventDefault();", "event.preventDefault();"]] },
  { id: "X10", what: "the notice region is not polite / not role=status", file: PANTRY, edits: [['            role="status"\n            aria-live="polite"', '            role="note"']] },
  { id: "X11", what: "a repeated refusal does not restart the timer (same state object)", file: PANTRY, edits: [["      setCapacityNotice({});\n      return;", "      setCapacityNotice((previous) => previous ?? {});\n      return;"]] },
];

const SUITE = [
  "src/components/IngredientPantry.pinNotice.test.tsx",
  "src/components/IngredientPantry.pins.test.tsx",
  "src/App.handPinUi.handOn.test.tsx",
  "src/App.handPins.handOn.test.tsx",
  "src/logic/catalog/catalogBoundary.test.ts",
];

function runSuite() {
  return spawnSync("npx", ["vitest", "run", ...SUITE, "--reporter=dot"], { cwd: ROOT, encoding: "utf8" }).status === 0;
}

const only = new Set(process.argv.slice(2));
const selected = MUTANTS.filter((m) => only.size === 0 || only.has(m.id));
if (!runSuite()) {
  console.error("baseline suite fails -- fix it before running mutants");
  process.exit(2);
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
process.exit(results.some((r) => r.status !== "KILLED") ? 1 : 0);
