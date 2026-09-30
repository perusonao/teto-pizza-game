#!/usr/bin/env node
/**
 * Original Pizza Recovery P3-3a: hand-rolled mutation test for the Trial Notebook DATA WIRING
 * (src/state/trialRecord.ts + the reducer / carry / save seams). No Stryker in this repo, so each mutant is one
 * targeted textual change (one or more [from, to] pairs in one file). For every mutant the wiring tests run;
 * KILLED = they fail, SURVIVED = they pass. Every touched file is restored afterwards (also on error / Ctrl-C).
 *
 * Usage: node tools/trial_notebook_wiring_mutation.mjs [--out PATH]      Exit code 1 when any mutant survives.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath =
  outArg > -1
    ? resolve(process.argv[outArg + 1])
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-3a_TRIAL-NOTEBOOK-WIRING_Mutation.json");

const ADAPTER = "src/state/trialRecord.ts";
const REDUCER = "src/state/gameReducer.ts";
const APP = "src/App.tsx";
const PANEL = "src/components/ResultPanel.tsx";
const SCREEN = "src/screens/GameScreen.tsx";
const PERSIST = "src/state/persistence.ts";
const FILES = [ADAPTER, REDUCER, APP, PANEL, SCREEN, PERSIST];
const originals = new Map(FILES.map((f) => [f, readFileSync(resolve(root, f), "utf8")]));

const COMMIT = "const trial = recordTrialAttempt(state, resolution.outcome);";
const CARRY = "    trialNotebook: state.trialNotebook,\n  };\n}\n\n/**\n * DM-3R-2";

/** [id, description, file, [[from, to], ...], equivalentReason?] -- every `from` must occur exactly once. */
const MUTANTS = [
  ["W01", "record call deleted (no attempt is ever recorded)", REDUCER, [[COMMIT, "const trial = { trialNotebook: state.trialNotebook, lastTrialAttempt: null };"]]],
  ["W02", "attempt recorded twice per commit (retryCount +2 / NEW becomes DUPLICATE)", REDUCER, [[COMMIT, "const first = recordTrialAttempt(state, resolution.outcome);\n        const trial = recordTrialAttempt({ ...state, trialNotebook: first.trialNotebook }, resolution.outcome);"]]],
  ["W03", "REGISTER_TO_DEX RESULT phase guard removed (repeated dispatch re-records)", REDUCER, [['if (state.phase !== "RESULT") {\n        return state;\n      }\n      // Dinner Mission DM-2 (OD-DM-11)', "// Dinner Mission DM-2 (OD-DM-11)"]]],
  ["W04", "the notebook is not carried (carryOf hands a fresh one)", REDUCER, [[CARRY, "    trialNotebook: createTrialNotebook(),\n  };\n}\n\n/**\n * DM-3R-2"]]],
  ["W05", "the record result is not reset by a fresh round", REDUCER, [["    lastDiscovery: null,\n    lastTrialAttempt: null,\n", "    lastDiscovery: null,\n"]]],
  ["W06", "START_FREE_COOK keeps a stale record result", REDUCER, [['case "START_FREE_COOK":\n      return startFreeCook(\n        carryOf(state),\n        action.now,\n      );', 'case "START_FREE_COOK":\n      return { ...startFreeCook(carryOf(state), action.now), lastTrialAttempt: state.lastTrialAttempt };']]],
  ["W07", "initial notebook has the wrong limits (display 1)", REDUCER, [["trialNotebook: createTrialNotebook(),\n    },\n    { preferFirst: true },", "trialNotebook: createTrialNotebook({ display: 1, identity: 1 }),\n    },\n    { preferFirst: true },"]]],
  ["W08", "Lunch Rush records an attempt at MISSION_NEXT_ORDER", REDUCER, [["const registered: GameState = {\n        ...state,\n        dex,\n", 'const registered: GameState = {\n        ...state,\n        trialNotebook: recordTrialAttempt(state, { kind: "ORIGINAL", blockedTargetIds: [] }).trialNotebook,\n        dex,\n']]],
  ["W09", "Dinner guards removed (both the per-case and the outer blocklist)", REDUCER, [["if (isDinnerRound(state)) return state;\n      // Progression 2.0 Phase 3-2", "// Progression 2.0 Phase 3-2"], ['  "MISSION_RESET_ORDER",\n  "MISSION_SKIP_ORDER",\n  "REGISTER_TO_DEX",', '  "MISSION_RESET_ORDER",\n  "MISSION_SKIP_ORDER",']], "A Dinner round always has freeCook = false, so REGISTER_TO_DEX never reaches the free-cook ORIGINAL branch that records (it falls to `if (!state.score) return state`). Both Dinner guards are defense in depth for other effects (Dex / Pitz), not for the notebook; no observable notebook behaviour changes."],
  ["W10", "the commit records before the ORIGINAL guard (a MATCHED pizza would be recorded)", REDUCER, [['if (resolution.kind !== "ORIGINAL") return state;', 'if (resolution.kind !== "ORIGINAL") return { ...state, trialNotebook: recordTrialAttempt(state, { kind: "ORIGINAL", blockedTargetIds: [] }).trialNotebook };']]],
  ["W11", "the save writer persists the notebook", APP, [["      discoveredTechniqueIds: state.discoveredTechniqueIds,\n      // DM-4-3: a Dinner CLEAR", "      discoveredTechniqueIds: state.discoveredTechniqueIds,\n      trialNotebook: state.trialNotebook,\n      // DM-4-3: a Dinner CLEAR"]]],
  ["W12", "persistence.ts learns about the notebook", PERSIST, [["export function persistProgress(", "// trialNotebook\nexport function persistProgress("]]],
  ["W13", "a render path reads the notebook / records (ResultPanel)", PANEL, [['import type { ScoreBreakdown } from "../logic/scoring";', '// trialNotebook\nimport type { ScoreBreakdown } from "../logic/scoring";']]],
  ["W14", "a render path reads the record result (GameScreen)", SCREEN, [["nearMiss={resultNearMiss(state)}", "nearMiss={resultNearMiss(state)} data-trial={String(state.lastTrialAttempt)}"]]],
  ["A01", "adapter: INCOMPLETE_MATCH becomes eligible", ADAPTER, [['return outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS";', 'return outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS" || outcome.kind === "INCOMPLETE_MATCH";']]],
  ["A02", "adapter: AMBIGUOUS no longer eligible", ADAPTER, [['return outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS";', 'return outcome.kind === "ORIGINAL";']]],
  ["A03", "adapter: NEW_DISCOVERY becomes eligible", ADAPTER, [['return outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS";', 'return outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS" || outcome.kind === "NEW_DISCOVERY";']]],
  ["A04", "adapter: eligibility guard removed", ADAPTER, [["  if (!isTrialRecordEligible(outcome)) return { trialNotebook: input.trialNotebook, lastTrialAttempt: null };\n", ""]]],
  ["A05", "adapter: a DUPLICATE is reported as NEW", ADAPTER, [['lastTrialAttempt: { kind: "DUPLICATE", number: result.outcome.number } };', 'lastTrialAttempt: { kind: "NEW", number: result.outcome.number } };']]],
  ["A06", "adapter: the reported #n is off by one", ADAPTER, [['lastTrialAttempt: { kind: "NEW", number: result.outcome.number } };', 'lastTrialAttempt: { kind: "NEW", number: result.outcome.number + 1 } };']]],
  ["A07", "adapter: the internal near-miss distance is stored with the feedback", ADAPTER, [["return line ? { kind: line.kind, textJa: line.textJa } : null;", "return line ? ({ kind: line.kind, textJa: line.textJa, distance: 1 } as ShownFeedback) : null;"]]],
  ["A08", "adapter: the feedback is never stored", ADAPTER, [["return line ? { kind: line.kind, textJa: line.textJa } : null;", "return null;"]]],
  ["A09", "adapter: the stored feedback text differs from the shown text", ADAPTER, [["{ kind: line.kind, textJa: line.textJa } : null;", "{ kind: line.kind, textJa: line.textJa + \"。\" } : null;"]]],
  ["A10", "adapter: every pizza gets the same identity", ADAPTER, [["fingerprint: attemptFingerprintOfPizza(input.pizza),", 'fingerprint: attemptFingerprintOfPizza({ ...input.pizza, sauceIds: [], toppings: [] } as typeof input.pizza),']]],
  ["A11", "adapter: a rejected input still reports a record result", ADAPTER, [["    case \"REJECTED\":\n      // Fail closed: a rejected input stores nothing (the model returns the same state) and says nothing.\n      return { trialNotebook: input.trialNotebook, lastTrialAttempt: null };", "    case \"REJECTED\":\n      return { trialNotebook: input.trialNotebook, lastTrialAttempt: { kind: \"NEW\", number: 0 } };"]]],
  ["A12", "adapter: a rejected input replaces the notebook with a fresh one", ADAPTER, [["    case \"REJECTED\":\n      // Fail closed: a rejected input stores nothing (the model returns the same state) and says nothing.\n      return { trialNotebook: input.trialNotebook, lastTrialAttempt: null };", "    case \"REJECTED\":\n      return { trialNotebook: createTrialNotebook(), lastTrialAttempt: null };"]]],
  ["A13", "adapter: the retry count leaks into the record result", ADAPTER, [['lastTrialAttempt: { kind: "DUPLICATE", number: result.outcome.number } };', 'lastTrialAttempt: { kind: "DUPLICATE", number: result.outcome.number, retryCount: result.outcome.retryCount } as never };']]],
  ["A14", "adapter: P3-2 dependency appears", ADAPTER, [["export type LastTrialAttempt", "const discoveryMemo = 1;\nexport type LastTrialAttempt"]]],
  ["A15", "adapter: a clock / randomness enters the record", ADAPTER, [["fingerprint: attemptFingerprintOfPizza(input.pizza),", "fingerprint: attemptFingerprintOfPizza(input.pizza) + (Math.random() > 2 ? 'x' : ''),"]]],
  ["A16", "adapter: the P2 line is computed from a FAILED / non-free state (the feedback is not the shown line)", ADAPTER, [["resultNearMiss({ ...input, lastDiscovery: outcome })", "resultNearMiss({ ...input, freeCook: false, lastDiscovery: outcome })"]]],
];

// `import { createTrialNotebook }` is needed by A12 only; make the mutant self-contained.
const PATCH_IMPORT = new Map([["A12", ['import { recordAttempt, type ShownFeedback, type TrialNotebook } from "../logic/discovery/trialNotebook";', 'import { createTrialNotebook, recordAttempt, type ShownFeedback, type TrialNotebook } from "../logic/discovery/trialNotebook";']]]);
for (const id of ["A07"]) PATCH_IMPORT.set(id, null);

const TESTS = [
  "src/state/gameReducer.trialNotebook",
  "src/state/trialRecord",
  "src/state/resultFeedback.gate",
  "src/logic/discovery/trialNotebook",
  "src/logic/discovery/attemptFingerprint",
];

function runTests() {
  const r = spawnSync("npx", ["vitest", "run", ...TESTS], { cwd: root, encoding: "utf8", env: { ...process.env, CI: "1" } });
  return r.status === 0;
}

const restore = () => {
  for (const [f, text] of originals) writeFileSync(resolve(root, f), text);
};
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

const results = [];
try {
  if (!runTests()) throw new Error("baseline tests must pass before mutating");
  for (const [id, description, file, pairs, equivalentReason] of MUTANTS) {
    let text = originals.get(file);
    const extra = PATCH_IMPORT.get(id);
    const all = extra ? [extra, ...pairs] : pairs;
    let invalid = null;
    for (const [from, to] of all) {
      const count = text.split(from).length - 1;
      if (count !== 1) {
        invalid = `pattern occurs ${count} times: ${from.slice(0, 60)}`;
        break;
      }
      text = text.replace(from, () => to);
    }
    if (invalid) {
      results.push({ id, description, status: "INVALID", detail: invalid });
      console.log(`${id} INVALID    ${invalid}`);
      continue;
    }
    writeFileSync(resolve(root, file), text);
    const passed = runTests();
    restore();
    const status = !passed ? "KILLED" : equivalentReason ? "EQUIVALENT" : "SURVIVED";
    results.push({ id, description, file, status, ...(equivalentReason && passed ? { equivalentReason } : {}) });
    console.log(`${id} ${status.padEnd(10)} ${description}`);
  }
} finally {
  restore();
}

const killed = results.filter((r) => r.status === "KILLED").length;
const survived = results.filter((r) => r.status === "SURVIVED");
const equivalent = results.filter((r) => r.status === "EQUIVALENT").length;
const invalid = results.filter((r) => r.status === "INVALID");
const summary = {
  target: [ADAPTER, REDUCER, "App.tsx / persistence.ts / ResultPanel.tsx / GameScreen.tsx (boundary)"],
  tests: TESTS,
  mutants: results.length,
  killed,
  equivalent,
  survived: survived.length,
  invalid: invalid.length,
  mutationScore: results.length - equivalent ? Number((killed / (results.length - equivalent)).toFixed(3)) : 0,
  results,
};
writeFileSync(outPath, JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ ...summary, results: undefined }));
process.exit(survived.length || invalid.length ? 1 : 0);
