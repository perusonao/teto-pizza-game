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

  // P3-1 (Trial Notebook pure model) is the one production importer the Owner approved (OD-P3-1/12). It is itself
  // unwired (trialNotebook.gate.test.ts), so the chain App/reducer/RESULT/Dex/Builder/save -> fingerprint stays 0.
  const APPROVED_IMPORTER = "/src/logic/discovery/trialNotebook.ts";

  it("no production (non-test) file imports it except the unwired Trial Notebook model", () => {
    const importers = Object.entries(sources)
      .filter(([path]) => path !== MODULE && !isTest(path))
      .filter(([, text]) => /from\s+["'][^"']*attemptFingerprint["']/.test(text) || /import\(\s*["'][^"']*attemptFingerprint["']/.test(text))
      .map(([path]) => path);
    expect(importers).toEqual([APPROVED_IMPORTER]);
  });

  it("only its own test files and the Trial Notebook model reference it", () => {
    const referencing = Object.entries(sources)
      .filter(([path]) => path !== MODULE)
      .filter(([, text]) => /attemptFingerprint["']/.test(text))
      .map(([path]) => path)
      .sort();
    expect(referencing).toEqual(
      [
        APPROVED_IMPORTER,
        "/src/logic/discovery/attemptFingerprint.test.ts",
        "/src/logic/discovery/trialNotebook.gate.test.ts", // asserts the model imports exactly ./attemptFingerprint
        "/src/logic/discovery/trialNotebook.test.ts",
      ].sort(),
    );
    for (const path of referencing) expect(isTest(path) || path === APPROVED_IMPORTER, path).toBe(true);
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
