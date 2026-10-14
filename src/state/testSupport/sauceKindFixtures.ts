import { createHash } from "node:crypto";
import { getRecipe, RECIPES, type Recipe } from "../../data/recipes";
import { INGREDIENTS, getIngredient } from "../../data/ingredients";
import { getRecipeSauceProfile } from "../../data/recipeSauceProfiles";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../gameReducer";
import { createEmptyPizza, type PizzaState, type PlacedTopping, type SauceDeposit } from "../pizzaState";

/**
 * Sauce B1 (Issue #489 line, per-kind sauce ledger): shared fixtures for the single-source Golden pin and the B1
 * regression suites. Deterministic everywhere (no clock, no random) so a hash is a stable fingerprint of behaviour.
 */
export const SAUCE_KINDS = ["tomato-sauce", "olive-oil", "pesto"] as const;
export type SauceKind = (typeof SAUCE_KINDS)[number];

const ALL_IDS = INGREDIENTS.map((i) => i.id);
/** Every finite ingredient seeded generously, so ownership / stock never decide an outcome unless a test says so. */
export const GENEROUS_INVENTORY: Record<string, number> = Object.fromEntries(
  INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]),
);

/** The recipe's own reference sauce kind (`null` for a NO_SAUCE recipe). */
export function recipeSauceKind(recipe: Recipe): SauceKind | null {
  return (getRecipeSauceProfile(recipe.id)?.ingredientId as SauceKind | undefined) ?? null;
}

/** A sauce kind other than `kind` (stable choice). */
export function otherSauceKind(kind: SauceKind | null, skip: readonly SauceKind[] = []): SauceKind {
  const found = SAUCE_KINDS.find((k) => k !== kind && !skip.includes(k));
  if (!found) throw new Error("no other sauce kind");
  return found;
}

/** A PREPARE / SAUCE state for `recipe`, everything owned, finite stock generous (override with `inventory`). */
export function sauceStepState(recipe: Recipe, inventory: Record<string, number> = GENEROUS_INVENTORY): GameState {
  const base = createInitialGameState(undefined, ALL_IDS, 0, inventory);
  return { ...base, phase: "PREPARE", recipe, makingStep: "SAUCE", isMissionRound: false, pizza: createEmptyPizza() };
}

export function ringBatch(cx: number, cy: number, radius: number, count: number, amount = 0.02): SauceDeposit[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, amount };
  });
}

export const commit = (ingredientId: string, deposits: SauceDeposit[]): GameAction => ({
  type: "COMMIT_SAUCE_DISPENSE",
  ingredientId,
  deposits,
});

export function run(state: GameState, actions: readonly GameAction[]): GameState {
  return actions.reduce((s, a) => gameReducer(s, a), state);
}

/** Required non-sauce pieces at deterministic grid positions (the "no waste" play), plus a mid-window bake. */
export function finishedPizza(recipe: Recipe, pizza: PizzaState): PizzaState {
  const toppings: PlacedTopping[] = [];
  let n = 0;
  for (const req of recipe.requiredIngredients) {
    if (getIngredient(req.ingredientId)?.category === "sauce") continue;
    for (let i = 0; i < req.minCount; i += 1) {
      toppings.push({ id: `t${n}`, ingredientId: req.ingredientId, x: 20 + (n % 6) * 12, y: 25 + Math.floor(n / 6) * 14 });
      n += 1;
    }
  }
  const { start, end } = recipe.bakeTarget;
  return { ...pizza, toppings, bakeResult: (start + end) / 2 };
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}
export const hashOf = (value: unknown): string => createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);

export { getRecipe, RECIPES };
