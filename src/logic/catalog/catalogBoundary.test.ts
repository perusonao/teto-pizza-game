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
      "./handTray.ts",
      "./hintDisclosure.ts",
      "./pinEdit.ts",
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
        // LC-R5-b: only the runtime source may read the search-only alias table (Owner-approved data, OD-A1).
        const aliasTable = file === "./catalogSource.ts" && spec === "../../data/ingredientSearchAliases";
        // LC-R6-b: only the policy may read the Preview-only hand variant (a leaf constant with no imports).
        const previewVariant = file === "./handPolicy.ts" && spec === "../../preview/lcHandPreview";
        const ok = roundKind || aliasTable || previewVariant || spec.startsWith("./") || (typeOnly ? ALLOWED_TYPE.has(spec) : ALLOWED_VALUE.has(spec));
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
    const forbidden = [/ingredientTaxonomy/, /hintClassDisplay/, /familyDisplay/, /hint5/i, /discovery\/(?!$)/];
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
    for (const file of ["./workingSet.ts", "./handSession.ts", "./handPolicy.ts", "./freeEligibility.ts", "./handTray.ts"]) {
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
    // All-Owned Cooking Tray: the pantry (and its catalog reads) is gone. Only App derives the dormant tray hand; the
    // working set, hand operations, hand policy and hint disclosure stay behind it.
    const ALLOWED: Record<string, readonly string[]> = {
      // LC-R5-d: App derives the dormant tray hand (`handTray`, over the runtime catalog and the candidate capacity).
      "../../App.tsx": ["handSession", "handTray", "catalogSource", "handPolicy"],
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

  it("All-Owned Cooking Tray: no pin UI remains -- no production file passes `handEditing`, the production flag is off, the pins stay empty and unsaved", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    // pinEdit reads only the catalog types and the R2 hand operations: no recipe / discovery / hint / state / save.
    expect(imports(CATALOG_SOURCES["./pinEdit.ts"]).map((i) => i.spec).sort()).toEqual(["./catalogTypes", "./handSession"]);
    expect(strip(CATALOG_SOURCES["./pinEdit.ts"])).not.toMatch(/recipe|discover|hint|selectedIngredient|selectionAfter|localStorage|persist|HAND_ENFORCEMENT|workingSet|resolveHand/i);
    // Nothing hands a pin editor to any screen any more.
    const passes: string[] = [];
    for (const [path, text] of Object.entries(ALL_SOURCES)) {
      for (const m of strip(text).matchAll(/handEditing=\{([^}]*)\}/g)) passes.push(`${path}:${m[1]}`);
    }
    expect(passes).toEqual([]);
    expect(strip(CATALOG_SOURCES["./handPolicy.ts"])).toMatch(/export const HAND_ENFORCEMENT_PRODUCTION = false;/);
    // App keeps the (now never written) session pins: no setter exists, so the pins stay empty for the whole session.
    const app = strip(ALL_SOURCES["../../App.tsx"]);
    expect(app).toContain("useState<HandSession>(emptyHandSession)");
    expect(app).not.toMatch(/setHandSession|onHandSessionChange/);
    // Never saved: persistence and the reducer know nothing about pins.
    for (const file of ["../../state/persistence.ts", "../../state/gameReducer.ts"]) {
      expect(strip(ALL_SOURCES[file]), file).not.toMatch(/handSession|HandSession|pinEdit|pinSession/);
    }
    // The Builder tray does not read pins.
    expect(strip(ALL_SOURCES["../../components/IngredientTray.tsx"])).not.toMatch(/handSession|HandSession|pinSession|pinEdit|resolveHand/);
  });
  it("LC-R5-d: the tray hand is dormant (flag-first), catalog-ordered, App-derived, and the tray only receives ids", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const tray = strip(CATALOG_SOURCES["./handTray.ts"]);
    // Pure and privacy-neutral: only siblings + the palette page-size constant.
    expect(imports(CATALOG_SOURCES["./handTray.ts"]).map((i) => i.spec).sort()).toEqual([
      "../../data/ingredients",
      "./catalogTypes",
      "./freeEligibility",
      "./handPolicy",
      "./handSession",
      "./usageSignals",
    ]);
    expect(tray).not.toMatch(/recipe|discover|hint|matcher|localStorage|persist|selectionAfterVisibleChange/i);
    // Dormant: the first statement of the resolver is the enforcement-flag guard (false => `null` => today's tray).
    expect(tray).toMatch(/export function resolveTrayHandIds\(input: TrayHandInput\): string\[\] \| null \{\s*if \(!HAND_ENFORCEMENT_ENABLED/);
    // The tray list is catalog ordered (priority selects membership only).
    expect(tray).toMatch(/\.sort\(compareCatalogOrder\)/);
    // Only App calls the resolver / the transition; the tray, GameScreen and the pantry never do.
    for (const [path, text] of Object.entries(ALL_SOURCES)) {
      if (path.startsWith("./") || path.endsWith("/App.tsx")) continue;
      expect(strip(text), path).not.toMatch(/resolveTrayHandIds|handTrayTransition/);
    }
    // The tray takes plain ids: no catalog / session knowledge.
    expect(imports(ALL_SOURCES["../../components/IngredientTray.tsx"]).filter((i) => /catalog\//.test(i.spec))).toEqual([]);
    expect(strip(ALL_SOURCES["../../components/IngredientTray.tsx"])).not.toMatch(/handSession|HandSession|pinSession|pinEdit|resolveHand|handTray/);
    // Persistence and the reducer stay unaware.
    for (const file of ["../../state/persistence.ts", "../../state/gameReducer.ts"]) {
      expect(strip(ALL_SOURCES[file]), file).not.toMatch(/handTray|trayHand/);
    }
    // The transition state only exists behind a non-null hand: the `null` branch writes nothing but a stale track.
    const app = strip(ALL_SOURCES["../../App.tsx"]);
    expect(app).toContain("if (trayHandIds === null) {\n    if (trayHandTrack !== null) setTrayHandTrack(null);");
  });
  it("LC-R5-e-h H-3: a round / step transition is never evaluated as a hand change (the key guard)", () => {
    // Behaviourally this is covered by App.handActivation.handOn (H-3), but the mutant that drops the key guard is
    // EQUIVALENT under today's render order: every round / step change first passes a render whose tray hand is
    // null (DOUGH, BAKE / RESULT) and the existing resets run before the transition. This gate locks the guard so a
    // refactor of that order (e.g. resets moved into an effect) cannot silently let a key change clear or keep a
    // selection through the #197 path.
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const app = strip(ALL_SOURCES["../../App.tsx"]);
    expect(app).toContain("const trayHandKey = `${roundKey}|${activeCategory}`;");
    expect(app).toContain("if (trayHandTrack !== null && trayHandTrack.key === trayHandKey) {");
    expect([...app.matchAll(/handTrayTransition\(/g)]).toHaveLength(1);
    // The round / step resets come first in the render body; the hand transition after them.
    const roundReset = app.indexOf("if (lastRoundKey !== roundKey) {");
    const stepReset = app.indexOf("if (lastMakingStep !== state.makingStep) {");
    const transition = app.indexOf("handTrayTransition(");
    expect(roundReset).toBeGreaterThan(-1);
    expect(stepReset).toBeGreaterThan(roundReset);
    expect(transition).toBeGreaterThan(stepReset);
  });
});
