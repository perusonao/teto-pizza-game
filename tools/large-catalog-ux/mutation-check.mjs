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
 * taxonomy-mapping mutants (M4, M5: that authority is not migrated) and adds M5r, M17, M18; LC-R1 adds M19-M25 (shelf authority). The "answer
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
];

function runSuite() {
  // The catalog suite plus DH4-1's own unwired guard (M16 must trip it too).
  const r = spawnSync("npx", ["vitest", "run", C, "src/logic/discovery/deductionHint.test.ts", "--reporter=dot"], {
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
