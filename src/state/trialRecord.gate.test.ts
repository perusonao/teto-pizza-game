import { describe, expect, it } from "vitest";

/**
 * Original Pizza Recovery P3-3a: boundary gates over the real source tree for the Trial Notebook data wiring.
 * They pin WHERE the record happens (one reducer branch), WHAT the adapter may read (P1, P3-1, P2's own line function),
 * and what must stay out (P3-2, persistence, any render, any other mode).
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path) || path.includes("/testSupport/");
const production = Object.entries(sources).filter(([path]) => !isTest(path));

const ADAPTER = "/src/state/trialRecord.ts";
const REDUCER = "/src/state/gameReducer.ts";
const adapterFull = sources[ADAPTER] ?? "";
/** The adapter's code with comments removed: the header explains what is forbidden, so it may name it. */
const adapter = adapterFull.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const reducer = sources[REDUCER] ?? "";
const importsOf = (text: string) => [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).sort();

describe("record adapter: authority and inputs", () => {
  it("exists and imports exactly P1, the matcher outcome type, the P3-1 model and P2's line function", () => {
    expect(adapterFull.length).toBeGreaterThan(0);
    expect(importsOf(adapter)).toEqual(["../logic/discovery/attemptFingerprint", "../logic/discovery/matcher", "../logic/discovery/trialNotebook", "./resultNearMiss"]);
    expect(adapter).toMatch(/import type \{ DiscoveryOutcome \} from "..\/logic\/discovery\/matcher"/);
  });

  it("uses P1 for identity and the P3-1 model for duplicates: no re-implementation", () => {
    expect(adapter).toContain("attemptFingerprintOfPizza(input.pizza)");
    expect(adapter).toContain("recordAttempt(input.trialNotebook");
    for (const forbidden of ["signatureOfPizza", "JSON.stringify", "retryCount", "includes(", "indexOf(", ".find("]) {
      expect(adapter, forbidden).not.toContain(forbidden);
    }
  });

  it("reads no storage, clock, randomness, DOM, hint, Pitz, economy, persistence, Dex-memo or P3-2 module", () => {
    const imports = importsOf(adapter).join("|").toLowerCase();
    for (const forbidden of ["persistence", "hint5", "discoverymemo", "discoveryhint", "hintpurchase", "pitz", "economy", "dex", "nearmiss.ts", "catalog", "recipes"]) {
      expect(imports, forbidden).not.toContain(forbidden);
    }
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "Date.now", "new Date", "Math.random", "document.", "window.", "useEffect", "useState"]) {
      expect(adapter, forbidden).not.toContain(forbidden);
    }
  });

  it("the record result type carries only kind and the stable #n (no retryCount, no outcome, no internal field)", () => {
    const type = adapter.slice(adapter.indexOf("export type LastTrialAttempt"), adapter.indexOf("export interface TrialRecordInput"));
    expect(type).toContain('{ kind: "NEW"; number: number }');
    expect(type).toContain('{ kind: "DUPLICATE"; number: number }');
    for (const forbidden of ["retry", "distance", "target", "candidate", "recipe", "outcome", "feedback"]) {
      expect(type.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it("stores exactly the two fields of the P2 line", () => {
    expect(adapter).toContain("{ kind: line.kind, textJa: line.textJa }");
  });

  it("eligibility is the ORIGINAL and AMBIGUOUS outcomes only (OD-P3-16)", () => {
    expect(adapter).toContain('outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS"');
    expect(adapter).not.toMatch(/INCOMPLETE_MATCH|NEW_DISCOVERY|ALREADY_DISCOVERED/);
  });
});

describe("reducer: exactly one commit point, in the free-cook ORIGINAL branch of REGISTER_TO_DEX", () => {
  const regionStart = reducer.indexOf('case "REGISTER_TO_DEX": {');
  const branchStart = reducer.indexOf("if (state.freeCook && !state.score) {", regionStart);
  const branchEnd = reducer.indexOf("if (!state.score) {", branchStart);

  it("anchors exist", () => {
    expect(regionStart).toBeGreaterThan(0);
    expect(branchStart).toBeGreaterThan(regionStart);
    expect(branchEnd).toBeGreaterThan(branchStart);
  });

  it("recordTrialAttempt is called exactly once in the whole reducer, inside that branch, after the ORIGINAL / PASS guards", () => {
    expect(reducer.match(/recordTrialAttempt\(/g)).toHaveLength(1);
    const call = reducer.indexOf("recordTrialAttempt(");
    expect(call).toBeGreaterThan(branchStart);
    expect(call).toBeLessThan(branchEnd);
    const branch = reducer.slice(branchStart, branchEnd);
    expect(branch.indexOf('state.completion?.status !== "PASS"')).toBeGreaterThan(-1);
    expect(branch.indexOf('resolution.kind !== "ORIGINAL"')).toBeGreaterThan(-1);
    expect(branch.indexOf('resolution.kind !== "ORIGINAL"')).toBeLessThan(branch.indexOf("recordTrialAttempt("));
    expect(reducer.slice(regionStart, branchStart)).toContain('if (state.phase !== "RESULT")'); // the exactly-once phase guard
  });

  it("the adapter is fed the committed outcome, not a recomputation", () => {
    expect(reducer).toContain("recordTrialAttempt(state, resolution.outcome)");
  });

  it("the notebook is written in exactly one place: the commit (besides carry / initial value)", () => {
    const assignments = [...reducer.matchAll(/\btrialNotebook:\s*([^,\n]+)/g)].map((m) => m[1].trim()).sort();
    expect(assignments).toEqual(["TrialNotebook;", "TrialNotebook;", "createTrialNotebook()", "state.trialNotebook", "trial.trialNotebook"].sort());
  });

  it("the record result is reset by the one fresh-round builder and set only by the commit", () => {
    const assignments = [...reducer.matchAll(/\blastTrialAttempt:\s*([^,\n]+)/g)].map((m) => m[1].trim()).sort();
    expect(assignments).toEqual(["LastTrialAttempt | null;", "null", "trial.lastTrialAttempt"].sort());
  });

  it("the notebook rides ProgressionCarry and carryOf (so every fresh-round path keeps it)", () => {
    const iface = reducer.slice(reducer.indexOf("interface ProgressionCarry"), reducer.indexOf("function buildOrderState"));
    expect(iface).toContain("trialNotebook: TrialNotebook;");
    const carry = reducer.slice(reducer.indexOf("function carryOf"), reducer.indexOf("function dinnerFreeRound"));
    expect(carry).toContain("trialNotebook: state.trialNotebook");
  });

  it("the initial state builds an empty notebook (reload / Full Game Reset start empty)", () => {
    const init = reducer.slice(reducer.indexOf("export function createInitialGameState"), reducer.indexOf("let placedIdCounter"));
    expect(init).toContain("trialNotebook: createTrialNotebook()");
    expect(init).not.toMatch(/trialNotebook,\s|trialNotebook\s*=/); // no parameter: a caller cannot hydrate one from a save
  });
});

describe("what must stay out", () => {
  it("the save never sees the notebook: persistence, App and every storage user mention none of it", () => {
    const storageUsers = production.filter(([, text]) => /localStorage|sessionStorage|indexedDB/.test(text)).map(([path]) => path);
    expect(storageUsers.length).toBeGreaterThan(0);
    for (const path of [...storageUsers, "/src/state/persistence.ts", "/src/App.tsx"]) {
      expect(sources[path] ?? "", path).not.toMatch(/trialNotebook|lastTrialAttempt|trialRecord|fp1:/);
    }
  });

  it("App's save writer lists fields explicitly (no state spread), so a new GameState field is never saved by accident", () => {
    const app = sources["/src/App.tsx"];
    const call = app.slice(app.indexOf("persistProgress({"), app.indexOf("requireDinnerRecords: true"));
    expect(call.length).toBeGreaterThan(100);
    expect(call).not.toMatch(/\.\.\.state\b/);
  });

  it("no production file mentions the P3-2 Discovery Memo, and no Dex fact is produced from the notebook or P2", () => {
    expect(production.filter(([, text]) => /discoveryMemo/i.test(text)).map(([p]) => p)).toEqual([]);
    for (const [path, text] of production) {
      if (path === ADAPTER || path === "/src/logic/discovery/trialNotebook.ts") continue;
      expect(text, path).not.toMatch(/notebookView\(|lookupAttempt\(|recordAttempt\(/); // the model's read/write API is used by the adapter only
    }
  });

  it("no component or screen renders or reads the notebook or the record result in P3-3a (no UI change)", () => {
    const ui = production.filter(([p]) => /^\/src\/(components|screens)\//.test(p));
    expect(ui.length).toBeGreaterThan(10);
    for (const [path, text] of ui) expect(text, path).not.toMatch(/trialNotebook|lastTrialAttempt|TrialEntryView|notebookView/);
  });

  it("the ORIGINAL RESULT copy and the P2 line are untouched by the wiring", () => {
    const panel = sources["/src/components/ResultPanel.tsx"];
    expect(panel).not.toMatch(/trial|notebook/i);
    expect(sources["/src/screens/GameScreen.tsx"]).toMatch(/nearMiss=\{resultNearMiss\(state\)\}/);
  });
});
