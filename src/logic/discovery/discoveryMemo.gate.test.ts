import { describe, expect, it } from "vitest";

/**
 * Original Pizza Recovery P3-2: the Discovery Memo is a pure, UNWIRED display model whose privacy rests on
 * what it CANNOT obtain. These gates scan the real source tree and the model's own source, so a careless
 * import, a new input, or a wiring into production fails here and must be a deliberate, reviewed change.
 */
const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

const MODULE = "/src/logic/discovery/discoveryMemo.ts";
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path) || path.includes("/testSupport/");
const raw = sources[MODULE] ?? "";
/** The model's code without comments (its header documents the forbidden concepts on purpose). */
const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("Discovery memo — production wiring is 0", () => {
  it("the module exists in the scanned tree", () => {
    expect(Object.keys(sources)).toContain(MODULE);
  });

  it("no production (non-test) file imports or mentions it", () => {
    const users = Object.entries(sources)
      .filter(([path]) => path !== MODULE && !isTest(path))
      .filter(([, source]) => /discoveryMemo/i.test(source))
      .map(([path]) => path);
    expect(users).toEqual([]);
  });

  it("the Dex, App, RESULT, Builder, Notebook and save surfaces do not reference it", () => {
    for (const path of Object.keys(sources).filter((p) => /DexOverlay|\/App\.tsx|ResultPanel|GameScreen|IngredientTray|IngredientPantry|persistence|gameReducer/.test(p) && !isTest(p))) {
      expect(sources[path], path).not.toMatch(/discoveryMemo|DiscoveryMemo/);
    }
  });
});

describe("Discovery memo — imports are two erased types and nothing else", () => {
  const importStatements = [...code.matchAll(/^\s*import\b[^;]*;/gm)].map((m) => m[0].trim());

  it("has exactly the two type-only imports", () => {
    expect(importStatements).toEqual([
      'import type { Hint5Presentation } from "./hint5Ladder";',
      'import type { RecipeDiscoveryState } from "../../state/recipeDiscoveryState";',
    ]);
  });

  it("has no other import form: no value import, re-export, dynamic import or require", () => {
    expect(code.match(/\bimport\b/g)?.length).toBe(2);
    expect(code).not.toMatch(/\bexport\s+(\*|\{[^}]*\})\s+from\b|\brequire\s*\(|import\s*\(/);
  });

  it("reads no recipe, matcher, P2, Trial Notebook, fingerprint, technique, hint-purchase, economy or storage concept in code", () => {
    const forbidden = [
      /\bRECIPES\b/, /\bgetRecipe\b/, /\.description\b/, /\bnameJa\b/, /\brecipeId\b/, /\bINGREDIENTS\b/,
      /matcher/i, /nearMiss/i, /resultNearMiss/i, /trialNotebook/i, /attemptFingerprint/i, /technique/i,
      /requestHint5/i, /purchase/i, /economy/i, /persistence/i, /localStorage|sessionStorage|indexedDB/,
      /pitzBalance/, /\bprice\b/i, /\.next\b/, /candidate/i, /Date\.now|new Date|Math\.random|fetch\(/,
    ];
    for (const pattern of forbidden) expect(code, String(pattern)).not.toMatch(pattern);
  });
});

describe("Discovery memo — the input has no way in for forbidden information", () => {
  it("DiscoveryMemoInput is exactly { cardState, hint5Enabled, presentation }", () => {
    const body = /export interface DiscoveryMemoInput \{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
    const keys = [...body.matchAll(/^\s*([A-Za-z0-9_]+)\??:/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(["cardState", "hint5Enabled", "presentation"]);
  });

  it("the presentation it accepts is only board, legacyKnownIngredientIds, completeText and onboarding", () => {
    const pick = /export type MemoPresentationSource = Pick<Hint5Presentation, ([^>]*)>;/.exec(code)?.[1] ?? "";
    expect([...pick.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]).sort()).toEqual(["board", "completeText", "legacyKnownIngredientIds", "onboarding"]);
  });

  it("the output row kinds are exactly the typed rows (no candidate, slot, offer, price or recipe row)", () => {
    const allowed = ["cheese", "complete", "keyTopping", "legacyIngredient", "sauce", "structure", "subToppingFamily"];
    expect(/export type MemoNameRowKind = "sauce" \| "cheese" \| "keyTopping";/.test(code)).toBe(true);
    const union = /export type DiscoveryMemoRow =([\s\S]*?);\n\nexport interface/.exec(code)?.[1] ?? "";
    const literal = [...union.matchAll(/kind: "([A-Za-z]+)"/g)].map((m) => m[1]);
    const viaName = /kind: MemoNameRowKind/.test(union) ? ["sauce", "cheese", "keyTopping"] : [];
    expect([...new Set([...literal, ...viaName])].sort()).toEqual(allowed);
  });
});
