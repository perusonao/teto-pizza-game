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
 * taxonomy-mapping mutants (M4, M5: that authority is not migrated) and adds M5r, M17, M18; LC-R1 adds M19-M25 (shelf authority); LC-R2 adds M26-M32 (FREE gate, capacity guard, hand operations); LC-R3 adds M33-M39 (pantry shell); LC-R4 adds M40-M50 (shelf filtering in the pantry); LC-R5-a adds M51-M59; LC-R5-b adds M60-M82 (search, approved aliases, IME contract, Mode C keyboard fit) (+ M58b, M58c) and re-targets M50 (pantry availability split from the pager); LC-R5-c adds M83-M97 (dormant pin foundation: pin edit rules, App-level session pins, #197 no-clear, dormancy, 方式 D); LC-R5-d adds M98-M114 (dormant tray hand: catalog order, page-level #197, page 0, dormancy, FREE-only, placed protection, Model C pin fit, privacy). The "answer
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
    // LC-R5-e-h (H-8): re-targeted at the R5-d line (placed ingredients are never dropped for capacity). The pre-R5-d
    // edit `if (items.length < capacity) items.push` no longer existed, so this mutant was NOT_APPLICABLE since R5-d.
    what: "capacity off-by-one (item count, current R5-d line)",
    file: `${C}/workingSet.ts`,
    edits: [['if (source === "placed" || items.length < capacity) items.push', 'if (source === "placed" || items.length <= capacity) items.push']],
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
      ["toRows(itemsFor(shelfFilter === \"all\" ? undefined : [shelfFilter], appliedText))", "toRows(shelfFilter === \"all\" ? itemsFor(undefined, appliedText) : [...itemsFor([shelfFilter], appliedText), ...allItems.filter((i) => i.shelf === null)])"],
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
  {
    id: "M60",
    what: "R5-b: the alias check is dropped from matchesSearch",
    file: `${C}/catalogText.ts`,
    edits: [["    (item.searchAliasesJa ?? []).some((alias) => normalizeForSearch(alias).includes(q))", "    false"]],
  },
  {
    id: "M61",
    what: "R5-b: an unapproved alias is added to the table (ペペロニ)",
    file: "src/data/ingredientSearchAliases.ts",
    edits: [["  egg: [", "  pepperoni: [{ alias: \"ペペロニ\", provenance: \"owner-approved\" }],\n  egg: ["]],
  },
  {
    id: "M62",
    what: "R5-b: the runtime catalog stops carrying the aliases",
    file: `${C}/catalogSource.ts`,
    edits: [["...(aliases.length > 0 ? { searchAliasesJa: aliases } : {}),", ""]],
  },
  {
    id: "M63",
    what: "R5-b: a reverse (query-contains-name) match is added",
    file: `${C}/catalogText.ts`,
    edits: [["    normalizeForSearch(item.nameJa).includes(q) ||", "    normalizeForSearch(item.nameJa).includes(q) || q.includes(normalizeForSearch(item.nameJa)) ||"]],
  },
  {
    id: "M64",
    what: "R5-b: the chip row / visibility are derived AFTER the text (allItems gets the applied text)",
    file: "src/components/IngredientPantry.tsx",
    edits: [["  const allItems = itemsFor();", "  const allItems = itemsFor(undefined, search.applied);"]],
  },
  {
    id: "M65",
    what: "R5-b: the search field disappears when the result is short (visibility follows the text)",
    file: "src/components/IngredientPantry.tsx",
    edits: [["const showSearch = allItems.length > MAX_INGREDIENT_PALETTE_SLOTS;", "const showSearch = itemsFor(undefined, search.applied).length > MAX_INGREDIENT_PALETTE_SLOTS;"]],
  },
  {
    id: "M66",
    what: "R5-b: the search threshold is off by one (>= 6)",
    file: "src/components/IngredientPantry.tsx",
    edits: [["const showSearch = allItems.length > MAX_INGREDIENT_PALETTE_SLOTS;", "const showSearch = allItems.length >= MAX_INGREDIENT_PALETTE_SLOTS;"]],
  },
  {
    id: "M67",
    what: "R5-b: opening auto-focuses the search field",
    file: "src/components/IngredientPantry.tsx",
    edits: [["    closeRef.current?.focus();\n  }, []);", "    (inputRef.current ?? closeRef.current)?.focus();\n  }, []);"]],
  },
  {
    id: "M68",
    what: "R5-b IME: a composition applies to the list (no freeze)",
    file: "src/components/pantrySearchIme.ts",
    edits: [["  return composing ? { ...state, value } : { value, applied: value, composing: false };", "  return { value, applied: value, composing };"]],
  },
  {
    id: "M69",
    what: "R5-b IME: compositionend does not apply the confirmed text",
    file: "src/components/pantrySearchIme.ts",
    edits: [["  return { value, applied: value, composing: false };\n}\n\n/** A blur", "  return { value, applied: _state.applied, composing: false };\n}\n\n/** A blur"]],
  },
  {
    id: "M70",
    what: "R5-b IME: a blur does not settle an interrupted composition",
    file: "src/components/pantrySearchIme.ts",
    edits: [["  return state.composing ? { value: state.value, applied: state.value, composing: false } : state;", "  return state;"]],
  },
  {
    id: "M71",
    what: "R5-b IME: keyCode 229 is no longer a confirming Enter",
    file: "src/components/pantrySearchIme.ts",
    edits: [["    input.keyCode === 229 ||\n", ""]],
  },
  {
    id: "M72",
    what: "R5-b: a plain Enter no longer moves focus to the list",
    file: "src/components/IngredientPantry.tsx",
    edits: [["    listRef.current?.focus();\n  }\n", "  }\n"]],
  },
  {
    id: "M73",
    what: "R5-b: the search input drops below 16px (iOS zoom)",
    file: "src/App.css",
    edits: [["  padding: 0 12px;\n  font-size: 16px;\n  color: #4a2e0a;\n  background: #fffdf7;\n  -webkit-appearance", "  padding: 0 12px;\n  font-size: 14px;\n  color: #4a2e0a;\n  background: #fffdf7;\n  -webkit-appearance"]],
  },
  {
    id: "M74",
    what: "R5-b fit: fits even with no keyboard and no focus",
    file: "src/components/pantryViewportFit.ts",
    edits: [["  if (!fieldFocused && !keyboardLike) return null;\n", ""]],
  },
  {
    id: "M75",
    what: "R5-b fit: a blur releases the fit while the keyboard is still up (focus-only rule)",
    file: "src/components/pantryViewportFit.ts",
    edits: [["  const keyboardLike = layoutHeight - vvHeight >= KEYBOARD_LIKE_MIN_SHRINK_PX;", "  const keyboardLike = false;"]],
  },
  {
    id: "M76",
    what: "R5-b fit: the scroll listener is never removed",
    file: "src/components/pantryViewportFit.ts",
    edits: [["      vv.removeEventListener(\"scroll\", schedule);\n", ""]],
  },
  {
    id: "M77",
    what: "R5-b fit: non-finite viewport values are accepted",
    file: "src/components/pantryViewportFit.ts",
    edits: [["  if (![layoutHeight, vvHeight, vvOffsetTop].every((n) => typeof n === \"number\" && Number.isFinite(n))) return null;\n", ""]],
  },
  {
    id: "M78",
    what: "R5-b fit: a negative bottom is not clamped",
    file: "src/components/pantryViewportFit.ts",
    edits: [["bottom: Math.max(0, layoutHeight - (vvOffsetTop + vvHeight))", "bottom: layoutHeight - (vvOffsetTop + vvHeight)"]],
  },
  {
    id: "M79",
    what: "R5-b: the pantry reads visualViewport itself (fit outside its module)",
    file: "src/components/IngredientPantry.tsx",
    edits: [["export function IngredientPantry(", "void (typeof window !== \"undefined\" && window.visualViewport);\nexport function IngredientPantry("]],
  },
  {
    id: "M80",
    what: "R5-b: the pantry persists the search text",
    file: "src/components/IngredientPantry.tsx",
    edits: [["  const [fieldFocused, setFieldFocused] = useState(false);", "  const [fieldFocused, setFieldFocused] = useState(false);\n  useEffect(() => localStorage.setItem(\"pantry-search\", \"x\"), []);"]],
  },
  {
    id: "M81",
    what: "R5-b: a new applied text no longer resets the list to the top",
    file: "src/components/IngredientPantry.tsx",
    edits: [["previousAppliedRef.current !== appliedText &&", "false &&"]],
  },
  {
    id: "M82",
    what: "R5-b: the empty state names a count / an unowned reason",
    file: "src/components/IngredientPantry.tsx",
    edits: [["\"該当する材料がありません\"", "\"該当する材料が0件です\""]],
  },
  {
    id: "M83",
    what: "R5-c: a no-stock ingredient can be newly pinned (OD-R5-6)",
    file: `${C}/pinEdit.ts`,
    edits: [["if (!hasStock(ctx.ownership.stock(id))) return", "if (false) return"]],
  },
  {
    id: "M84",
    what: "R5-c: an unowned / other-category id is reported as pinned",
    file: `${C}/pinEdit.ts`,
    edits: [["return ctx.ownership.ownedIds.includes(id) &&", "return true ||"]],
  },
  {
    id: "M85",
    what: "R5-c: a second tap no longer unpins",
    file: `${C}/pinEdit.ts`,
    edits: [["replaceHand(session, pins.filter((pin) => pin !== id), ctx)", "replaceHand(session, pins, ctx)"]],
  },
  {
    id: "M86",
    what: "R5-c: おまかせに戻す clears every category, not only the active one",
    file: `${C}/pinEdit.ts`,
    edits: [["  return replaceHand(session, [], ctx);", "  return { sauce: [], cheese: [], topping: [] };"]],
  },
  {
    id: "M87",
    what: "R5-c: invalid stored pins are shown (no prune on read)",
    file: `${C}/pinEdit.ts`,
    edits: [["return [...pruneHand(session, ctx)[ctx.category]];", "return [...session[ctx.category]];"]],
  },
  {
    id: "M88",
    what: "R5-c: an existing no-stock pin can no longer be removed (tile disabled)",
    file: `${C}/pinEdit.ts`,
    edits: [["disabled: !pinned && !hasStock(stock)", "disabled: !hasStock(stock)"]],
  },
  {
    id: "M89",
    what: "R5-c: the strip renders without pin editing (dormancy broken)",
    file: `${C}/pinEdit.ts`,
    edits: [["return input.handEditing && input.pinCount > 0;", "return input.pinCount > 0;"]],
  },
  {
    id: "M90",
    what: "R5-c: GameScreen turns pin editing on in production",
    file: "src/screens/GameScreen.tsx",
    edits: [["handEditing={HAND_ENFORCEMENT_ENABLED}", "handEditing={true}"]],
  },
  {
    id: "M91",
    what: "R5-c: the pantry defaults to pin editing on",
    file: "src/components/IngredientPantry.tsx",
    edits: [["  handEditing = false,", "  handEditing = true,"]],
  },
  {
    id: "M92",
    what: "R5-c: App clears the pins on a new round (OD-R5-9)",
    file: "src/App.tsx",
    edits: [["    setSelectedIngredientId(null);\n    // A leftover-open", "    setSelectedIngredientId(null);\n    setHandSession(emptyHandSession());\n    // A leftover-open"]],
  },
  {
    id: "M93",
    what: "R5-c: a pin edit clears the Builder selection (#197 no-clear)",
    file: "src/App.tsx",
    edits: [["onHandSessionChange={setHandSession}", "onHandSessionChange={(u) => { setHandSession(u); setSelectedIngredientId(null); }}"]],
  },
  {
    id: "M94",
    what: "R5-c: GameScreen does not relay the App pins (they would reset per pantry)",
    file: "src/screens/GameScreen.tsx",
    edits: [["pinSession={handSession}", "pinSession={undefined}"]],
  },
  {
    id: "M95",
    what: "R5-c: 方式 D broken -- the strip stays while the sheet is keyboard-fitted",
    file: "src/App.css",
    edits: [[".pantry-sheet.pantry-sheet--fit .pantry-sheet__pins {\n  display: none;", ".pantry-sheet.pantry-sheet--fit .pantry-sheet__pins {\n  display: flex;"]],
  },
  {
    id: "M96",
    what: "R5-c: the strip shows a pin count (OD-R5-7 / privacy)",
    file: "src/components/IngredientPantry.tsx",
    edits: [['{"\\u{1F4CC}"} 選択中\n', '{"\\u{1F4CC}"} 選択中 {pins.length}\n']],
  },
  {
    id: "M97",
    what: "R5-c: pins are written to browser storage",
    file: "src/components/IngredientPantry.tsx",
    edits: [["    if (handEditing) onPinSessionChange?.(update);", "    if (handEditing) onPinSessionChange?.(update);\n    localStorage.setItem(\"pins\", \"x\");"]],
  },
  {
    id: "M98",
    what: "R5-d: the tray shows the hand in priority order, not catalog order (F-1)",
    file: `${C}/handTray.ts`,
    edits: [["    .sort(compareCatalogOrder)\n    .map((item) => item.id);", "    .map((item) => item.id);"]],
  },
  {
    id: "M99",
    what: "R5-d: #197 judged on the whole hand instead of the new page 0",
    file: `${C}/handTray.ts`,
    edits: [["trayPageIds(after, 0).includes(selectedIngredientId)", "after.includes(selectedIngredientId)"]],
  },
  {
    id: "M100",
    what: "R5-d: an actual hand change does not return the tray to page 0",
    file: "src/components/IngredientTray.tsx",
    edits: [["if (handKey !== null && prevHandKey !== null) setPage(0);", "void 0;"]],
  },
  {
    id: "M101",
    what: "R5-d: the tray hand is computed with enforcement OFF (dormancy broken)",
    file: `${C}/handTray.ts`,
    edits: [["if (!HAND_ENFORCEMENT_ENABLED || input.category === null) return null;", "if (input.category === null) return null;"]],
  },
  {
    id: "M102",
    what: "R5-d: the hand's stock input is always zero (automatic sources vanish)",
    file: "src/App.tsx",
    edits: [["return ingredient ? remainingStock(ingredient, state.inventory) : 0;", "return ingredient ? remainingStock(ingredient, state.inventory) && 0 : 0;"]],
  },
  {
    id: "M103",
    what: "R5-d: a Dinner / guided / Lunch Rush round is treated as FREE Cooking",
    file: `${C}/handTray.ts`,
    edits: [["    round: input.round,\n", "    round: { roundKind: \"FREE_COOK\", dinner: null },\n"]],
  },
  {
    id: "M104",
    what: "R5-d: opening the pantry clears the Builder selection (#197 P1)",
    file: "src/screens/GameScreen.tsx",
    edits: [["{ onOpen: () => setPantryOpen(true),", "{ onOpen: () => { onClearIngredientSelection?.(); setPantryOpen(true); },"]],
  },
  {
    id: "M105",
    what: "R5-d: a hand change always clears the selection (no page-0 retain)",
    file: "src/App.tsx",
    edits: [["if (next.selectedIngredientId !== selectedIngredientId) setSelectedIngredientId(next.selectedIngredientId);", "if (next.changed) setSelectedIngredientId(null);"]],
  },
  {
    id: "M106",
    what: "R5-d: placed ingredients can be evicted by capacity (OD-R5d-2)",
    file: `${C}/workingSet.ts`,
    edits: [["if (source === \"placed\" || items.length < capacity) items.push", "if (items.length < capacity) items.push"]],
  },
  {
    id: "M107",
    what: "R5-d: a pin is accepted although it would not be on the visible hand (OD-R5d-3)",
    file: `${C}/pinEdit.ts`,
    edits: [["if (fits && !fits(next, id))", "if (false)"]],
  },
  {
    id: "M108",
    what: "R5-d: the capacity candidate is hard-coded to 12",
    file: `${C}/handTray.ts`,
    edits: [["    candidateCapacity: input.candidateCapacity,\n  });", "    candidateCapacity: 12,\n  });"]],
  },
  {
    id: "M109",
    what: "R5-d: a priority-only reorder (same list) counts as a hand change",
    file: `${C}/handTray.ts`,
    edits: [["if (sameIds(before, after)) return", "if (false) return"]],
  },
  {
    id: "M110",
    what: "R5-d: an undisclosed hint fact feeds the tray hand",
    file: `${C}/handSession.ts`,
    edits: [["disclosedHints: NO_DISCLOSED_HINTS,", "disclosedHints: { namedIngredientIds: [\"tuna\"] },"]],
  },
  {
    id: "M111",
    what: "R5-d: the pantry is not given the pin-fit rule (Model C off)",
    file: "src/screens/GameScreen.tsx",
    edits: [["pinFits={trayHand?.pinFits}", "pinFits={undefined}"]],
  },
  {
    id: "M112",
    what: "R5-d: placed ingredients are not passed to the hand (protection lost)",
    file: "src/App.tsx",
    edits: [["placedIds: [...new Set([...state.pizza.sauceIds, ...state.pizza.toppings.map((t) => t.ingredientId)])],", "placedIds: [],"]],
  },
  {
    id: "M113",
    what: "R5-d: the tray keeps its own list when given a hand (hand ignored)",
    file: "src/components/IngredientTray.tsx",
    edits: [["const requiredItems: Ingredient[] = handIds\n", "const requiredItems: Ingredient[] = false\n"]],
  },
  {
    id: "M114",
    what: "R5-d: GameScreen does not relay the hand to the tray",
    file: "src/screens/GameScreen.tsx",
    edits: [["handIds={trayHand?.ids ?? null}", "handIds={null}"]],
  },
];

function runSuite() {
  // The catalog suite plus DH4-1's own unwired guard (M16 must trip it too).
  const r = spawnSync("npx", ["vitest", "run", C, "src/logic/discovery/deductionHint.test.ts", "src/screens/GameScreen.pantryShell.test.tsx", "src/components/IngredientPantry.shelves.test.tsx", "src/components/IngredientPantry.search.test.tsx", "src/components/pantrySearchIme.test.ts", "src/components/pantryViewportFit.test.tsx", "src/data/ingredientSearchAliases.test.ts", "src/components/IngredientTray.pantryEntryRow.test.tsx", "src/logic/prepareDock.test.ts", "src/components/IngredientPantry.pins.test.tsx", "src/App.handPins.handOn.test.tsx", "src/App.handTray.handOn.test.tsx", "src/App.handActivation.handOn.test.tsx", "src/App.handTray.off.test.tsx", "src/App.freeCookTrayPaging.test.tsx", "--reporter=dot"], {
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
