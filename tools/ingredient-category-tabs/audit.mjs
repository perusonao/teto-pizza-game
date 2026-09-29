#!/usr/bin/env node
/**
 * Ingredient Category Tabs 1.0 — Phase 0 Fresh Audit generator (docs/data/tools only).
 * Loads the REAL production modules through Vite's SSR loader (no re-implementation) and prints a
 * deterministic JSON snapshot: ingredient x taxonomy x three-screen membership.
 * Usage: node tools/ingredient-category-tabs/audit.mjs [--csv | --check <snapshot.json>]
 * Read-only: touches nothing under src/.
 */
import { createServer } from "vite";
import { readFileSync } from "node:fs";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const ing = await vite.ssrLoadModule("/src/data/ingredients.ts");
  const tax = await vite.ssrLoadModule("/src/data/ingredientTaxonomy.ts");
  const rec = await vite.ssrLoadModule("/src/data/recipes.ts");
  const ent = await vite.ssrLoadModule("/src/state/materialEntitlement.ts");
  const dock = await vite.ssrLoadModule("/src/logic/prepareDock.ts");

  const INGREDIENTS = ing.INGREDIENTS;
  const starters = new Set(ing.STARTER_INGREDIENT_IDS);
  const obtainable = new Set(ent.obtainableIngredientIds());
  const recipeUse = new Map();
  for (const r of rec.RECIPES)
    for (const q of r.requiredIngredients) recipeUse.set(q.ingredientId, (recipeUse.get(q.ingredientId) ?? 0) + 1);

  const rows = INGREDIENTS.map((i) => {
    const family = tax.ingredientAttributeFamily(i.id);
    const finite = !!i.unlockCondition;
    return {
      id: i.id,
      nameJa: i.nameJa,
      category: i.category,
      family, // null = no authority row
      group: tax.ingredientAttributeGroup(i.id),
      starter: starters.has(i.id),
      finite,
      // Proposed single UI shelf (NOT a new taxonomy): topping -> its DH4-1 family; sauce / cheese -> category.
      shelf: i.category === "topping" ? tax.ingredientAttributeFamily(i.id) : i.category,
      // Screen membership as the CURRENT production code defines it (upper bound: nothing hidden by progression):
      screens: {
        builderFreeCook: true, // trayIngredientsFor(freeCook) = every owned ingredient of the step category
        builderGuided: recipeUse.has(i.id), // only recipe.requiredIngredients
        shop: finite && obtainable.has(i.id), // materialShopState NEW/OWNED; starters (no unlockCondition) never sold
        ingredients: true, // InventoryOverlay lists every OWNED ingredient
      },
      recipesUsing: recipeUse.get(i.id) ?? 0,
    };
  });

  const count = (arr, key) => arr.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
  const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const toppings = rows.filter((r) => r.category === "topping");
  const unclassifiedToppings = toppings.filter((r) => !r.family).map((r) => r.id);
  const nonToppingWithFamily = rows.filter((r) => r.category !== "topping" && r.family).map((r) => r.id);
  const dupRows = tax.TAXONOMY_INGREDIENT_IDS.filter((id, n, a) => a.indexOf(id) !== n);
  const orphanTaxonomyIds = tax.TAXONOMY_INGREDIENT_IDS.filter((id) => !INGREDIENTS.some((i) => i.id === id));

  // Free-cook tray = every owned ingredient of the step category (prepareDock.trayIngredientsFor).
  const allOwned = INGREDIENTS.map((i) => i.id);
  const freeTray = Object.fromEntries(
    ["sauce", "cheese", "topping"].map((c) => [
      c,
      dock.trayIngredientsFor(c, { ownedIngredientIds: allOwned, freeCook: true, recipe: rec.RECIPES[0] }).map((i) => i.id),
    ]),
  );
  // Recipe-guided tray = owned && recipe.requiredIngredients.
  const guided = rec.RECIPES.map((r) => ({
    id: r.id,
    topping: dock.trayIngredientsFor("topping", { ownedIngredientIds: allOwned, freeCook: false, recipe: r }).length,
    toppingFamilies: [
      ...new Set(
        dock.trayIngredientsFor("topping", { ownedIngredientIds: allOwned, freeCook: false, recipe: r }).map(
          (i) => tax.ingredientAttributeFamily(i.id),
        ),
      ),
    ].sort(),
  }));
  const familyPop = {};
  for (const f of tax.ATTRIBUTE_FAMILIES)
    familyPop[f.id] = { labelJa: f.labelJa, group: f.group, toppings: toppings.filter((r) => r.family === f.id).map((r) => r.id) };

  const snapshot = {
    schema: "teto.ingredient-category-tabs.audit/1",
    counts: {
      ingredients: rows.length,
      byCategory: sortObj(count(rows, (r) => r.category)),
      toppingsWithFamily: toppings.length - unclassifiedToppings.length,
      toppingsTotal: toppings.length,
      starters: [...starters].sort(),
      shopSellable: rows.filter((r) => r.shopLadderOnly).length,
      recipes: rec.RECIPES.length,
    },
    unclassifiedToppings,
    duplicateTaxonomyRows: dupRows, // a Map would silently keep the last row -> 1 ingredient = 1 shelf must be gated
    screenCoverage: Object.fromEntries(
      ["builderFreeCook", "builderGuided", "shop", "ingredients"].map((k) => {
        const set = rows.filter((r) => r.screens[k]);
        return [
          k,
          {
            size: set.length,
            shelfClassified: set.filter((r) => r.shelf).length,
            unclassified: set.filter((r) => !r.shelf).map((r) => r.id),
            byShelf: sortObj(count(set, (r) => r.shelf ?? "UNCLASSIFIED")),
          },
        ];
      }),
    ),
    nonToppingWithFamily,
    orphanTaxonomyIds,
    familyPopulation: familyPop,
    freeCookTraySizes: Object.fromEntries(Object.entries(freeTray).map(([k, v]) => [k, v.length])),
    freeCookToppingPagesAt6: Math.ceil(freeTray.topping.length / ing.MAX_INGREDIENT_PALETTE_SLOTS),
    guidedToppingTray: {
      max: Math.max(...guided.map((g) => g.topping)),
      distribution: sortObj(count(guided, (g) => String(g.topping))),
      maxDistinctFamilies: Math.max(...guided.map((g) => g.toppingFamilies.length)),
    },
    rows,
  };
  const out = JSON.stringify(snapshot, null, 2) + "\n";
  if (process.argv.includes("--csv")) {
    const head = "id,nameJa,category,family,shelf,starter,finite,builderFreeCook,builderGuided,shop,ingredients,recipesUsing";
    const lines = rows.map((r) =>
      [r.id, r.nameJa, r.category, r.family ?? "", r.shelf ?? "", r.starter, r.finite, r.screens.builderFreeCook, r.screens.builderGuided, r.screens.shop, r.screens.ingredients, r.recipesUsing].join(","),
    );
    process.stdout.write([head, ...lines].join("\n") + "\n");
    process.exit(0);
  }
  const ci = process.argv.indexOf("--check");
  if (ci >= 0) {
    const same = readFileSync(process.argv[ci + 1], "utf8") === out;
    console.log(same ? "OK: snapshot matches" : "DRIFT: snapshot differs");
    process.exitCode = same ? 0 : 1;
  } else process.stdout.write(out);
} finally {
  await vite.close();
}
