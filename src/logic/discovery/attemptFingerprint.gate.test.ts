import { describe, expect, it } from "vitest";

/**
 * Original Pizza Recovery P1: the Attempt Fingerprint is a pure, UNWIRED foundation. These gates
 * scan the real source tree, so wiring it into production (or letting it read recipe / Dex / hint
 * data) fails here and must be a deliberate, reviewed change (P3+), not a side effect.
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

const MODULE = "/src/logic/discovery/attemptFingerprint.ts";
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path) || path.includes("/testSupport/");

describe("Attempt Fingerprint — production wiring is 0", () => {
  it("the module exists in the scanned tree", () => {
    expect(Object.keys(sources)).toContain(MODULE);
  });

  // Approved production importers: P3-1's Trial Notebook pure model (OD-P3-1/12) and, since P3-3a (OD-P3-17), the
  // reducer-side record adapter `state/trialRecord.ts`, which asks for the fingerprint of the finished pizza and
  // nothing else. The reducer, App, UI, Dex, Builder and save never import it directly.
  const APPROVED_IMPORTER = "/src/logic/discovery/trialNotebook.ts";
  const RECORD_ADAPTER = "/src/state/trialRecord.ts";

  it("no production (non-test) file imports it except the Trial Notebook model and the P3-3a record adapter", () => {
    const importers = Object.entries(sources)
      .filter(([path]) => path !== MODULE && !isTest(path))
      .filter(([, text]) => /from\s+["'][^"']*attemptFingerprint["']/.test(text) || /import\(\s*["'][^"']*attemptFingerprint["']/.test(text))
      .map(([path]) => path);
    expect(importers.sort()).toEqual([APPROVED_IMPORTER, RECORD_ADAPTER].sort());
  });

  it("only its own test files, the Trial Notebook model and the record adapter reference it", () => {
    const referencing = Object.entries(sources)
      .filter(([path]) => path !== MODULE)
      .filter(([, text]) => /attemptFingerprint["']/.test(text))
      .map(([path]) => path)
      .sort();
    expect(referencing).toEqual(
      [
        APPROVED_IMPORTER,
        RECORD_ADAPTER,
        "/src/logic/discovery/attemptFingerprint.test.ts",
        "/src/logic/discovery/trialNotebook.gate.test.ts", // asserts the model imports exactly ./attemptFingerprint
        "/src/logic/discovery/trialNotebook.test.ts",
        "/src/state/trialRecord.gate.test.ts", // asserts the adapter imports exactly P1, the matcher type, P3-1 and P2's line
        "/src/state/trialRecord.test.ts", // fail-closed adapter tests (mocks the fingerprint)
      ].sort(),
    );
    for (const path of referencing) expect(isTest(path) || path === APPROVED_IMPORTER || path === RECORD_ADAPTER, path).toBe(true);
  });
});

describe("Attempt Fingerprint — imports only the matcher's own identity source", () => {
  const text = sources[MODULE] ?? "";
  const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).sort();

  it("imports exactly ./signature and the PizzaState type", () => {
    expect(imports).toEqual(["../../state/pizzaState", "./signature"]);
  });

  it("the state import is type-only (no runtime dependency on game state)", () => {
    expect(text).toMatch(/import type \{ PizzaState \} from "..\/..\/state\/pizzaState"/);
  });

  it("does not touch recipes, Dex, catalog, hints, near-miss, economy or persistence", () => {
    for (const forbidden of ["data/recipes", "discoveryCatalog", "state/dex", "nearMiss", "hintTarget", "hint5", "persistence", "economy", "matcher"]) {
      expect(imports.join("|"), forbidden).not.toContain(forbidden);
    }
  });
});

describe("Attempt Fingerprint — the matcher identity source is untouched by P1", () => {
  it("signature.ts still declares every identity dimension non-OBSERVED and no supported capability", () => {
    const signature = sources["/src/logic/discovery/signature.ts"];
    expect(signature).toContain("export const RUNTIME_SUPPORTED_CAPABILITIES: readonly string[] = [];");
    expect(signature).not.toMatch(/status:\s*"OBSERVED",\s*reason/);
  });
});
