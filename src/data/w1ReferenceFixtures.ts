import type { BakeTarget } from "./recipes";
import type { SauceInteractionKind } from "./recipeSauceProfiles";
import {
  IDEAL_MARGHERITA_SAUCE_METRICS,
  type ReferencePieceGroup,
  type ReferencePizza,
  type ReferenceSauce,
} from "./referencePizza";

/**
 * Progression 2.0 W1 I5b-2 (docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md §7-§8, MD-01 +
 * RT-01c): the Scoring 2.0 Reference Truth for the 10 W1 recipes, authored ahead of time.
 *
 * **Not wired.** Nothing in the runtime imports this module: `REFERENCE_PIZZAS`, `RECIPES`,
 * `RECIPE_SAUCE_PROFILES`, the discovery catalog, `ORDERS`, the CUT allowlist and
 * `DISCOVERY_LADDER` are unchanged. I5b-3 registers these fixtures (with the recipes) in the same
 * change. Until then the ids below are this module's own `W1RecipeId`, not `RecipeId`, so no
 * production `Record<RecipeId, ...>` table changes.
 *
 * - **pieceGroups** are literal coordinates: the RT-01 reference layout
 *   (`assignReferenceSlots` in ../logic/pizzaReferenceLayout.ts) frozen for each recipe's own
 *   `requiredIngredients` (non-sauce, in order, `minCount` each). 1-8 pieces = the legacy ring,
 *   consecutive (the `MEAT_LOVERS_REFERENCE` precedent); 9-10 pieces = the approved Candidate B
 *   multi-ring, interleaved (RT-01-OD-1). This module never imports the layout code;
 *   w1ReferenceFixtures.test.ts pins literal == generator output, so the mini 見本 / popover the
 *   player sees and the scoring targets stay one Reference Truth (#167).
 * - **sauce** is the existing mechanical derivation (`computeMechanicalSauceReference`'s ideal
 *   fixture metrics) for the recipe's own sauce -- no new sauce numbers.
 * - **landing / tolerance** follow production: LIGHT_LEAF for the leafy herb (basil),
 *   HEAVY_SQUASH for every other piece; 8/22 everywhere except egg's 14/30.
 */

export const W1_RECIPE_IDS = [
  "new-haven-apizza",
  "hawaiian",
  "parmigiana-pizza",
  "bambino",
  "pizza-portuguesa",
  "puttanesca-pizza",
  "pesto-caprese",
  "pesto-tonno",
  "pesto-patate",
  "melanzane-pizza",
] as const;

export type W1RecipeId = (typeof W1_RECIPE_IDS)[number];

/** A `ReferencePizza` keyed by a not-yet-shipped W1 id. Structurally identical otherwise, so I5b-3
 *  can register each one in `REFERENCE_PIZZAS` unchanged once the id is a `RecipeId`. */
export type W1ReferencePizza = Omit<ReferencePizza, "recipeId"> & { recipeId: W1RecipeId };

/** The recipe-level data each fixture has to agree with (Fresh Audit §1 / 35bc937): the sauce
 *  profile I5b-3 registers in `RECIPE_SAUCE_PROFILES`, and the bake target. */
export interface W1ReferenceRecipeMeta {
  sauceIngredientId: "tomato-sauce" | "pesto" | "olive-oil";
  sauceInteraction: SauceInteractionKind;
  bakeTarget: BakeTarget;
}

export const W1_REFERENCE_RECIPE_META: Readonly<Record<W1RecipeId, W1ReferenceRecipeMeta>> = {
  // olive-oil keeps the PAINT_TEMPORARY profile of quattro-formaggi / fugazza / pizza-bianca.
  "new-haven-apizza": { sauceIngredientId: "olive-oil", sauceInteraction: "PAINT_TEMPORARY", bakeTarget: { start: 62, end: 82 } },
  hawaiian: { sauceIngredientId: "tomato-sauce", sauceInteraction: "PAINT", bakeTarget: { start: 60, end: 80 } },
  "parmigiana-pizza": { sauceIngredientId: "tomato-sauce", sauceInteraction: "PAINT", bakeTarget: { start: 58, end: 78 } },
  bambino: { sauceIngredientId: "tomato-sauce", sauceInteraction: "PAINT", bakeTarget: { start: 56, end: 76 } },
  "pizza-portuguesa": { sauceIngredientId: "tomato-sauce", sauceInteraction: "PAINT", bakeTarget: { start: 58, end: 78 } },
  "puttanesca-pizza": { sauceIngredientId: "tomato-sauce", sauceInteraction: "PAINT", bakeTarget: { start: 50, end: 70 } },
  "pesto-caprese": { sauceIngredientId: "pesto", sauceInteraction: "PAINT", bakeTarget: { start: 50, end: 70 } },
  "pesto-tonno": { sauceIngredientId: "pesto", sauceInteraction: "PAINT", bakeTarget: { start: 50, end: 70 } },
  "pesto-patate": { sauceIngredientId: "pesto", sauceInteraction: "PAINT", bakeTarget: { start: 58, end: 78 } },
  "melanzane-pizza": { sauceIngredientId: "tomato-sauce", sauceInteraction: "PAINT", bakeTarget: { start: 58, end: 78 } },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `computeMechanicalSauceReference` for a W1 recipe: the same ideal-fixture metrics, for that
 *  recipe's own sauce ingredient. */
function mechanicalSauce(id: W1RecipeId): ReferenceSauce {
  return {
    ingredientId: W1_REFERENCE_RECIPE_META[id].sauceIngredientId,
    quantity: round2(IDEAL_MARGHERITA_SAUCE_METRICS.quantity),
    coverage: round2(IDEAL_MARGHERITA_SAUCE_METRICS.coverage),
  };
}

function group(
  ingredientId: string,
  positions: readonly { x: number; y: number }[],
  landingStyle: "HEAVY_SQUASH" | "LIGHT_LEAF",
  fullCreditRadius: number,
  zeroCreditRadius: number,
): ReferencePieceGroup {
  return {
    ingredientId,
    positions,
    interaction: { family: "TAP_PLACE", primaryInput: "DRAG_FROM_TRAY", fallbackInput: "TAP_ON_PIZZA", landingStyle },
    matching: { fullCreditRadius, zeroCreditRadius },
  };
}

export const W1_NEW_HAVEN_APIZZA_REFERENCE: W1ReferencePizza = {
  recipeId: "new-haven-apizza",
  sauce: mechanicalSauce("new-haven-apizza"),
  pieceGroups: [
    group("parmigiano", [{ x: 50, y: 24 }, { x: 73, y: 36 }], "HEAVY_SQUASH", 8, 22),
    group("clam", [{ x: 76, y: 63 }, { x: 58, y: 79 }, { x: 38, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("garlic", [{ x: 22, y: 63 }, { x: 25, y: 36 }], "HEAVY_SQUASH", 8, 22),
  ],
};

export const W1_HAWAIIAN_REFERENCE: W1ReferencePizza = {
  recipeId: "hawaiian",
  sauce: mechanicalSauce("hawaiian"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 24 }, { x: 73, y: 36 }], "HEAVY_SQUASH", 8, 22),
    group("ham", [{ x: 76, y: 63 }, { x: 58, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("pineapple", [{ x: 38, y: 79 }, { x: 22, y: 63 }, { x: 25, y: 36 }], "HEAVY_SQUASH", 8, 22),
  ],
};

/** RT-01c: 9 pieces -> Candidate B multi-ring, interleaved (min gap 21.43, max radius 28). */
export const W1_PARMIGIANA_PIZZA_REFERENCE: W1ReferencePizza = {
  recipeId: "parmigiana-pizza",
  sauce: mechanicalSauce("parmigiana-pizza"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 22 }, { x: 50, y: 78 }], "HEAVY_SQUASH", 8, 22),
    group("eggplant", [{ x: 69.8, y: 30.2 }, { x: 30.2, y: 69.8 }, { x: 50, y: 50 }], "HEAVY_SQUASH", 8, 22),
    group("parmigiano", [{ x: 78, y: 50 }, { x: 22, y: 50 }], "HEAVY_SQUASH", 8, 22),
    group("basil", [{ x: 69.8, y: 69.8 }, { x: 30.2, y: 30.2 }], "LIGHT_LEAF", 8, 22),
  ],
};

export const W1_BAMBINO_REFERENCE: W1ReferencePizza = {
  recipeId: "bambino",
  sauce: mechanicalSauce("bambino"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 24 }, { x: 73, y: 36 }], "HEAVY_SQUASH", 8, 22),
    group("ham", [{ x: 76, y: 63 }, { x: 58, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("corn", [{ x: 38, y: 79 }, { x: 22, y: 63 }, { x: 25, y: 36 }], "HEAVY_SQUASH", 8, 22),
  ],
};

/** RT-01c: 10 pieces -> Candidate B multi-ring, interleaved (min gap 19.15, max radius 28). egg keeps
 *  its 14/30 tolerance (the bismarck / breakfast-pizza egg precedent). */
export const W1_PIZZA_PORTUGUESA_REFERENCE: W1ReferencePizza = {
  recipeId: "pizza-portuguesa",
  sauce: mechanicalSauce("pizza-portuguesa"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 22 }, { x: 40.42, y: 76.31 }], "HEAVY_SQUASH", 8, 22),
    group("ham", [{ x: 68, y: 28.55 }, { x: 25.75, y: 64 }, { x: 50, y: 50 }], "HEAVY_SQUASH", 8, 22),
    group("egg", [{ x: 77.57, y: 45.14 }], "HEAVY_SQUASH", 14, 30),
    group("onion", [{ x: 74.25, y: 64 }, { x: 32, y: 28.55 }], "HEAVY_SQUASH", 8, 22),
    group("black-olive", [{ x: 59.58, y: 76.31 }, { x: 22.43, y: 45.14 }], "HEAVY_SQUASH", 8, 22),
  ],
};

/** RT-01c: 9 pieces -> Candidate B multi-ring, interleaved (min gap 21.43, max radius 28). */
export const W1_PUTTANESCA_PIZZA_REFERENCE: W1ReferencePizza = {
  recipeId: "puttanesca-pizza",
  sauce: mechanicalSauce("puttanesca-pizza"),
  pieceGroups: [
    group("anchovy", [{ x: 50, y: 22 }, { x: 50, y: 78 }, { x: 50, y: 50 }], "HEAVY_SQUASH", 8, 22),
    group("black-olive", [{ x: 69.8, y: 30.2 }, { x: 30.2, y: 69.8 }], "HEAVY_SQUASH", 8, 22),
    group("capers", [{ x: 78, y: 50 }, { x: 22, y: 50 }], "HEAVY_SQUASH", 8, 22),
    group("garlic", [{ x: 69.8, y: 69.8 }, { x: 30.2, y: 30.2 }], "HEAVY_SQUASH", 8, 22),
  ],
};

export const W1_PESTO_CAPRESE_REFERENCE: W1ReferencePizza = {
  recipeId: "pesto-caprese",
  sauce: mechanicalSauce("pesto-caprese"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 24 }, { x: 73, y: 36 }], "HEAVY_SQUASH", 8, 22),
    group("fresh-tomato", [{ x: 76, y: 63 }, { x: 58, y: 79 }, { x: 38, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("basil", [{ x: 22, y: 63 }, { x: 25, y: 36 }], "LIGHT_LEAF", 8, 22),
  ],
};

export const W1_PESTO_TONNO_REFERENCE: W1ReferencePizza = {
  recipeId: "pesto-tonno",
  sauce: mechanicalSauce("pesto-tonno"),
  pieceGroups: [
    group("tuna", [{ x: 50, y: 24 }, { x: 73, y: 36 }, { x: 76, y: 63 }], "HEAVY_SQUASH", 8, 22),
    group("black-olive", [{ x: 58, y: 79 }, { x: 38, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("onion", [{ x: 22, y: 63 }, { x: 25, y: 36 }], "HEAVY_SQUASH", 8, 22),
  ],
};

export const W1_PESTO_PATATE_REFERENCE: W1ReferencePizza = {
  recipeId: "pesto-patate",
  sauce: mechanicalSauce("pesto-patate"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 24 }, { x: 73, y: 36 }], "HEAVY_SQUASH", 8, 22),
    group("potato", [{ x: 76, y: 63 }, { x: 58, y: 79 }, { x: 38, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("bacon", [{ x: 22, y: 63 }, { x: 25, y: 36 }], "HEAVY_SQUASH", 8, 22),
  ],
};

export const W1_MELANZANE_PIZZA_REFERENCE: W1ReferencePizza = {
  recipeId: "melanzane-pizza",
  sauce: mechanicalSauce("melanzane-pizza"),
  pieceGroups: [
    group("mozzarella", [{ x: 50, y: 24 }, { x: 73, y: 36 }], "HEAVY_SQUASH", 8, 22),
    group("eggplant", [{ x: 76, y: 63 }, { x: 58, y: 79 }, { x: 38, y: 79 }], "HEAVY_SQUASH", 8, 22),
    group("basil", [{ x: 22, y: 63 }, { x: 25, y: 36 }], "LIGHT_LEAF", 8, 22),
  ],
};

export const W1_REFERENCE_FIXTURES: readonly W1ReferencePizza[] = [
  W1_NEW_HAVEN_APIZZA_REFERENCE,
  W1_HAWAIIAN_REFERENCE,
  W1_PARMIGIANA_PIZZA_REFERENCE,
  W1_BAMBINO_REFERENCE,
  W1_PIZZA_PORTUGUESA_REFERENCE,
  W1_PUTTANESCA_PIZZA_REFERENCE,
  W1_PESTO_CAPRESE_REFERENCE,
  W1_PESTO_TONNO_REFERENCE,
  W1_PESTO_PATATE_REFERENCE,
  W1_MELANZANE_PIZZA_REFERENCE,
];

