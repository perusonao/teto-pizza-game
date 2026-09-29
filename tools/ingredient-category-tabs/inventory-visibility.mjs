#!/usr/bin/env node
/**
 * Ingredient Category Tabs 1.0 Phase 4 Fresh Audit: which shelf chips the Ingredients (Inventory)
 * screen WOULD show, if the chips are derived from the rows the screen already lists.
 * Inventory lists exactly the OWNED ingredients (InventoryOverlay: INGREDIENTS.filter(owned)).
 * Real production modules through Vite SSR; read-only. `--check <file>` reports drift.
 */
import { createServer } from "vite";
import { readFileSync } from "node:fs";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const ing = await vite.ssrLoadModule("/src/data/ingredients.ts");
  const shelf = await vite.ssrLoadModule("/src/data/ingredientShelf.ts");
  const lad = await vite.ssrLoadModule("/src/data/discoveryLadder.ts");
  const dl = await vite.ssrLoadModule("/src/logic/discoveryLadder.ts");
  const steps = lad.DISCOVERY_LADDER.steps;
  const maxStep = Math.max(...steps.map((s) => s.step));
  const starters = [...ing.STARTER_INGREDIENT_IDS];
  const listed = (owned) => ing.INGREDIENTS.filter((i) => owned.includes(i.id)); // the Inventory rows
  const table = [];
  let prev = [];
  for (let n = 0; n <= maxStep; n++) {
    const entitled = dl.materialIdsOfSteps(steps.filter((s) => s.step <= n));
    // Scenario "bought everything entitled" is the largest owned set at Dex n; "starters only" the smallest.
    const rowsAll = listed([...starters, ...entitled]);
    const shelves = shelf.shelvesPresent(rowsAll);
    table.push({
      discovered: n,
      rowsIfAllBought: rowsAll.length,
      shelvesIfAllBought: shelves,
      newShelvesThisStep: shelves.filter((s) => !prev.includes(s)),
    });
    prev = shelves;
  }
  const startersRows = listed(starters);
  const snapshot = {
    schema: "teto.ingredient-category-tabs.inventory-visibility/1",
    listedSet: "OWNED only (InventoryOverlay); starters are always owned",
    startersOnly: { rows: startersRows.length, shelves: shelf.shelvesPresent(startersRows) },
    // Unowned entitled materials (Shop NEW rows) never create a chip: entitled-but-not-bought adds nothing.
    entitledButNotBoughtAddsChip: false,
    unclassifiedOwnedIds: startersRows.concat(listed(ing.INGREDIENTS.map((i) => i.id))).filter((i) => !shelf.ingredientShelf(i.id)).map((i) => i.id),
    fullyVisibleAtDiscovered: table.find((t) => t.shelvesIfAllBought.length === shelf.INGREDIENT_SHELF_ORDER.length)?.discovered ?? null,
    table,
  };
  const out = JSON.stringify(snapshot, null, 2) + "\n";
  const ci = process.argv.indexOf("--check");
  if (ci >= 0) {
    const same = readFileSync(process.argv[ci + 1], "utf8") === out;
    console.log(same ? "OK: snapshot matches" : "DRIFT: snapshot differs");
    process.exitCode = same ? 0 : 1;
  } else process.stdout.write(out);
} finally {
  await vite.close();
}
