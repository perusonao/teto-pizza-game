import { describe, expect, it } from "vitest";

/**
 * Research 2.0 Phase 2: import-boundary gates for the Research Board read model and the negative ledger. They scan the
 * real source tree, so wiring either one into a Hint / Technique / Notebook layer (INV-B4 / B5 / B8) or letting an
 * unreviewed module touch the ledger fails here and must be a deliberate, reviewed change.
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path) || path.includes("/testSupport/");
const production = Object.entries(sources).filter(([path]) => !isTest(path));
const BOARD = "/src/logic/discovery/researchBoard.ts";
const LEDGER = "/src/state/researchExclusions.ts";
const importsOf = (source: string) =>
  [...source.matchAll(/(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]);
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Research Board read model: disclosed information only", () => {
  it("exists, and imports only the catalog / display data and the Research Entry domain", () => {
    expect(Object.keys(sources)).toContain(BOARD);
    expect(importsOf(sources[BOARD]).sort()).toEqual([
      "../../data/familyDisplay",
      "../../data/ingredients",
      "../../data/recipes",
      "./researchEntry",
    ]);
  });
  it("imports no Hint layer, Technique, Trial Notebook, reducer, persistence or ledger module", () => {
    const code = stripComments(sources[BOARD]);
    for (const forbidden of [/selectableHint/, /hint5/i, /deductionHint/, /deductionGuard/, /discoveryHint/, /hintPurchase/, /techniques?\//, /data\/techniques/, /trialNotebook/i, /trialRecord/, /gameReducer/, /persistence/, /researchExclusions/, /researchResultRows/]) {
      expect(code, String(forbidden)).not.toMatch(new RegExp(`from\\s+["'][^"']*${forbidden.source}`, forbidden.flags));
    }
  });
  it("is UNWIRED: no production module imports it yet (the Notebook UI is Phase 3 / S4)", () => {
    const users = production.filter(([path, src]) => path !== BOARD && importsOf(src).some((i) => /researchBoard$/.test(i))).map(([p]) => p);
    expect(users).toEqual([]);
  });
});

describe("negative ledger: who may mention it", () => {
  it("the ledger helper reads nothing but the save id grammar", () => {
    expect(importsOf(sources[LEDGER])).toEqual(["./saveIdGrammar"]);
  });
  it("only persistence and the reducer import the ledger helpers", () => {
    const users = production.filter(([path, src]) => path !== LEDGER && importsOf(src).some((i) => /researchExclusions$/.test(i))).map(([p]) => p).sort();
    expect(users).toEqual(["/src/state/gameReducer.ts", "/src/state/persistence.ts"]);
  });
  it("exactly the writer, persistence, state, App, devtools merge and the Board input mention `researchExclusions` in production", () => {
    const users = production.filter(([, src]) => /researchExclusions/.test(stripComments(src))).map(([p]) => p).sort();
    expect(users).toEqual(
      [
        "/src/App.tsx",
        "/src/devtools/saveMerge.ts",
        "/src/logic/discovery/researchBoard.ts",
        "/src/state/gameReducer.ts",
        "/src/state/persistence.ts",
      ].sort(),
    );
  });
  it("no Hint / Technique / Notebook / Cohort module mentions or imports the ledger (INV-B4 / B5 / B8)", () => {
    const protectedPrefixes = [
      "/src/state/discoveryHint.ts",
      "/src/logic/discovery/hint5Ladder.ts",
      "/src/logic/discovery/selectableHint.ts",
      "/src/logic/discovery/deductionHint.ts",
      "/src/logic/discovery/deductionGuard.ts",
      "/src/logic/discovery/hintPurchase.ts",
      "/src/logic/discovery/hintSteps.ts",
      "/src/logic/discovery/trialNotebook.ts",
      "/src/state/trialRecord.ts",
      "/src/logic/discovery/researchEntry.ts",
      "/src/logic/discovery/researchResultFeedback.ts",
      "/src/components/HintSheet.tsx",
      "/src/components/TrialNotebookSheet.tsx",
      "/src/screens/GameScreen.tsx",
    ];
    for (const path of production) {
      if (!protectedPrefixes.includes(path[0]) && !path[0].startsWith("/src/logic/techniques/")) continue;
      expect(/researchExclusions|researchBoard/.test(stripComments(path[1])), path[0]).toBe(false);
    }
  });
  it("the Hint ledger (`discoveryHintFacts`) is never fed by the exclusion path", () => {
    const rows = stripComments(sources["/src/logic/discovery/researchResultRows.ts"]);
    expect(rows).toMatch(/persistFactIds: rows\.filter\(\(r\) => r\.verdict === "POSITIVE"\)/);
    expect(rows).toMatch(/persistExclusionIds: rows\.filter\(\(r\) => r\.verdict === "NEGATIVE"\)/);
    const reducer = stripComments(sources["/src/state/gameReducer.ts"]);
    expect(reducer).not.toMatch(/discoveryHintFacts[^;\n]*persistExclusionIds/);
    expect(reducer).not.toMatch(/ledger\[targetId\] = [^;]*Exclusion/);
  });
});
