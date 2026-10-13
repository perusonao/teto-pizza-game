/**
 * Cooking Steps 2.0 CS-1b (Issue #294, PR-C): test-only scenario builder for "what does CONFIRM_BAKE
 * finalize?". It puts every recipe's Reference pizza on a round of each of the four modes -- guided,
 * Free Cooking, Lunch Rush, Dinner -- at the BAKE phase, so a test can dispatch CONFIRM_BAKE with a
 * raw / good / burnt bake. The recipe list is derived from `RECIPES` by the caller; nothing here pins
 * the catalog size, so a new recipe joins the matrix with no fixture to regenerate.
 */
import { buildIdealSauceFixture, getReferencePizza } from "../../data/referencePizza";
import { FREE_COOK_BAKE_TARGET } from "../../data/freeCook";
import { INGREDIENTS } from "../../data/ingredients";
import type { RecipeId } from "../../data/recipes";
import { getDinnerMission } from "../../mission/dinner/dinnerMission";
import { EMPTY_DEX, type DexEntry, type DexState } from "../dex";
import { createInitialGameState, gameReducer, type GameState } from "../gameReducer";
import type { InventoryState } from "../inventory";
import { createEmptyPizza, type PizzaState } from "../pizzaState";
import { createGuidedInitialState } from "./guidedRound";

export type RoundMode = "guided" | "free" | "lunchRush" | "dinner";
export type BakeLevel = "raw" | "good" | "burnt";
/** "full" = every Reference piece; "partial" = one piece per ingredient (a short order: passes the
 *  "recipe" completion policy, not Lunch Rush's "order" policy). */
export type PizzaVariant = "full" | "partial";

export const ROUND_MODES: readonly RoundMode[] = ["guided", "free", "lunchRush", "dinner"];
export const BAKE_LEVELS: readonly BakeLevel[] = ["raw", "good", "burnt"];
export const PIZZA_VARIANTS: readonly PizzaVariant[] = ["full", "partial"];

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const STOCK: InventoryState = Object.fromEntries(FINITE_IDS.map((id) => [id, 99]));
const T0 = 1_000_000;

/** The recipe's Reference pizza exactly as the Reference defines it (sauce deposits + pieces). */
export function referencePizzaFor(recipeId: RecipeId, variant: PizzaVariant = "full"): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`no reference for ${recipeId}`);
  return {
    ...createEmptyPizza(),
    sauceIds: reference.sauce ? [reference.sauce.ingredientId] : [],
    sauceDeposits: reference.sauce ? buildIdealSauceFixture() : [],
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      (variant === "partial" ? group.positions.slice(0, 1) : group.positions).map((position, i) => ({
        id: `${recipeId}-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...position,
      })),
    ),
  };
}

function discoveredDex(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

/** A round of `mode` at phase BAKE (START_BAKE already dispatched) carrying `recipeId`'s Reference pizza. */
export function atBake(mode: RoundMode, recipeId: RecipeId, variant: PizzaVariant = "full"): GameState {
  const pizza = referencePizzaFor(recipeId, variant);
  if (mode === "free") {
    const started = gameReducer(createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK), { type: "START_FREE_COOK" });
    return gameReducer({ ...gameReducer(started, { type: "BEGIN_PREPARE" }), pizza }, { type: "START_BAKE" });
  }
  if (mode === "dinner") {
    const dm = getDinnerMission("dm-a")!;
    const dex = discoveredDex(dm.targetRecipeIds);
    const begun = gameReducer(createInitialGameState(dex, ALL_IDS, 0, STOCK, [], FINITE_IDS, {}), {
      type: "DINNER_START",
      missionId: "dm-a",
      now: T0,
      durationMs: 600_000,
      minimumStars: 3,
    });
    if (begun.dinner === null) throw new Error("Dinner did not start");
    return gameReducer({ ...begun, pizza }, { type: "START_BAKE", now: T0 });
  }
  const guided = createGuidedInitialState(recipeId, { inventory: STOCK, ownedIngredientIds: ALL_IDS });
  const prepared = gameReducer(guided, { type: "BEGIN_PREPARE" });
  // Lunch Rush reuses the guided round's recipe; the base reducer reads the kind only through
  // `isMissionRound` / `roundKind` (the "order" completion policy), so those are what differ.
  const round: GameState =
    mode === "lunchRush" ? { ...prepared, isMissionRound: true, roundKind: "LUNCH_RUSH" } : prepared;
  return gameReducer({ ...round, pizza }, { type: "START_BAKE" });
}

/**
 * Free Cooking pizzas that the matcher does NOT resolve to a recipe (CONFIRM_BAKE's non-MATCHED
 * branch): an empty pizza, a lone piece, a composition no recipe describes. Reference pizzas always
 * match, so they cannot reach that branch.
 */
export const UNMATCHED_FREE_PIZZAS: Readonly<Record<string, PizzaState>> = (() => {
  const piece = (id: string, ingredientId: string, x: number, y: number) => ({ id, ingredientId, x, y });
  const empty = createEmptyPizza();
  return {
    empty,
    "lone-basil": { ...empty, toppings: [piece("a", "basil", 50, 50)] },
    "sauce-only": { ...empty, sauceIds: ["tomato-sauce"], sauceDeposits: buildIdealSauceFixture() },
    "odd-mix": {
      ...empty,
      sauceIds: ["tomato-sauce"],
      sauceDeposits: buildIdealSauceFixture(),
      toppings: [piece("a", "basil", 40, 45), piece("b", "basil", 60, 55), piece("c", "mozzarella", 50, 50)],
    },
  };
})();

/** A Free Cooking round at BAKE carrying `pizza` (for the non-MATCHED branch). */
export function atBakeFreeWith(pizza: PizzaState): GameState {
  const started = gameReducer(createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK), { type: "START_FREE_COOK" });
  return gameReducer({ ...gameReducer(started, { type: "BEGIN_PREPARE" }), pizza }, { type: "START_BAKE" });
}

/** The bake value for `level`, against the window the round's bake is judged by. */
export function bakeValueFor(mode: RoundMode, state: GameState, level: BakeLevel): number {
  const { start, end } = mode === "free" ? FREE_COOK_BAKE_TARGET : state.recipe.bakeTarget;
  if (level === "raw") return Math.max(0, start - 25);
  if (level === "burnt") return Math.min(100, end + 25);
  return Math.round((start + end) / 2);
}

/** CONFIRM_BAKE through the real `gameReducer` (the Dinner wrapper included). */
export function confirmBake(state: GameState, value: number): GameState {
  return gameReducer(state, { type: "CONFIRM_BAKE", value, now: T0 + 5_000 });
}
