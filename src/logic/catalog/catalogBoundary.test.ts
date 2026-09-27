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

/** Value imports allowed in production catalog modules: the ingredient data and siblings. The DH4-1
 *  taxonomy is injected, never imported (DH4-1 is still unwired). */
const ALLOWED_VALUE = new Set(["../../data/ingredients"]);
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
