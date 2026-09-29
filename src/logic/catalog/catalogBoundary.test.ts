import { describe, expect, it } from "vitest";

/**
 * Privacy / production boundary (Implementation Gate §4, B-1 and B-6), checked on the source text so
 * a mutant that reaches for recipe or matcher data fails here even if no behavior test notices.
 * Same technique as DH4-1's own "unwired" guard (../discovery/deductionHint.test.ts).
 */
const CATALOG_SOURCES = import.meta.glob<string>(["./**/*.ts", "!./**/*.test.ts", "!./testSupport/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const ALL_SOURCES = import.meta.glob<string>(["../../**/*.{ts,tsx}", "!../../**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

function imports(source: string): { spec: string; typeOnly: boolean }[] {
  const out: { spec: string; typeOnly: boolean }[] = [];
  for (const m of source.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gms)) {
    out.push({ spec: m[2], typeOnly: !!m[1] });
  }
  for (const m of source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']/g)) out.push({ spec: m[1], typeOnly: false });
  // Side-effect imports (`import "x";`) have no `from`.
  for (const m of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push({ spec: m[1], typeOnly: false });
  for (const m of source.matchAll(/^\s*export\s+[^;]*?from\s+["']([^"']+)["']/gms)) out.push({ spec: m[1], typeOnly: false });
  return out;
}

/** Value imports allowed in production catalog modules: the ingredient data, the shelf membership
 *  authority (used from LC-R1; the old "taxonomy is injected" rule is retired) and siblings. The DH4-1
 *  taxonomy itself and Hint 5 display tables stay forbidden: shelf membership only comes through
 *  `ingredientShelf`. */
const ALLOWED_VALUE = new Set(["../../data/ingredients", "../../data/ingredientShelf"]);
/** Type-only imports additionally allowed (the hint sheet's view type is the disclosure boundary). */
const ALLOWED_TYPE = new Set([...ALLOWED_VALUE, "../../state/discoveryHint"]);

describe("catalog boundary", () => {
  it("has production catalog modules to check", () => {
    expect(Object.keys(CATALOG_SOURCES).sort()).toEqual([
      "./catalogQuery.ts",
      "./catalogSource.ts",
      "./catalogText.ts",
      "./catalogTypes.ts",
      "./dexActionSummary.ts",
      "./hintDisclosure.ts",
      "./usageSignals.ts",
      "./workingSet.ts",
    ]);
  });

  it("P-7 (B-1): production catalog modules import no recipe, matcher, hint model, taxonomy, state or mission code", () => {
    const violations: string[] = [];
    for (const [file, text] of Object.entries(CATALOG_SOURCES)) {
      for (const { spec, typeOnly } of imports(text)) {
        const ok = spec.startsWith("./") || (typeOnly ? ALLOWED_TYPE.has(spec) : ALLOWED_VALUE.has(spec));
        if (!ok) violations.push(`${file} -> ${spec}${typeOnly ? " (type)" : ""}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("LC-R1 dependency direction: only catalogSource imports ingredientShelf as a value; the query / model classify nothing", () => {
    const valueImporters: string[] = [];
    const typeImporters: string[] = [];
    for (const [file, text] of Object.entries(CATALOG_SOURCES)) {
      for (const { spec, typeOnly } of imports(text)) {
        if (spec !== "../../data/ingredientShelf") continue;
        (typeOnly ? typeImporters : valueImporters).push(file);
      }
    }
    expect(valueImporters).toEqual(["./catalogSource.ts"]);
    // The model and the query only name the id type; no membership helper is called from them.
    expect(typeImporters.sort()).toEqual(["./catalogQuery.ts", "./catalogTypes.ts"]);
  });

  it("LC-R1: no catalog module reaches the taxonomy, Hint 5 display / ladder, or the shelf filter helpers", () => {
    const forbidden = [/ingredientTaxonomy/, /hintClassDisplay/, /hint5/i, /discovery\/(?!$)/];
    const violations: string[] = [];
    for (const [file, text] of Object.entries(CATALOG_SOURCES)) {
      for (const { spec } of imports(text)) if (forbidden.some((re) => re.test(spec))) violations.push(`${file} -> ${spec}`);
      // The only membership call allowed is ingredientShelf() in catalogSource; filterByShelf / shelvesPresent
      // would be a second filter authority inside the query layer.
      if (/\b(filterByShelf|shelvesPresent|auditShelfAuthority|ingredientAttributeFamily)\b/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) {
        violations.push(`${file} uses a shelf/taxonomy helper`);
      }
    }
    expect(violations).toEqual([]);
    const source = CATALOG_SOURCES["./catalogSource.ts"].replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(source.match(/ingredientShelf\(/g)).toHaveLength(1);
  });

  it("dexActionSummary imports nothing (stock can never become an input by accident)", () => {
    expect(imports(CATALOG_SOURCES["./dexActionSummary.ts"])).toEqual([]);
  });

  it("B-6: no production file outside src/logic/catalog imports it (LC-1 is unwired)", () => {
    const offenders = Object.entries(ALL_SOURCES)
      .filter(([path]) => !path.startsWith("./") && !path.includes("/testSupport/"))
      .filter(([, text]) => imports(text).some(({ spec }) => /(^|\/)catalog\//.test(spec) || /\/catalog$/.test(spec)))
      .map(([path]) => path);
    expect(Object.keys(ALL_SOURCES).length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
