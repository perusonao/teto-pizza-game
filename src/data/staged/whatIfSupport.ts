/**
 * What-if support (Issue #780 plan §7-2; TEST SUPPORT ONLY, imported by `stagedWhatIf.*.test.ts` and never by production code).
 * Builds the in-memory Ingredient / Recipe rows a test mock appends to the shipped catalog so the REAL production authorities
 * (researchCohortLetters, buildHint5Ladder, ...) can be measured on "shipped + all staged" without changing any shipped file.
 * Placeholder values (color / emoji / price) are inert in these measurements.
 */
import { IN_FLIGHT_INGREDIENT_IDS } from "./stagedCatalog";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

export interface WhatIfIngredient {
  id: string;
  category: "sauce" | "cheese" | "topping";
  nameJa: string;
  color: string;
  emoji: string;
  placement: "spread" | "scatter";
  unlockCondition: { minTotalStars: number };
  pricePitz: number;
  restockQuantity: number;
}

/** In-flight ingredients (#783 / B20-A) with their planned category, so recipes that reference them resolve. */
const IN_FLIGHT_CATEGORY: Record<string, "sauce" | "cheese" | "topping"> = { burrata: "cheese", honey: "sauce", walnut: "topping" };
export const IN_FLIGHT_FAMILY: Record<string, string> = { walnut: "other" }; // (walnut shipped in Batch 20-A #790 as `other`, the nut family with almond / pine-nuts)

/** `shippedIds`: ingredient ids already in the shipped catalog (e.g. burrata after PR #783); they are never appended a second time. */
export function whatIfIngredients(shippedIds: readonly string[] = []): WhatIfIngredient[] {
  const row = (id: string, category: WhatIfIngredient["category"], nameJa: string): WhatIfIngredient => ({
    id, category, nameJa, color: "#999999", emoji: `staged:${id}`, placement: category === "sauce" ? "spread" : "scatter",
    unlockCondition: { minTotalStars: 0 }, pricePitz: 100, restockQuantity: 5,
  });
  return [
    ...Object.keys(IN_FLIGHT_INGREDIENT_IDS).filter((id) => !shippedIds.includes(id)).map((id) => row(id, IN_FLIGHT_CATEGORY[id], id)),
    ...STAGED_INGREDIENTS.filter((i) => i.status === "ACTIVE").map((i) => row(i.id, i.category, i.nameJa)),
  ];
}

export function whatIfFamily(id: string): string | null {
  if (id in IN_FLIGHT_FAMILY) return IN_FLIGHT_FAMILY[id];
  return STAGED_INGREDIENTS.find((i) => i.id === id)?.family ?? null;
}

export function whatIfRecipes() {
  return STAGED_RECIPES.map((r) => ({
    id: r.id,
    nameJa: r.nameJa,
    description: "",
    requiredIngredients: r.requiredIngredients,
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
  }));
}
