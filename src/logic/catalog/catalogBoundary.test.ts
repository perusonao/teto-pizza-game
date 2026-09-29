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
      "./freeEligibility.ts",
      "./handPolicy.ts",
      "./handSession.ts",
      "./hintDisclosure.ts",
      "./usageSignals.ts",
      "./workingSet.ts",
    ]);
  });

  it("P-7 (B-1): production catalog modules import no recipe, matcher, hint model, taxonomy, state or mission code", () => {
    const violations: string[] = [];
    for (const [file, text] of Object.entries(CATALOG_SOURCES)) {
      for (const { spec, typeOnly } of imports(text)) {
        // LC-R2 (OD-1): only the FREE-eligibility module may read the explicit round kind (a pure enum helper).
        const roundKind = file === "./freeEligibility.ts" && spec === "../../state/roundKind";
        const ok = roundKind || spec.startsWith("./") || (typeOnly ? ALLOWED_TYPE.has(spec) : ALLOWED_VALUE.has(spec));
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

  it("LC-R2: the hand modules never touch shelves, the taxonomy or the raw round flags", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const file of ["./workingSet.ts", "./handSession.ts", "./handPolicy.ts", "./freeEligibility.ts"]) {
      const code = strip(CATALOG_SOURCES[file]);
      expect(code, file).not.toMatch(/\bshelf\b|\bshelves\b|ingredientShelf|ingredientTaxonomy|ATTRIBUTE_FAMILIES/);
    }
    // The FREE gate reads the explicit round kind and `dinner`; it must not use `freeCook` or `recipeFreeTray`.
    const gate = strip(CATALOG_SOURCES["./freeEligibility.ts"]);
    expect(gate).not.toMatch(/\bfreeCook\b|recipeFreeTray/);
    expect(gate).toMatch(/isFreeCookingRound/);
    expect(gate).toMatch(/dinner === null/);
  });

  it("dexActionSummary imports nothing (stock can never become an input by accident)", () => {
    expect(imports(CATALOG_SOURCES["./dexActionSummary.ts"])).toEqual([]);
  });

  it("B-6 (LC-R3): only the named production files import the catalog, and only the named modules", () => {
    // LC-R3 wires the pantry SHELL: the pantry component reads OWNED rows through the query, and GameScreen
    // reads only the FREE-only eligibility gate. The working set, hand operations, hand policy and hint
    // disclosure stay unwired (R4 / R5 / enforcement flip lift their own line here, deliberately).
    const ALLOWED: Record<string, readonly string[]> = {
      "../../components/IngredientPantry.tsx": ["catalogQuery", "catalogSource", "usageSignals"],
      "../../screens/GameScreen.tsx": ["freeEligibility"],
    };
    const violations: string[] = [];
    for (const [path, text] of Object.entries(ALL_SOURCES)) {
      if (path.startsWith("./") || path.includes("/testSupport/")) continue;
      for (const { spec } of imports(text)) {
        if (!(/(^|\/)catalog\//.test(spec) || /\/catalog$/.test(spec))) continue;
        const module = spec.split("/").pop() ?? "";
        if (!(ALLOWED[path] ?? []).includes(module)) violations.push(`${path} -> ${spec}`);
      }
    }
    expect(Object.keys(ALL_SOURCES).length).toBeGreaterThan(50);
    expect(violations).toEqual([]);
    for (const path of Object.keys(ALLOWED)) expect(ALL_SOURCES[path], path).toBeDefined();
  });

  it("LC-R4: the pantry filters only itself -- no selection, hand, save or shelf-membership logic of its own", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const pantry = strip(ALL_SOURCES["../../components/IngredientPantry.tsx"]);
    // #197 / OD-2: the Builder selection and the hand are not the pantry's business in R4.
    expect(pantry).not.toMatch(/selectedIngredientId|selectionAfterVisibleChange|handSession|workingSet|handPolicy/);
    // OD-R4-2: session-local UI state only (no save, no browser storage).
    expect(pantry).not.toMatch(/localStorage|sessionStorage|dispatch|saveGame|persist/);
    // Membership is `ingredientShelf` (through the descriptor); no taxonomy / family table of its own.
    expect(pantry).not.toMatch(/ingredientTaxonomy|ATTRIBUTE_FAMILIES|ingredientAttributeFamily/);
    expect(imports(ALL_SOURCES["../../components/IngredientPantry.tsx"]).map((i) => i.spec)).toContain("./ShelfChips");
  });

  it("LC-R4 (OD-R4-3): the pantry entry gate is exactly the R3 gate -- still tied to the reserved pager row until R5 splits them", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const game = strip(ALL_SOURCES["../../screens/GameScreen.tsx"]).replace(/\s+/g, " ");
    expect(game).toContain(
      'const pantryAvailable = isLargeCatalogEligible(state) && state.phase === "PREPARE" && state.makingStep !== "DOUGH" && dockReserve.pager;',
    );
  });
});
