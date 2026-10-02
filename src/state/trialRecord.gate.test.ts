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

  it("stores no near/far feedback (always null) and never calls resultNearMiss", () => {
    expect(adapter).toContain("feedback: null,");
    expect(adapter).not.toMatch(/resultNearMiss\(/);
  });

  it("eligibility is ORIGINAL, AMBIGUOUS and INCOMPLETE_MATCH only (OD-P3-16 as updated by OD-D3-23)", () => {
    expect(adapter).toContain('outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS" || outcome.kind === "INCOMPLETE_MATCH"');
    expect(adapter).not.toMatch(/NEW_DISCOVERY|ALREADY_DISCOVERED/);
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
      // the model's write API is used by the adapter only; the read API (`notebookView`) also by the N1 relay (GameScreen)
      expect(text, path).not.toMatch(/lookupAttempt\(|recordAttempt\(/);
      if (path !== "/src/screens/GameScreen.tsx") expect(text, path).not.toMatch(/notebookView\(/);
    }
  });

  it("no component or screen reads the notebook itself, except the N1 read-only readers (GameScreen relay, Hint sheet, notebook sheet)", () => {
    const N1 = ["/src/screens/GameScreen.tsx", "/src/components/HintSheet.tsx", "/src/components/TrialNotebookSheet.tsx"];
    const ui = production.filter(([p]) => /^\/src\/(components|screens)\//.test(p));
    expect(ui.length).toBeGreaterThan(10);
    for (const [path, text] of ui) {
      if (N1.includes(path)) continue;
      expect(text, path).not.toMatch(/trialNotebook|TrialEntryView|notebookView|retryCount/);
    }
    for (const [path, text] of ui) {
      if (path === "/src/screens/GameScreen.tsx") continue;
      expect(text, path).not.toMatch(/lastTrialAttempt/);
    }
  });

  it("the P2 line is untouched by the notice; the panel never sees the notebook, only a number", () => {
    const panel = sources["/src/components/ResultPanel.tsx"];
    expect(panel).not.toMatch(/notebook|lastTrialAttempt|retryCount/i);
    expect(sources["/src/screens/GameScreen.tsx"]).toMatch(/nearMiss=\{resultNearMiss\(state\)\}/);
  });

  it("GameScreen relays the record result in exactly one expression: free cook + DUPLICATE, number only", () => {
    const game = sources["/src/screens/GameScreen.tsx"];
    expect(game.match(/lastTrialAttempt/g)).toHaveLength(2);
    expect(game).toContain('trialNoticeNumber={state.freeCook && state.lastTrialAttempt?.kind === "DUPLICATE" ? state.lastTrialAttempt.number : null}');
    // Notebook N1: the one read-only relay of the model's display view to the Hint sheet; nothing else.
    expect(game.match(/trialNotebook/g)).toHaveLength(2); // import path + the one read
    expect(game.match(/notebookView/g)).toHaveLength(2); // import + call
    expect(game).toContain("const notebookRows = notebookView(state.trialNotebook);"); // #346 S4: one hoisted read, two read-only consumers
    expect(game.match(/notebookRows/g)).toHaveLength(3); // the read + the Hint sheet + the Research RESULT sheet
  });

  it("Notebook N1: the notebook sheet is read-only (no reducer, save, storage, clock or dispatch) and never renders a row's `kind`", () => {
    const sheet = sources["/src/components/TrialNotebookSheet.tsx"];
    const code = sheet.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["gameReducer", "persistence", "localStorage", "sessionStorage", "dispatch", "Math.random", "Date.now", "new Date", "recordAttempt", "lookupAttempt"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
    expect(code).not.toMatch(/feedback\.kind|\.kind\b/);
    expect(code).toContain("entry.feedback.textJa");
  });

  it("the notice is a static paragraph on the ORIGINAL card only: after the P2 row, before the note, no live region", () => {
    const panel = sources["/src/components/ResultPanel.tsx"];
    const original = panel.slice(panel.indexOf("if (!score) {"), panel.indexOf("const freeCookMatch"));
    const hint = original.indexOf("{freeCook && hintRow(null, true)}");
    const notice = original.indexOf('<p className="original-pizza__trial-notice">{trialNoticeText}</p>');
    const note = original.indexOf('<p className="original-pizza__note">');
    expect(hint).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(hint);
    expect(note).toBeGreaterThan(notice);
    expect(panel.match(/original-pizza__trial-notice/g)).toHaveLength(1);
    expect(panel.match(/trialNoticeText/g)).toHaveLength(3); // declaration, guard, text
    expect(original.slice(notice - 120, notice + 160)).not.toMatch(/aria-live|role=/);
    expect(panel.slice(panel.indexOf("const freeCookMatch"))).not.toMatch(/trialNotice/);
  });

  it("the notice path is deterministic: no clock, randomness or storage in the panel, the relay or the copy", () => {
    for (const path of ["/src/components/ResultPanel.tsx", "/src/screens/GameScreen.tsx", "/src/state/originalResultCopy.ts"]) {
      const code = sources[path].replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const forbidden of ["Math.random", "Date.now", "new Date", "crypto.", "localStorage", "sessionStorage"]) {
        expect(code, `${path} -> ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("the notice copy comes from one pure function with no retry count and no hidden information", () => {
    const copy = sources["/src/state/originalResultCopy.ts"];
    const fn = copy.slice(copy.indexOf("export function duplicateTrialNoticeJa"), copy.indexOf("/** OD-P2-1 = A"));
    expect(fn).toContain("前にも同じ材料の組み合わせで作ったよ（試作#${number}）");
    for (const forbidden of ["retry", "recipe", "distance", "candidate", "target", "同じ結果", "意味がない"]) expect(fn, forbidden).not.toContain(forbidden);
  });
});
