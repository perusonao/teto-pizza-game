import { describe, expect, it } from "vitest";

/**
 * Original Pizza Recovery P2: wiring, isolation and economy gates over the real source tree.
 * They pin that the RESULT feedback stays Free-Cooking-only, reads nothing from the hint economy,
 * and that the Owner-pending pieces (AMBIGUOUS copy candidates, generic FAR line) stay unwired.
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path) || path.includes("/testSupport/");
const production = Object.entries(sources).filter(([path]) => !isTest(path));
const importsOf = (path: string) => [...(sources[path] ?? "").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

const NEAR_MISS = "/src/logic/discovery/nearMiss.ts";
const RESULT_NEAR_MISS = "/src/state/resultNearMiss.ts";
const ORIGINAL_COPY = "/src/state/originalResultCopy.ts";

describe("Free Cooking only: Dinner, guided and Lunch Rush never reach the ORIGINAL feedback", () => {
  it("ResultPanel is rendered by GameScreen only", () => {
    const users = production.filter(([, text]) => text.includes("<ResultPanel")).map(([p]) => p);
    expect(users).toEqual(["/src/screens/GameScreen.tsx"]);
  });

  it("resultNearMiss / originalResultCopy have no other production caller than the RESULT card path", () => {
    const callers = (needle: RegExp) =>
      production.filter(([p, text]) => p !== RESULT_NEAR_MISS && p !== ORIGINAL_COPY && needle.test(text)).map(([p]) => p).sort();
    // P3-3a: the Trial Notebook record adapter asks for the same line the card shows (OD-P3-18), through the same pure function.
    expect(callers(/resultNearMiss\(/)).toEqual(["/src/screens/GameScreen.tsx"]);
    expect(callers(/originalResultCopy["']/)).toEqual(["/src/components/ResultPanel.tsx"]);
  });

  it("GameScreen calls resultNearMiss(state) with no options, so the OFF-by-default FAR line stays off", () => {
    const game = sources["/src/screens/GameScreen.tsx"];
    expect(game).toMatch(/nearMiss=\{resultNearMiss\(state\)\}/);
    expect(game).not.toMatch(/farGeneric/);
  });

  it("no Dinner Mission / Lunch Rush surface imports the RESULT feedback modules", () => {
    const surfaces = production.filter(([p]) => /\/src\/(mission\/|screens\/DinnerMissionScreen|components\/(DinnerGameUi|MissionResultOverlay|MissionServePanel)|state\/dinner)/.test(p));
    expect(surfaces.length).toBeGreaterThan(3);
    for (const [path, text] of surfaces) {
      const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).join("|");
      expect(imports, path).not.toMatch(/resultNearMiss|originalResultCopy|discovery\/nearMiss|\/ResultPanel/);
      expect(text, path).not.toContain("<ResultPanel");
    }
  });
});

describe("Hint 5.0 economy: the feedback reads nothing from hints, Pitz, persistence or the ladder", () => {
  const FORBIDDEN = ["hint5", "discoveryHint", "hintPurchase", "selectableHint", "deduction", "persistence", "economy", "pitzReward", "hintFactMigration", "hintClassDisplay"];
  it.each([NEAR_MISS, RESULT_NEAR_MISS, ORIGINAL_COPY])("%s imports none of them", (path) => {
    const imports = importsOf(path);
    expect(imports.length).toBeGreaterThan(0);
    for (const forbidden of FORBIDDEN) expect(imports.join("|"), `${path} -> ${forbidden}`).not.toContain(forbidden);
  });

  it("ResultNearMissInput has no hint-fact / Pitz / ladder field", () => {
    const text = sources[RESULT_NEAR_MISS];
    const block = text.slice(text.indexOf("export interface ResultNearMissInput"), text.indexOf("export interface ResultNearMissLine"));
    expect(block).not.toMatch(/hint|pitz|fact|purchase|ladder/i);
  });
});

describe("Owner decisions (P2) stay contained", () => {
  it("the AMBIGUOUS candidate list and the decided flag are gone (OD-P2-1 = A is decided)", () => {
    for (const [path, text] of Object.entries(sources)) {
      if (path.endsWith("resultFeedback.gate.test.ts")) continue;
      expect(text, path).not.toMatch(/AMBIGUOUS_COPY_CANDIDATES|AMBIGUOUS_COPY_DECIDED/);
    }
  });

  it("the generic FAR switch and copy are read only by resultNearMiss itself", () => {
    const users = production.filter(([p, text]) => p !== RESULT_NEAR_MISS && /RESULT_FAR_GENERIC_ENABLED|NEAR_MISS_FAR_GENERIC_COPY/.test(text)).map(([p]) => p);
    expect(users).toEqual([]);
  });

  // P1 (Attempt Fingerprint) introduced `attemptFingerprint.ts`, and P3-1 (Trial Notebook pure model) introduced
  // `trialNotebook.ts`. Each may exist and carry its own name; this gate still guarantees that no *other*
  // production file mentions either before P3 wiring (together with attemptFingerprint.gate.test.ts and
  // trialNotebook.gate.test.ts, which pin the import / reference graph). The allowlists are exactly these files.
  const ATTEMPT_FINGERPRINT_MODULE = "/src/logic/discovery/attemptFingerprint.ts";
  const TRIAL_NOTEBOOK_MODULE = "/src/logic/discovery/trialNotebook.ts";
  // P3-3a (OD-P3-17): the record adapter and the reducer that carries the notebook are the only wired files.
  const RECORD_ADAPTER = "/src/state/trialRecord.ts";
  const REDUCER = "/src/state/gameReducer.ts";

  it("no production file other than the P1 module, the Trial Notebook model and the P3-3a record adapter mentions the Attempt Fingerprint", () => {
    for (const [path, text] of production) {
      if (path === ATTEMPT_FINGERPRINT_MODULE || path === TRIAL_NOTEBOOK_MODULE || path === RECORD_ADAPTER) continue;
      expect(text, path).not.toMatch(/attemptFingerprint/i);
    }
  });

  // Notebook N1: the read-only readers (GameScreen relay, Hint sheet, notebook sheet); trialNotebook.gate.test.ts pins the exact list.
  // Notebook N2 adds the pure diff helper (it only reads two player combinations).
  const N1_READERS = ["/src/screens/GameScreen.tsx", "/src/components/HintSheet.tsx", "/src/components/TrialNotebookSheet.tsx", "/src/logic/discovery/trialNotebookDiff.ts"];
  it("no production file other than the Trial Notebook model, the record adapter, the reducer and the N1 readers mentions the Trial Notebook", () => {
    for (const [path, text] of production) {
      if (path === TRIAL_NOTEBOOK_MODULE || path === RECORD_ADAPTER || path === REDUCER || N1_READERS.includes(path)) continue;
      expect(text, path).not.toMatch(/trialNotebook/i);
    }
  });
});

describe("Scope guards: identity semantics and the hint ladder are untouched", () => {
  it("the matcher and signature still declare the same identity source", () => {
    expect(sources["/src/logic/discovery/signature.ts"]).toContain("export const RUNTIME_SUPPORTED_CAPABILITIES: readonly string[] = [];");
    expect(sources["/src/logic/discovery/matcher.ts"]).toContain("There is no fallback");
  });

  it("nearMiss keeps comparing on the matcher's two observed axes only", () => {
    const text = sources[NEAR_MISS];
    expect(text).toContain("signature.ingredientSet.value");
    expect(text).toContain("signature.sauceBase.value");
    expect(text).not.toMatch(/dimensions|ingredientCounts/);
  });
});
