#!/usr/bin/env node
/**
 * Ingredient Category Tabs 1.0 Phase 3 Fresh Audit: which shelf chips the Shop WOULD show at each
 * Dex discovered count, if the visible set is derived from the rows the Shop already lists
 * (NEW/OWNED; LOCKED never). Real production modules through Vite SSR; read-only.
 * Usage: node tools/ingredient-category-tabs/shop-visibility.mjs [--check <file>]
 */
import { createServer } from "vite";
import { readFileSync } from "node:fs";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const ing = await vite.ssrLoadModule("/src/data/ingredients.ts");
  const shelf = await vite.ssrLoadModule("/src/data/ingredientShelf.ts");
  const lad = await vite.ssrLoadModule("/src/data/discoveryLadder.ts");
  const dl = await vite.ssrLoadModule("/src/logic/discoveryLadder.ts");
  const shop = await vite.ssrLoadModule("/src/logic/materialShop.ts");

  const steps = lad.DISCOVERY_LADDER.steps;
  const maxStep = Math.max(...steps.map((s) => s.step));
  const starters = [...ing.STARTER_INGREDIENT_IDS];
  // Nothing bought yet: every entitled material is a NEW row (the smallest listed set at that step).
  const rowsAt = (n) => {
    const unlocked = dl.materialIdsOfSteps(steps.filter((s) => s.step <= n));
    return ing.INGREDIENTS.filter((i) => {
      const st = shop.materialShopState(i, starters, unlocked);
      return st === "NEW" || st === "OWNED";
    });
  };
  const table = [];
  let prevRows = [];
  let prevShelves = [];
  for (let n = 0; n <= maxStep; n++) {
    const rows = rowsAt(n);
    const shelves = shelf.shelvesPresent(rows);
    table.push({
      discovered: n,
      rows: rows.length,
      shelves,
      newShelvesThisStep: shelves.filter((s) => !prevShelves.includes(s)),
      newRowIds: rows.filter((r) => !prevRows.some((p) => p.id === r.id)).map((r) => r.id),
    });
    prevRows = rows;
    prevShelves = shelves;
  }
  const snapshot = {
    schema: "teto.ingredient-category-tabs.shop-visibility/1",
    maxLadderStep: maxStep,
    // A shelf chip appears in the same step as the first Shop row of that shelf; never earlier.
    chipNeverBeforeRow: table.every((t) =>
      t.newShelvesThisStep.every((s) => t.newRowIds.some((id) => shelf.ingredientShelf(id) === s)),
    ),
    fullyVisibleAtDiscovered: table.find((t) => t.shelves.length === shelf.INGREDIENT_SHELF_ORDER.length)?.discovered ?? null,
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
