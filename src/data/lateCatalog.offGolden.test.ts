import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import golden from "./__golden__/lateCatalog.offSurface.json";
import { RECIPE_DISCOVERY_CATALOG, RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { INGREDIENTS } from "./ingredients";
import { LATE_CATALOG_PRODUCTION, LATE_INGREDIENTS, LATE_LADDER_STEPS, LATE_RECIPES, lateCatalogEnabled } from "./lateCatalog";
import { RECIPES } from "./recipes";
import { isLateRecipeId as recipeIsLate } from "../logic/catalog/testSupport/lateIds";

/**
 * FIN-E4 foundation (Owner D-3 = 案 1): the Production (late catalog OFF) catalog is byte-identical to the catalog before the late
 * catalog existed.
 *
 * `__golden__/lateCatalog.offSurface.json` holds SHA-256 digests of the canonical JSON (object keys sorted, array order kept) of the first
 * `count` entries of each catalog surface, generated from `main` 78a4a0f BEFORE the foundation was added and verified equal on the
 * foundation branch. It is a PREFIX digest on purpose: the catalogs are append-only (existing recipes, ingredients and ladder steps never
 * change or reorder), so a later ordinary batch appends beyond `count` and leaves this file alone, while ANY edit, reorder or removal of an
 * existing entry fails here. The tail is covered by the "no late content leaks" test below.
 *
 * The `ingredients` digest was regenerated once, on purpose: arugula gained `pieceVisual: "arugula-leaves"` (Owner-approved drawing change, replaces the 🥗
 * emoji; no id, order, placement or unlock change). Same bytes otherwise.
 * Regenerated a second time for the same reason: `shrimp` gained `pieceVisual: "shrimp-curl"` (Owner-approved peeled-shrimp art replacing the shelled 🦐; no id, order, placement or unlock change).
 */
const canon = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );
const sha256 = (value: unknown): string => createHash("sha256").update(canon(value)).digest("hex");

describe("late catalog OFF == the catalog before FIN-E4 (golden prefix digests)", () => {
  it("E5: Production has the late catalog on; the golden prefix below holds in either state (the OFF build itself is loaded in lateCatalog.ikura.test.ts)", () => {
    expect(LATE_CATALOG_PRODUCTION).toBe(true);
    expect(lateCatalogEnabled()).toBe(true);
  });

  it("recipes: the first N entries are unchanged and in the same order", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(golden.recipes.count);
    expect(sha256(RECIPES.slice(0, golden.recipes.count))).toBe(golden.recipes.sha256);
  });

  it("ingredients: the first N entries are unchanged and in the same order", () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(golden.ingredients.count);
    expect(sha256(INGREDIENTS.slice(0, golden.ingredients.count))).toBe(golden.ingredients.sha256);
  });

  it("ladder: the first N steps (and the population id) are unchanged", () => {
    expect(DISCOVERY_LADDER.steps.length).toBeGreaterThanOrEqual(golden.ladderSteps.count);
    expect(sha256({ populationId: DISCOVERY_LADDER.populationId, steps: DISCOVERY_LADDER.steps.slice(0, golden.ladderSteps.count) })).toBe(
      golden.ladderSteps.sha256,
    );
  });

  it("discovery catalog: the first N targets are unchanged (every ordinary recipe keeps the default identity, no capability)", () => {
    expect(RECIPE_DISCOVERY_CATALOG.length).toBeGreaterThanOrEqual(golden.discoveryTargets.count);
    expect(sha256(RECIPE_DISCOVERY_CATALOG.slice(0, golden.discoveryTargets.count))).toBe(golden.discoveryTargets.sha256);
  });

  it("discovery target ids: the first N recipes keep their ids", () => {
    const ids = RECIPE_DISCOVERY_TARGET_IDS as Readonly<Record<string, string>>;
    const first = RECIPES.slice(0, golden.discoveryTargetIds.count);
    expect(sha256(Object.fromEntries(first.map((r) => [r.id, ids[r.id]])))).toBe(golden.discoveryTargetIds.sha256);
  });

  it("the late content is in the catalogs exactly when the late catalog is on, after the golden prefix; no ordinary recipe carries a POST_BAKE requirement", () => {
    const on = lateCatalogEnabled();
    const recipeIds = new Set<string>(RECIPES.map((r) => r.id));
    const ingredientIds = new Set(INGREDIENTS.map((i) => i.id));
    for (const recipe of LATE_RECIPES as readonly { id: string }[]) expect(recipeIds.has(recipe.id)).toBe(on);
    for (const ingredient of LATE_INGREDIENTS) expect(ingredientIds.has(ingredient.id)).toBe(on);
    for (const step of LATE_LADDER_STEPS) expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === step.keyRecipeId)).toBe(on);
    for (const recipe of RECIPES.filter((r) => !recipeIsLate(r.id))) {
      expect((recipe.requiredIngredients as readonly { applicationPhase?: string }[]).some((q) => q.applicationPhase === "POST_BAKE")).toBe(false);
    }
  });
});
