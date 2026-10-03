import { describe, expect, it } from "vitest";

/**
 * Original Pizza Recovery P3-1: the Trial Notebook is a pure, UNWIRED, session-only model. These gates scan
 * the real source tree, so wiring it into production, letting it read recipe / Dex / hint / save data, or
 * giving its entries a hidden-information field fails here and must be a deliberate, reviewed change (P3-2+).
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

const MODULE = "/src/logic/discovery/trialNotebook.ts";
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path) || path.includes("/testSupport/");
const text = sources[MODULE] ?? "";

// P3-3a (OD-P3-17): the model is wired into STATE only. The record adapter is its one runtime importer; the reducer
// holds the field (type + `createTrialNotebook()` for the initial value) and calls the adapter. Nothing else in
// production may mention it: no UI, App, persistence, Dex, Builder, mission or P3-2 file.
const RECORD_ADAPTER = "/src/state/trialRecord.ts";
const REDUCER = "/src/state/gameReducer.ts";
const WIRED = [RECORD_ADAPTER, REDUCER].sort();
// Discovery 3.0 Notebook N1 (OD-N1-1/2): the read-only 試作ノート. GameScreen relays `notebookView(state.trialNotebook)`
// to the Hint sheet, which opens TrialNotebookSheet. These three files are the only readers; none writes.
const N1_READERS = ["/src/screens/GameScreen.tsx", "/src/components/HintSheet.tsx", "/src/components/TrialNotebookSheet.tsx"];
// Notebook N2: the pure diff helper (type-only import of TrialCombination; reads nothing but two player combinations).
const N2_READERS = ["/src/logic/discovery/trialNotebookDiff.ts"];
const ALLOWED = [...WIRED, ...N1_READERS, ...N2_READERS].sort();

describe("Trial Notebook model — wired into state only (P3-3a)", () => {
  it("the module exists in the scanned tree", () => {
    expect(Object.keys(sources)).toContain(MODULE);
  });

  it("exactly the record adapter, the reducer and the N1 read-only readers mention it in production", () => {
    const users = Object.entries(sources)
      .filter(([path]) => path !== MODULE && !isTest(path))
      .filter(([, source]) => /trialNotebook/i.test(source))
      .map(([path]) => path)
      .sort();
    expect(users).toEqual(ALLOWED);
  });

  it("exactly the record adapter, the reducer and the N1 read-only readers import it", () => {
    const importers = Object.entries(sources)
      .filter(([path]) => path !== MODULE && !isTest(path))
      .filter(([, source]) => /from\s+["'][^"']*\/trialNotebook["']/.test(source))
      .map(([path]) => path)
      .sort();
    expect(importers).toEqual(ALLOWED);
  });

  it("only the wired files and test files reference it by import path", () => {
    const referencing = Object.entries(sources)
      .filter(([path]) => path !== MODULE && /trialNotebook["']/.test(sources[path]))
      .map(([path]) => path)
      .sort();
    for (const path of referencing) expect(isTest(path) || ALLOWED.includes(path), path).toBe(true);
  });

  it("no UI, App, persistence, Dex, mission, Hint 5.0 or P3-2 file mentions the notebook or the adapter", () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !isTest(path) && path !== MODULE && !ALLOWED.includes(path))
      .filter(([, source]) => /trialNotebook|trialRecord|TrialRecord/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  // P3-3b: the RESULT notice reads the record result that the reducer wrote at the commit (`state.lastTrialAttempt`);
  // exactly one screen relays it, and nothing else outside the wired files may mention it.
  it("only GameScreen (one relay) and the wired files mention the record result", () => {
    const readers = Object.entries(sources)
      .filter(([path]) => !isTest(path) && path !== MODULE && !WIRED.includes(path))
      .filter(([, source]) => /lastTrialAttempt/.test(source))
      .map(([path]) => path);
    expect(readers).toEqual(["/src/screens/GameScreen.tsx"]);
  });
});

describe("Trial Notebook model — imports only the Attempt Fingerprint", () => {
  const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).sort();

  it("imports exactly ./attemptFingerprint", () => {
    expect(imports).toEqual(["./attemptFingerprint"]);
  });

  it("has no dynamic import or require", () => {
    expect(text).not.toMatch(/import\s*\(|require\s*\(/);
  });

  it("touches no recipe, Dex, catalog, hint, near-miss, matcher, economy, persistence or save module", () => {
    for (const forbidden of ["data/", "state/", "discoveryCatalog", "dex", "nearMiss", "matcher", "hint", "deduction", "economy", "pitz", "persistence", "save", "signature"]) {
      expect(imports.join("|").toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
    }
  });

  it("uses no storage, clock, randomness, network or DOM", () => {
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "Date.now", "new Date", "Math.random", "fetch(", "document.", "window."]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});

describe("Trial Notebook model — no hidden-information field", () => {
  it("the entry view types declare none of the forbidden concepts as a field", () => {
    // Anchors must exist: a stale anchor would make `slice` silently scan the wrong text.
    const anchors = ["export interface TrialEntryView", "export type RejectReason", "interface IdentityRecord", "export interface TrialNotebook {"].map((a) => text.indexOf(a));
    expect(anchors.every((i) => i >= 0)).toBe(true);
    const view = text.slice(anchors[0], anchors[1]);
    const stored = text.slice(anchors[2], anchors[3]);
    for (const block of [view, stored]) {
      for (const forbidden of ["recipe", "target", "distance", "collision", "hint", "technique", "candidate", "answer"]) {
        expect(block.toLowerCase(), forbidden).not.toContain(forbidden);
      }
    }
  });
});
