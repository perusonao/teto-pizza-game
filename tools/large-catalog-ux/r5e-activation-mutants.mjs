#!/usr/bin/env node
/**
 * Large Catalog UX LC-R5-e Fresh Audit (measurement tooling only): activation-boundary mutation probe.
 *
 * The M1〜M114 set in `mutation-check.mjs` stays the authority. This probe adds CANDIDATE mutants that target what
 * changes when R6 flips `HAND_ENFORCEMENT_ENABLED`, and reports which ones the current suite does NOT kill. A
 * SURVIVED line here is audit evidence (a test gap, or an equivalent mutant explained in the Fresh Audit report
 * §12), not a failing gate: the script always exits 0 once the baseline passes. Sources are restored after each run.
 *
 *   node tools/large-catalog-ux/r5e-activation-mutants.mjs [E1 E2 ...]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const C = "src/logic/catalog";

const MUTANTS = [
  {
    id: "E1",
    what: "flag inversion inside the capacity policy (handCapacityFor enforces while the flag is false)",
    file: `${C}/handPolicy.ts`,
    edits: [["if (HAND_ENFORCEMENT_ENABLED) return candidate;", "if (!HAND_ENFORCEMENT_ENABLED) return candidate;"]],
  },
  {
    id: "E2",
    what: "category isolation: a round / step key change is evaluated as a hand change (#197 on step change)",
    file: "src/App.tsx",
    edits: [["if (trayHandTrack !== null && trayHandTrack.key === trayHandKey) {", "if (trayHandTrack !== null) {"]],
  },
  {
    id: "E3",
    what: "an INACTIVE hand (owned <= capacity) still drives the tray (hand mode for small catalogs)",
    file: `${C}/handTray.ts`,
    edits: [["if (hand === null || !hand.active) return null;", "if (hand === null) return null;"]],
  },
  {
    id: "E4",
    what: "the tray hand is computed outside PREPARE (phase guard dropped)",
    file: "src/App.tsx",
    edits: [['state.phase === "PREPARE" && (state.makingStep === "SAUCE"', 'true && (state.makingStep === "SAUCE"']],
  },
  {
    id: "E5",
    what: "capacity candidate 12 -> 9 (do the App-level tests pin the design candidate?)",
    file: `${C}/handPolicy.ts`,
    edits: [["DEFAULT_HAND_CAPACITY_CANDIDATE: HandCapacityCandidate = 12;", "DEFAULT_HAND_CAPACITY_CANDIDATE: HandCapacityCandidate = 9;"]],
  },
  {
    id: "E6",
    what: "#197 never clears on a hand change (App ignores the transition's selection)",
    file: "src/App.tsx",
    edits: [["if (next.selectedIngredientId !== selectedIngredientId) setSelectedIngredientId(next.selectedIngredientId);", "void next;"]],
  },
  {
    id: "E7",
    what: "inventory 0: an existing zero-stock pin is dropped from the hand",
    file: `${C}/workingSet.ts`,
    edits: [["pinned: cleanIds(pinnedIds).filter(inCategory),", "pinned: cleanIds(pinnedIds).filter(inCategory).filter((id) => hasStock(ownership.stock(id))),"]],
  },
  {
    id: "E8",
    what: "'new' tier uses the OLDEST acquisitions instead of the newest",
    file: `${C}/handSession.ts`,
    edits: [["cleanIds([...ownedIdsInAcquisitionOrder].reverse())", "cleanIds([...ownedIdsInAcquisitionOrder])"]],
  },
  {
    id: "E9",
    what: "#197 retain judged on the whole new hand (not the new page 0) inside handTrayTransition's return",
    file: `${C}/handTray.ts`,
    edits: [["selectedIngredientId: keep ? selectedIngredientId : null };", "selectedIngredientId: keep || after.includes(selectedIngredientId ?? \"\") ? selectedIngredientId : null };"]],
  },
  {
    id: "E10",
    what: "Model C fail-open: pinFitsHand accepts a pin that is not on the visible hand",
    file: `${C}/handTray.ts`,
    edits: [["return ids === null || ids.includes(id);", "return ids === null || ids.length > 0;"]],
  },
  {
    id: "E11",
    what: "pin editing exposed only when the tray hand is active (design alternative, not current spec)",
    file: "src/screens/GameScreen.tsx",
    edits: [["handEditing={HAND_ENFORCEMENT_ENABLED}", "handEditing={HAND_ENFORCEMENT_ENABLED && (trayHand?.ids ?? null) !== null}"]],
  },
];

const SUITE = [
  C,
  "src/components/IngredientPantry.pins.test.tsx",
  "src/components/IngredientTray.pantryEntryRow.test.tsx",
  "src/logic/prepareDock.test.ts",
  "src/App.handPins.test.tsx",
  "src/App.handTray.test.tsx",
  "src/App.handTray.off.test.tsx",
  "src/App.freeCookTrayPaging.test.tsx",
  "src/screens/GameScreen.pantryShell.test.tsx",
];

function runSuite() {
  const r = spawnSync("npx", ["vitest", "run", ...SUITE, "--reporter=dot"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0;
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
console.log(`\n${results.filter((r) => r.status === "KILLED").length}/${results.length} killed (survivors = audit evidence, see the R5-e report)`);
