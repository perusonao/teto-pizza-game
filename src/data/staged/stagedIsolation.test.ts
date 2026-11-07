import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_COUNTS } from "../../logic/catalog/testSupport/catalogDerived";
import { INGREDIENTS } from "../ingredients";
import { RECIPES } from "../recipes";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

/**
 * E0 isolation (Issue #780 plan §7-1): nothing outside `src/data/staged/` may import it, so the production bundle, the
 * catalog, Dex / Shop / Research / Hint / inventory and every save stay exactly as they are. Any static or dynamic import,
 * `export ... from` or `require` that names the staged directory from another file fails this test.
 */
const SRC = join(__dirname, "..", "..");
const STAGED_DIR = join(SRC, "data", "staged");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

const REF = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']*staged[^"']*)["']/g;

describe("Staged Catalog isolation (E0)", () => {
  it("no file outside src/data/staged imports it", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.startsWith(STAGED_DIR)) continue;
      const code = readFileSync(file, "utf8");
      for (const m of code.matchAll(REF)) if (/(^|\/)staged(\/|$)/.test(m[1])) offenders.push(`${relative(SRC, file)} -> ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the entry HTML files do not reference it either", () => {
    const root = join(SRC, "..");
    const html = readdirSync(root).filter((n) => n.endsWith(".html"));
    expect(html.length).toBeGreaterThan(0);
    for (const h of html) expect(readFileSync(join(root, h), "utf8")).not.toMatch(/data\/staged/);
  });

  it("the shipped catalog contains no staged id", () => {
    const recipeIds = new Set(RECIPES.map((r) => r.id as string));
    const ingIds = new Set(INGREDIENTS.map((i) => i.id));
    expect(STAGED_RECIPES.filter((r) => recipeIds.has(r.id)).map((r) => r.id)).toEqual([]);
    expect(STAGED_INGREDIENTS.filter((i) => ingIds.has(i.id)).map((i) => i.id)).toEqual([]);
    // The ledger (catalogLedger.test.ts) is untouched; this is only a cross-check that staging changed no total.
    expect(CATALOG_COUNTS.ingredients).toBe(97);
  });
});
