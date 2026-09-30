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
      "./pantryAvailability.ts",
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
        const ok = roundKind || aliasTable || spec.startsWith("./") || (typeOnly ? ALLOWED_TYPE.has(spec) : ALLOWED_VALUE.has(spec));
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
    // LC-R3 wires the pantry SHELL: the pantry component reads OWNED rows through the query, and GameScreen
    // reads only the FREE-only eligibility gate. The working set, hand operations, hand policy and hint
    // disclosure stay unwired (R4 / R5 / enforcement flip lift their own line here, deliberately).
    const ALLOWED: Record<string, readonly string[]> = {
      // LC-R5-c: the pantry edits pins through `pinEdit` (and names the `HandSession` type); GameScreen relays the
      // App-level pins and passes the enforcement flag as the dormant `handEditing` switch; App owns the pins.
      "../../components/IngredientPantry.tsx": ["catalogQuery", "catalogSource", "usageSignals", "handSession", "pinEdit"],
      "../../screens/GameScreen.tsx": ["freeEligibility", "handPolicy", "handSession"],
      // LC-R5-d: App derives the dormant tray hand (`handTray`, over the runtime catalog and the candidate capacity).
      "../../App.tsx": ["handSession", "handTray", "catalogSource", "handPolicy"],
      // LC-R5-a: the dock reservation reads the ownership-only pantry availability authority.
      "../prepareDock.ts": ["pantryAvailability"],
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
    // #197 / OD-2: the Builder selection and the resolved hand are not the pantry's business (R5-c pins come in as
    // props and are edited only through `pinEdit`; see the LC-R5-c test below).
    expect(pantry).not.toMatch(/selectedIngredientId|selectionAfterVisibleChange|resolveHand|workingSet|handPolicy|HAND_ENFORCEMENT/);
    // OD-R4-2: session-local UI state only (no save, no browser storage).
    expect(pantry).not.toMatch(/localStorage|sessionStorage|dispatch|saveGame|persist/);
    // Membership is `ingredientShelf` (through the descriptor); no taxonomy / family table of its own.
    expect(pantry).not.toMatch(/ingredientTaxonomy|ATTRIBUTE_FAMILIES|ingredientAttributeFamily/);
    expect(imports(ALL_SOURCES["../../components/IngredientPantry.tsx"]).map((i) => i.spec)).toContain("./ShelfChips");
  });

  it("LC-R5-a (OD-R5-10): the pantry entry gate is eligible + PREPARE + not DOUGH + pantryWorthwhile -- never the pager, the hand or freeCook", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const game = strip(ALL_SOURCES["../../screens/GameScreen.tsx"]).replace(/\s+/g, " ");
    expect(game).toContain("const largeCatalogEligible = isLargeCatalogEligible(state);");
    expect(game).toContain(
      'const pantryAvailable = largeCatalogEligible && state.phase === "PREPARE" && state.makingStep !== "DOUGH" && dockReserve.pantryWorthwhile;',
    );
    const gate = game.slice(game.indexOf("const pantryAvailable"), game.indexOf("const pantryVisible"));
    expect(gate).not.toMatch(/\bpager\b|resolveHand|workingSet|handSession|freeCook|recipeFreeTray/);
    // The reserved utility row (not the pager) drives the dock class, its CSS variable and the tray's reserved row.
    expect(game).toContain('prepare-dock${dockReserve.utilityRow ? "" : " prepare-dock--no-pager"}');
    expect(game).toContain('"--dock-pager": dockReserve.utilityRow ? 1 : 0');
    expect(game).toContain("reservePagerRow={dockReserve.utilityRow}");
    expect(game).not.toMatch(/dockReserve\.pager\b/);
  });

  it("LC-R5-a: pantryAvailability reads ownership only -- no pager, hand, pin, stock, recipe, discovery or enforcement", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const src = strip(CATALOG_SOURCES["./pantryAvailability.ts"]);
    expect(src).not.toMatch(/resolveHand|workingSet|handSession|handPolicy|HAND_ENFORCEMENT|pin|inventory|remainingStock|recipe|discovery|pageCount|MakingStep/i);
    expect(imports(CATALOG_SOURCES["./pantryAvailability.ts"]).map((i) => i.spec)).toEqual(["../../data/ingredients"]);
  });

  it("LC-R5-b: the alias table is read only by catalogSource, and it imports no recipe, discovery, hint or state code", () => {
    const importers: string[] = [];
    for (const [path, text] of Object.entries(ALL_SOURCES)) {
      if (imports(text).some((i) => /ingredientSearchAliases$/.test(i.spec))) importers.push(path);
    }
    expect(importers).toEqual(["./catalogSource.ts"]);
    expect(imports(ALL_SOURCES["../../data/ingredientSearchAliases.ts"])).toEqual([]);
  });

  it("LC-R5-b: visualViewport is used only by the pantry's keyboard-fit module; the pantry search never persists or logs text", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const users = Object.entries(ALL_SOURCES)
      .filter(([, text]) => /visualViewport/.test(strip(text)))
      .map(([path]) => path);
    expect(users).toEqual(["../../components/pantryViewportFit.ts"]);
    for (const file of ["../../components/pantrySearchIme.ts", "../../components/pantryViewportFit.ts", "../../components/IngredientPantry.tsx"]) {
      expect(strip(ALL_SOURCES[file]), file).not.toMatch(/localStorage|sessionStorage|indexedDB|console\.|saveGame|persist|selectedIngredientId|resolveHand|workingSet|handPolicy|HAND_ENFORCEMENT/);
    }
    // The pantry may import the two R5-b helpers and nothing from recipes / discovery / hints.
    const specs = imports(ALL_SOURCES["../../components/IngredientPantry.tsx"]).map((i) => i.spec);
    expect(specs).toEqual(expect.arrayContaining(["./pantrySearchIme", "./pantryViewportFit"]));
    expect(specs.filter((spec) => /recipes|discovery|hint|matcher/i.test(spec))).toEqual([]);
  });

  it("LC-R5-c: pin editing is dormant (one switch = the enforcement flag), App-owned, session-only and privacy-neutral", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    // pinEdit reads only the catalog types and the R2 hand operations: no recipe / discovery / hint / state / save.
    expect(imports(CATALOG_SOURCES["./pinEdit.ts"]).map((i) => i.spec).sort()).toEqual(["./catalogTypes", "./handSession"]);
    expect(strip(CATALOG_SOURCES["./pinEdit.ts"])).not.toMatch(/recipe|discover|hint|selectedIngredient|selectionAfter|localStorage|persist|HAND_ENFORCEMENT|workingSet|resolveHand/i);
    // The pantry names the HandSession TYPE only (operations come through pinEdit).
    const pantryImports = imports(ALL_SOURCES["../../components/IngredientPantry.tsx"]);
    expect(pantryImports.filter((i) => /handSession$/.test(i.spec)).every((i) => i.typeOnly)).toBe(true);
    // The only `handEditing` value any production file passes is the enforcement flag (false until R6).
    const passes: string[] = [];
    for (const [path, text] of Object.entries(ALL_SOURCES)) {
      for (const m of strip(text).matchAll(/handEditing=\{([^}]*)\}/g)) passes.push(`${path}:${m[1]}`);
    }
    expect(passes).toEqual(["../../screens/GameScreen.tsx:HAND_ENFORCEMENT_ENABLED"]);
    expect(strip(CATALOG_SOURCES["./handPolicy.ts"])).toMatch(/export const HAND_ENFORCEMENT_ENABLED = false;/);
    // App owns the pins; the only writer handed out is the setter itself (no reset on round / HOME / FREE / Dinner).
    const app = strip(ALL_SOURCES["../../App.tsx"]);
    expect(app).toContain("useState<HandSession>(emptyHandSession)");
    expect([...app.matchAll(/setHandSession/g)].length).toBe(2); // declaration + onHandSessionChange={setHandSession}
    expect(app).toContain("onHandSessionChange={setHandSession}");
    // Never saved: persistence and the reducer know nothing about pins.
    for (const file of ["../../state/persistence.ts", "../../state/gameReducer.ts"]) {
      expect(strip(ALL_SOURCES[file]), file).not.toMatch(/handSession|HandSession|pinEdit|pinSession/);
    }
    // The Builder tray does not read pins in R5-c (R5-d wires the hand).
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
    // The pantry sees only the fit callback (no capacity / hand / enforcement knowledge).
    expect(strip(ALL_SOURCES["../../components/IngredientPantry.tsx"])).not.toMatch(/pinFitsHand|handTray|resolveHand|HAND_CAPACITY|candidateCapacity/);
    // Persistence and the reducer stay unaware.
    for (const file of ["../../state/persistence.ts", "../../state/gameReducer.ts"]) {
      expect(strip(ALL_SOURCES[file]), file).not.toMatch(/handTray|trayHand/);
    }
    // The transition state only exists behind a non-null hand: the `null` branch writes nothing but a stale track.
    const app = strip(ALL_SOURCES["../../App.tsx"]);
    expect(app).toContain("if (trayHandIds === null) {\n    if (trayHandTrack !== null) setTrayHandTrack(null);");
  });
});
