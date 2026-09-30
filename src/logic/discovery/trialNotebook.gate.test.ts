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

describe("Trial Notebook model — production wiring is 0", () => {
  it("the module exists in the scanned tree", () => {
    expect(Object.keys(sources)).toContain(MODULE);
  });

  it("no production (non-test) file imports or mentions it", () => {
    const users = Object.entries(sources)
      .filter(([path]) => path !== MODULE && !isTest(path))
      .filter(([, source]) => /trialNotebook/i.test(source))
      .map(([path]) => path);
    expect(users).toEqual([]);
  });

  it("only its own test files reference it", () => {
    const referencing = Object.entries(sources)
      .filter(([path]) => path !== MODULE && /trialNotebook["']/.test(sources[path]))
      .map(([path]) => path)
      .sort();
    for (const path of referencing) expect(isTest(path), path).toBe(true);
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
