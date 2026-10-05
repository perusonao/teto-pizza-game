/**
 * TQ-1B (Issue #263, OD-TQ-S1): a deterministic pizza matrix for the score-parity snapshot.
 *
 * For every production recipe it builds the same handful of pizzas (ideal, slightly off, poor,
 * no sauce, half pieces, an extra unrequired piece, raw / over-baked / unbaked). The snapshot
 * (../__fixtures__/scoreParity.main-7bb0116.json) records what `computeScoringV2` returned for
 * each of them on `main` 7bb0116, before the no-sauce profile existed; the parity test then
 * requires today's result to be exactly the same, so no sauce recipe can move by a single point.
 */
import { buildIdealSauceFixture, getReferencePizza } from "../../../data/referencePizza";
import { RECIPES, type Recipe } from "../../../data/recipes";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "../../../state/pizzaState";
import { computeScoringV2, toLegacyScoreBreakdown } from "../index";

export const PARITY_VARIANTS = [
  "ideal",
  "offset",
  "poor",
  "noSauce",
  "halfPieces",
  "extraPiece",
  "raw",
  "burnt",
  "unbaked",
] as const;
export type ParityVariant = (typeof PARITY_VARIANTS)[number];

function ring(radius: number, count: number, amount = 0.02): SauceDeposit[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, amount };
  });
}

export function parityPizza(recipe: Recipe, variant: ParityVariant): PizzaState {
  const reference = getReferencePizza(recipe.id);
  const sauceId = reference?.sauce?.ingredientId ?? null;
  const groups = reference?.pieceGroups ?? [];
  const mid = (recipe.bakeTarget.start + recipe.bakeTarget.end) / 2;
  const pieces = groups.flatMap((g, gi) =>
    g.positions.map((p, i) => ({ id: `${recipe.id}-${gi}-${i}`, ingredientId: g.ingredientId, x: p.x, y: p.y })),
  );
  const base: PizzaState = {
    ...createEmptyPizza(),
    sauceIds: sauceId ? [sauceId] : [],
    // A recipe without a sauce (aussie, TQ-1D) has no deposits either.
    sauceDeposits: sauceId ? buildIdealSauceFixture() : [],
    toppings: pieces,
    bakeResult: mid,
  };
  switch (variant) {
    case "ideal":
      return base;
    case "offset":
      return {
        ...base,
        sauceDeposits: ring(28, 24),
        toppings: pieces.map((t, i) => ({ ...t, x: t.x + (i % 2 === 0 ? -3 : 3), y: t.y + (i % 2 === 0 ? 3 : -3) })),
      };
    case "poor":
      return {
        ...base,
        sauceDeposits: Array.from({ length: 10 }, () => ({ x: 55, y: 55, amount: 0.02 })),
        toppings: groups.slice(0, 2).map((g, i) => ({ id: `${recipe.id}-poor-${i}`, ingredientId: g.ingredientId, x: 12 + 76 * i, y: 12 + 76 * i })),
      };
    case "noSauce":
      return { ...base, sauceIds: [], sauceDeposits: [] };
    case "halfPieces":
      return { ...base, toppings: pieces.filter((_, i) => i % 2 === 0) };
    case "extraPiece":
      return { ...base, toppings: [...pieces, { id: `${recipe.id}-extra`, ingredientId: "pineapple", x: 50, y: 50 }] };
    case "raw":
      return { ...base, bakeResult: recipe.bakeTarget.start - 15 };
    case "burnt":
      return { ...base, bakeResult: recipe.bakeTarget.end + 15 };
    case "unbaked":
      return { ...base, bakeResult: null };
  }
}

export interface ParityRow {
  recipeId: string;
  variant: ParityVariant;
  available: boolean;
  totalScore: number | null;
  stars: number;
  components: { sauce: number | null; pieces: number | null; recipe: number | null; bake: number | null; quantityFactor: number | null };
}

function scoreOf(c: { available: boolean; score?: number }): number | null {
  return c.available && typeof c.score === "number" ? c.score : null;
}

export function computeParityRows(): ParityRow[] {
  const rows: ParityRow[] = [];
  for (const recipe of RECIPES) {
    for (const variant of PARITY_VARIANTS) {
      const pizza = parityPizza(recipe, variant);
      const result = computeScoringV2(recipe, pizza);
      const legacy = toLegacyScoreBreakdown(result, pizza.bakeResult, recipe.bakeTarget);
      const q = result.components.quantity;
      rows.push({
        recipeId: recipe.id,
        variant,
        available: result.available,
        totalScore: result.totalScore,
        stars: legacy.stars,
        components: {
          sauce: scoreOf(result.components.sauce as { available: boolean; score?: number }),
          pieces: scoreOf(result.components.pieces as { available: boolean; score?: number }),
          recipe: scoreOf(result.components.recipe as { available: boolean; score?: number }),
          bake: scoreOf(result.components.bake as { available: boolean; score?: number }),
          quantityFactor: q.available ? q.factor : null,
        },
      });
    }
  }
  return rows;
}
