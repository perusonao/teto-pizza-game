#!/usr/bin/env node
/**
 * Large Catalog UX mutation gate (manual, outside CI). Ported to fresh main in LC-R0 from PR #272 (frozen at f5b0ab5).
 *
 * Applies each mutant below to the LC-1 source, runs the catalog test suite, and requires the suite
 * to FAIL (the mutant is "killed"). The source is always restored, even on error. Exit code 0 only
 * when every mutant is killed and the unmutated suite passes.
 *
 *   node tools/large-catalog-ux/mutation-check.mjs            # all mutants
 *   node tools/large-catalog-ux/mutation-check.mjs M1 M4      # a subset
 *
 * The original matrix is LC-1 Implementation Gate §6 (frozen PR #272 branch). LC-R0 retires the family /
 * taxonomy-mapping mutants (M4, M5: that authority is not migrated) and adds M5r, M17, M18; LC-R1 adds M19-M25 (shelf authority); LC-R2 adds M26-M32 (FREE gate, capacity guard, hand operations); LC-R3 adds M33-M39 (pantry shell); LC-R4 adds M40-M50 (shelf filtering in the pantry); LC-R5-a adds M51-M59 (+ M58b, M58c) and re-targets M50 (pantry availability split from the pager). The "answer
 * leak" mutants (M1, M1b, M2, M3, M7) are the ones the Owner required to be caught: any attempt to
 * mix recipe identity, matcher output, undisclosed hint facts or a Dinner target into the working
 * set must fail the suite.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const C = "src/logic/catalog";

const MUTANTS = [
  {
    id: "M1",
    what: "answer leak: import RECIPES and add every recipe ingredient to the hint source",
    file: `${C}/workingSet.ts`,
    edits: [
      ['import type { DisclosedHints } from "./hintDisclosure";', 'import type { DisclosedHints } from "./hintDisclosure";\nimport { RECIPES } from "../../data/recipes";'],
      [
        "hint: byCatalog(cleanIds(disclosedHints.namedIngredientIds)",
        "hint: byCatalog(cleanIds([...disclosedHints.namedIngredientIds, ...RECIPES.flatMap((r) => r.requiredIngredients.map((x) => x.ingredientId))])",
      ],
    ],
  },
  {
    id: "M1b",
    what: "answer leak without an import: read an extra answerIngredientIds key into the pinned source",
    file: `${C}/workingSet.ts`,
    edits: [
      [
        "pinned: cleanIds(pinnedIds).filter(inCategory),",
        "pinned: cleanIds([...pinnedIds, ...(((input as unknown as { answerIngredientIds?: string[] }).answerIngredientIds) ?? [])]).filter(inCategory),",
      ],
    ],
  },
  {
    id: "M2",
    what: "matcher leak: import the discovery matcher",
    file: `${C}/workingSet.ts`,
    edits: [
      ['import type { UsageSession } from "./usageSignals";', 'import type { UsageSession } from "./usageSignals";\nimport { matchDiscovery } from "../discovery/matcher";\nvoid matchDiscovery;'],
    ],
  },
  {
    id: "M3",
    what: "undisclosed facts: treat every ingredient of a revealed category as named",
    file: `${C}/hintDisclosure.ts`,
    edits: [
      ['import type { HintSheetView } from "../../state/discoveryHint";', 'import type { HintSheetView } from "../../state/discoveryHint";\nimport { INGREDIENTS } from "../../data/ingredients";'],
      [
        "const named = view.presentation.rows.flatMap((row) => row.revealed.map((chip) => chip.ingredientId));",
        "const named = view.presentation.rows.flatMap((row) => row.revealed.length ? INGREDIENTS.filter((i) => i.category === row.category).map((i) => i.id) : []);",
      ],
    ],
  },
  {
    id: "M5r",
    what: "search leak: the text filter is ignored",
    file: `${C}/catalogQuery.ts`,
    edits: [["(query.text === undefined || matchesSearch(item, query.text)) &&", "true &&"]],
  },
  {
    id: "M6",
    what: "stock in Dex: the ownership-basis summary starts reading inventory",
    file: `${C}/dexActionSummary.ts`,
    edits: [["export interface DexSummaryRecipe {", 'import { remainingStock } from "../../state/inventory";\nvoid remainingStock;\nexport interface DexSummaryRecipe {']],
  },
  {
    id: "M6b",
    what: "stock in Dex (behavioral): an owned id counts as missing when a stock map says 0",
    file: `${C}/dexActionSummary.ts`,
    edits: [
      [
        "if (!owned.has(id)) allOwned = false;",
        "if (!owned.has(id) || ((entitlement as unknown as { inventory?: Record<string, number> }).inventory?.[id] ?? 1) < 1) allOwned = false;",
      ],
    ],
  },
  {
    id: "M7",
    what: "Dinner seed: resolve dinnerTargetRecipeIds to their ingredients and pin them",
    file: `${C}/workingSet.ts`,
    edits: [
      ['import type { DisclosedHints } from "./hintDisclosure";', 'import type { DisclosedHints } from "./hintDisclosure";\nimport { getRecipe } from "../../data/recipes";'],
      [
        "pinned: cleanIds(pinnedIds).filter(inCategory),",
        "pinned: cleanIds([...pinnedIds, ...(((input as unknown as { dinnerTargetRecipeIds?: string[] }).dinnerTargetRecipeIds) ?? []).flatMap((r) => getRecipe(r as never)?.requiredIngredients.map((x) => x.ingredientId) ?? [])]).filter(inCategory),",
      ],
    ],
  },
  {
    id: "M8",
    what: "unstable order: fill follows input order instead of catalog order",
    file: `${C}/workingSet.ts`,
    edits: [[".filter((item) => inCategory(item.id)).sort(compareCatalogOrder);", ".filter((item) => inCategory(item.id));"]],
  },
  {
    id: "M9",
    what: "priority swap: hint above pinned",
    file: `${C}/workingSet.ts`,
    edits: [['  "pinned",\n  "hint",', '  "hint",\n  "pinned",']],
  },
  {
    id: "M10",
    what: "capacity off-by-one (activation)",
    file: `${C}/workingSet.ts`,
    edits: [["if (ownedInCategory.length <= capacity) {", "if (ownedInCategory.length < capacity) {"]],
  },
  {
    id: "M10b",
    what: "capacity off-by-one (item count)",
    file: `${C}/workingSet.ts`,
    edits: [["if (items.length < capacity) items.push", "if (items.length <= capacity) items.push"]],
  },
  {
    id: "M11",
    what: "zero stock allowed in automatic fill (LC-OD-17)",
    file: `${C}/workingSet.ts`,
    edits: [["fill: ownedInCategory.map((item) => item.id).filter(stocked),", "fill: ownedInCategory.map((item) => item.id),"]],
  },
  {
    id: "M12",
    what: "inactive divergence: small catalogs drop zero-stock rows (differs from today's tray)",
    file: `${C}/workingSet.ts`,
    edits: [
      [
        "return { active: false, items: ownedInCategory.map(",
        "return { active: false, items: ownedInCategory.filter((item) => hasStock(ownership.stock(item.id))).map(",
      ],
    ],
  },
  {
    id: "M13",
    what: "locked leak: the query stops filtering by ownership",
    file: `${C}/catalogQuery.ts`,
    edits: [["filter((item) => owned.has(item.id)).sort(compareCatalogOrder);", "sort(compareCatalogOrder); void owned;"]],
  },
  {
    id: "M14",
    what: "prototype leak: the usage sanitizer reads inherited lists",
    file: `${C}/usageSignals.ts`,
    edits: [["typeof raw === \"object\" && Object.hasOwn(raw, key)", "typeof raw === \"object\" && key in raw"]],
  },
  {
    id: "M15",
    what: "wiring leak: a production module (GameScreen) starts importing the unwired catalog",
    file: "src/screens/GameScreen.tsx",
    edits: [['import { MissionHud } from "../components/MissionHud";', 'import { MissionHud } from "../components/MissionHud";\nimport "../logic/catalog/workingSet";']],
  },
  {
    id: "M16",
    what: "DH4 leak: a catalog module imports the (unwired) DH4-1 taxonomy",
    file: `${C}/hintDisclosure.ts`,
    edits: [['import type { HintSheetView } from "../../state/discoveryHint";', 'import type { HintSheetView } from "../../state/discoveryHint";\nimport { ATTRIBUTE_FAMILIES } from "../../data/ingredientTaxonomy";\nvoid ATTRIBUTE_FAMILIES;']],
  },
  {
    id: "M17",
    what: "Hint 5 leak: a catalog module imports the Hint 5.0 display tables",
    file: `${C}/hintDisclosure.ts`,
    edits: [['import type { HintSheetView } from "../../state/discoveryHint";', 'import type { HintSheetView } from "../../state/discoveryHint";\nimport { HINT_CLASS_DISPLAY } from "../../data/hintClassDisplay";\nvoid HINT_CLASS_DISPLAY;']],
  },
  {
    id: "M18",
    what: "counts before Phase 5: a family / shelf counts function reappears in the query module",
    file: `${C}/catalogQuery.ts`,
    edits: [["export function ownedCatalog(", "export function familyCounts(): number { return 0; }\nexport function ownedCatalog("]],
  },
  {
    id: "M19",
    what: "shelf filter ignored",
    file: `${C}/catalogQuery.ts`,
    edits: [["(shelves === null || (item.shelf !== null && shelves.has(item.shelf))) &&", "true &&"]],
  },
  {
    id: "M20",
    what: "fail-open: an unclassified (null shelf) row matches every shelf filter",
    file: `${C}/catalogQuery.ts`,
    edits: [["(shelves === null || (item.shelf !== null && shelves.has(item.shelf))) &&", "(shelves === null || item.shelf === null || shelves.has(item.shelf)) &&"]],
  },
  {
    id: "M21",
    what: "shelf filter narrows to the first shelf only (multi-shelf broken)",
    file: `${C}/catalogQuery.ts`,
    edits: [["new Set<string>(query.shelves)", "new Set<string>(query.shelves.slice(0, 1))"]],
  },
  {
    id: "M22",
    what: "second membership authority: catalogSource infers the shelf from the category instead of ingredientShelf()",
    file: `${C}/catalogSource.ts`,
    edits: [["shelf: ingredientShelf(ingredient.id),", 'shelf: ingredient.category === "topping" ? "other" : ingredient.category,']],
  },
  {
    id: "M23",
    what: "second filter authority: the query calls filterByShelf",
    file: `${C}/catalogQuery.ts`,
    edits: [["export function ownedCatalog(", 'import { filterByShelf } from "../../data/ingredientShelf";\nvoid filterByShelf;\nexport function ownedCatalog(']],
  },
  {
    id: "M24",
    what: "shelf filter bypasses ownership (locked rows leak under a shelf)",
    file: `${C}/catalogQuery.ts`,
    edits: [["(shelves === null || (item.shelf !== null && shelves.has(item.shelf))) &&", "(shelves === null || (item.shelf !== null && shelves.has(item.shelf)) || false) &&"], ["filter((item) => owned.has(item.id)).sort(compareCatalogOrder);", "sort(compareCatalogOrder); void owned;"]],
  },
  {
    id: "M25",
    what: "hand reads the shelf: the working set fill starts depending on `shelf`",
    file: `${C}/workingSet.ts`,
    edits: [["fill: ownedInCategory.map((item) => item.id).filter(stocked),", "fill: ownedInCategory.filter((item) => item.shelf !== null).map((item) => item.id).filter(stocked),"]],
  },
  {
    id: "M26",
    what: "FREE gate uses the tray's recipe-free notion: Dinner becomes eligible",
    file: `${C}/freeEligibility.ts`,
    edits: [["return isFreeCookingRound(round) && round.dinner === null;", "return isFreeCookingRound(round) || round.dinner !== null;"]],
  },
  {
    id: "M27",
    what: "FREE gate ignores `dinner === null` (a FREE-kind round with a Dinner session is eligible)",
    file: `${C}/freeEligibility.ts`,
    edits: [["return isFreeCookingRound(round) && round.dinner === null;", "return isFreeCookingRound(round);"]],
  },
  {
    id: "M28",
    what: "capacity enforcement switched on (would hide owned ingredients before the pantry exists)",
    file: `${C}/handPolicy.ts`,
    edits: [["export const HAND_ENFORCEMENT_ENABLED = false;", "export const HAND_ENFORCEMENT_ENABLED = true;"]],
  },
  {
    id: "M29",
    what: "resolveHand ignores eligibility (Dinner / guided get a hand)",
    file: `${C}/handSession.ts`,
    edits: [["if (!isLargeCatalogEligible(input.round)) return null;", "void isLargeCatalogEligible;"]],
  },
  {
    id: "M30",
    what: "hand accepts unowned ingredients",
    file: `${C}/handSession.ts`,
    edits: [["byId.get(id)?.category === ctx.category && owned.has(id)", "byId.get(id)?.category === ctx.category || owned.has(id)"]],
  },
  {
    id: "M31",
    what: "selection rule never clears (#197 broken)",
    file: `${C}/handSession.ts`,
    edits: [["return visibleBefore.includes(selectedIngredientId) && !visibleAfter.includes(selectedIngredientId)\n    ? null\n    : selectedIngredientId;", "return selectedIngredientId;"]],
  },
  {
    id: "M32",
    what: "hand add drops the existing order (re-sorts)",
    file: `${C}/handSession.ts`,
    edits: [["return withCategory(session, ctx.category, [...current, ...add]);", "return withCategory(session, ctx.category, [...current, ...add].sort());"]],
  },
  {
    id: "M33",
    what: "pantry entry for Dinner (the tray's recipe-free notion leaks into the gate)",
    file: "src/screens/GameScreen.tsx",
    edits: [["const largeCatalogEligible = isLargeCatalogEligible(state);", "const largeCatalogEligible = isLargeCatalogEligible(state) || state.dinner !== null;"]],
  },
  {
    id: "M34",
    what: "pantry lists every ingredient (LOCKED / unowned rows appear)",
    file: "src/components/IngredientPantry.tsx",
    edits: [["ownedIds: ownedIngredientIds,", "ownedIds: catalog.map((item) => item.id),"]],
  },
  {
    id: "M35",
    what: "closing the pantry does not return focus to the entry",
    file: "src/screens/GameScreen.tsx",
    edits: [["if (wasPantryVisibleRef.current && !pantryVisible) pantryEntryRef.current?.focus();", "if (wasPantryVisibleRef.current && !pantryVisible) void 0;"]],
  },
  {
    id: "M36",
    what: "cooking input keeps running while the pantry is open",
    file: "src/screens/GameScreen.tsx",
    edits: [["const cookingInputPaused = isGlobalOverlayOpen || pantryVisible;", "const cookingInputPaused = isGlobalOverlayOpen;"]],
  },
  {
    id: "M37",
    what: "focus does not enter the sheet on open",
    file: "src/components/IngredientPantry.tsx",
    edits: [["    closeRef.current?.focus();\n", "    void closeRef.current;\n"]],
  },
  {
    id: "M38",
    what: "Escape no longer closes the sheet",
    file: "src/components/IngredientPantry.tsx",
    edits: [['if (event.key === "Escape") {', 'if (event.key === "Escape" && false) {']],
  },
  {
    id: "M39",
    what: "scope creep: the pantry starts importing the working set (hand wired before R4/R5)",
    file: "src/components/IngredientPantry.tsx",
    edits: [['import { emptyUsageSession } from "../logic/catalog/usageSignals";', 'import { emptyUsageSession } from "../logic/catalog/usageSignals";\nimport "../logic/catalog/workingSet";']],
  },
  {
    id: "M40",
    what: "chips from every shelf instead of the OWNED rows (an absent shelf gets a chip)",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["INGREDIENT_SHELF_ORDER.filter((id) => represented.has(id))", "INGREDIENT_SHELF_ORDER.filter(() => true)"],
    ],
  },
  {
    id: "M41",
    what: "chip row shown for a single shelf (threshold 2 -> 1)",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["presentShelves.length >= 2", "presentShelves.length >= 1"],
    ],
  },
  {
    id: "M42",
    what: "unclassified (shelf null) rows leak into a specific shelf",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["itemsFor([shelfFilter])", "[...itemsFor([shelfFilter]), ...allItems.filter((i) => i.shelf === null)]"],
    ],
  },
  {
    id: "M43",
    what: "filter change no longer resets the list scrollTop",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["if (listRef.current) listRef.current.scrollTop = 0;", "void listRef.current;"],
    ],
  },
  {
    id: "M44",
    what: "the shelf filter survives close / reopen (module-level persistence)",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["export function IngredientPantry(", "let persistedShelf: ShelfFilter = \"all\";\nexport function IngredientPantry("],
      ["useState<ShelfFilter>(\"all\");", "useState<ShelfFilter>(persistedShelf);"],
      ["    setActiveShelf(next);", "    persistedShelf = next;\n    setActiveShelf(next);"],
    ],
  },
  {
    id: "M45",
    what: "chip row moved inside the scrolling list (not a fixed slot)",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["{showChips && (\n          <div className=\"pantry-sheet__shelves\">", "{false && (\n          <div className=\"pantry-sheet__shelves\">"],
      ["aria-label=\"所持している材料\" tabIndex={0}>", "aria-label=\"所持している材料\" tabIndex={0}>\n          {showChips && <ShelfChips shelves={presentShelves} active={shelfFilter} onChange={handleShelfChange} ariaLabel=\"材料の分類\" />}"],
    ],
  },
  {
    id: "M46",
    what: "scope creep: the pantry wires the #197 selection rule (R5+, not R4)",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["import { ShelfChips } from \"./ShelfChips\";", "import { ShelfChips } from \"./ShelfChips\";\nimport { selectionAfterVisibleChange } from \"../logic/catalog/handSession\";\nvoid selectionAfterVisibleChange;"],
    ],
  },
  {
    id: "M47",
    what: "the pantry lists rows of every category (cross-category pantry)",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      [".filter((item) => item.category === category);", ".filter(() => true);"],
    ],
  },
  {
    id: "M48",
    what: "a count leaks into the subtitle",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["{CATEGORY_LABEL[category]}</p>", "{CATEGORY_LABEL[category]} {allItems.length}</p>"],
    ],
  },
  {
    id: "M49",
    what: "a stored shelf that is no longer represented is not reset to すべて",
    file: "src/components/IngredientPantry.tsx",
    edits: [
      ["presentShelves.includes(activeShelf) ? activeShelf : \"all\"", "true ? activeShelf : \"all\""],
    ],
  },
  {
    id: "M50",
    what: "the entry gate stops requiring pantryWorthwhile (entry offered whenever the screen is eligible)",
    file: "src/screens/GameScreen.tsx",
    edits: [['state.makingStep !== "DOUGH" && dockReserve.pantryWorthwhile;', 'state.makingStep !== "DOUGH";']],
  },
  {
    id: "M51",
    what: "R5-a: the entry gate goes back to the pager (dockReserve.pager)",
    file: "src/screens/GameScreen.tsx",
    edits: [['state.makingStep !== "DOUGH" && dockReserve.pantryWorthwhile;', 'state.makingStep !== "DOUGH" && dockReserve.pager;']],
  },
  {
    id: "M52",
    what: "R5-a: pantryWorthwhile is derived from the pager / tray page count",
    file: "src/logic/prepareDock.ts",
    edits: [["reserve.pantryWorthwhile = isPantryWorthwhile({", "reserve.pantryWorthwhile = reserve.pager || isPantryWorthwhile({"], ["ownedIngredientIds: trayOptions.ownedIngredientIds,\n  });", "ownedIngredientIds: trayOptions.ownedIngredientIds.slice(0, 0),\n  });"]],
  },
  {
    id: "M53",
    what: "R5-a: utilityRow loses its eligible guard (guided / Lunch Rush gain a row)",
    file: `${C}/pantryAvailability.ts`,
    edits: [["input.largeCatalogEligible && input.pantryWorthwhile", "input.pantryWorthwhile"]],
  },
  {
    id: "M54",
    what: "R5-a: worthwhile threshold >= 6 instead of > 6",
    file: `${C}/pantryAvailability.ts`,
    edits: [[".length > MAX_INGREDIENT_PALETTE_SLOTS,", ".length >= MAX_INGREDIENT_PALETTE_SLOTS,"]],
  },
  {
    id: "M55",
    what: "R5-a: pantryAvailability starts reading inventory (stock)",
    file: `${C}/pantryAvailability.ts`,
    edits: [['import { ingredientsByCategory,', 'import { remainingStock } from "../../state/inventory";\nvoid remainingStock;\nimport { ingredientsByCategory,']],
  },
  {
    id: "M56",
    what: "R5-a: pantryAvailability starts depending on the hand session (pins)",
    file: `${C}/pantryAvailability.ts`,
    edits: [['import { ingredientsByCategory,', 'import "./handSession";\nimport { ingredientsByCategory,']],
  },
  {
    id: "M57",
    what: "R5-a: utilityRow ignores the pager (only eligible && worthwhile)",
    file: `${C}/pantryAvailability.ts`,
    edits: [["return input.pager || (input.largeCatalogEligible && input.pantryWorthwhile);", "return input.largeCatalogEligible && input.pantryWorthwhile;"]],
  },
  {
    id: "M58",
    what: "R5-a: the tray's reserved pager row is driven by pantryWorthwhile instead of utilityRow",
    file: "src/screens/GameScreen.tsx",
    edits: [["reservePagerRow={dockReserve.utilityRow}", "reservePagerRow={dockReserve.pantryWorthwhile}"]],
  },
  {
    id: "M58b",
    what: "R5-a: the dock's no-pager class goes back to the pager",
    file: "src/screens/GameScreen.tsx",
    edits: [['dockReserve.utilityRow ? "" : " prepare-dock--no-pager"', 'dockReserve.pager ? "" : " prepare-dock--no-pager"']],
  },
  {
    id: "M58c",
    what: "R5-a: eligibility is read from freeCook / the recipe-free tray instead of the FREE gate (Dinner leaks)",
    file: "src/screens/GameScreen.tsx",
    edits: [["const largeCatalogEligible = isLargeCatalogEligible(state);", "const largeCatalogEligible = recipeFreeTray;"]],
  },
  {
    id: "M59",
    what: "R5-a: pantryAvailability imports recipes",
    file: `${C}/pantryAvailability.ts`,
    edits: [['import { ingredientsByCategory,', 'import { RECIPES } from "../../data/recipes";\nvoid RECIPES;\nimport { ingredientsByCategory,']],
  },
];

function runSuite() {
  // The catalog suite plus DH4-1's own unwired guard (M16 must trip it too).
  const r = spawnSync("npx", ["vitest", "run", C, "src/logic/discovery/deductionHint.test.ts", "src/screens/GameScreen.pantryShell.test.tsx", "src/components/IngredientPantry.shelves.test.tsx", "src/components/IngredientTray.pantryEntryRow.test.tsx", "src/logic/prepareDock.test.ts", "--reporter=dot"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return r.status === 0;
}

const only = new Set(process.argv.slice(2));
const selected = MUTANTS.filter((m) => only.size === 0 || only.has(m.id));

if (!runSuite()) {
  console.error("baseline suite fails -- fix it before running mutants");
  process.exit(2);
}

const results = [];
for (const m of selected) {
  const path = join(ROOT, m.file);
  const original = readFileSync(path, "utf8");
  let mutated = original;
  let applicable = true;
  for (const [from, to] of m.edits) {
    if (!mutated.includes(from)) applicable = false;
    mutated = mutated.replace(from, to);
  }
  if (!applicable) {
    results.push({ id: m.id, status: "NOT_APPLICABLE", what: m.what });
    continue;
  }
  try {
    writeFileSync(path, mutated);
    const passed = runSuite();
    results.push({ id: m.id, status: passed ? "SURVIVED" : "KILLED", what: m.what });
  } finally {
    writeFileSync(path, original);
  }
}

for (const r of results) console.log(`${r.status.padEnd(15)} ${r.id.padEnd(5)} ${r.what}`);
const bad = results.filter((r) => r.status !== "KILLED");
console.log(`\n${results.length - bad.length}/${results.length} killed`);
process.exit(bad.length === 0 ? 0 : 1);
