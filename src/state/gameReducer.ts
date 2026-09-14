import { getNextOrder, type NextOrderOptions, type Order } from "../data/orders";
import { getRecipe, type Recipe } from "../data/recipes";
import { buildHintLine } from "../data/hints";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DialogueLine } from "../data/dialogue";
import { scorePizza, type ScoreBreakdown } from "../logic/scoring";
import { classifyBake, type BakeState } from "../logic/bake";
import { discoveredRecipeIds, registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { availableRecipeIds } from "./progression";
import { pickMissionOrder } from "../mission/lunchRush";
import {
  createEmptyPizza,
  findOpenSpot,
  type PizzaState,
  type PlacementFeedback,
} from "./pizzaState";

export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";

export interface GameState {
  phase: GamePhase;
  order: Order;
  recipe: Recipe;
  pizza: PizzaState;
  score: ScoreBreakdown | null;
  bakeState: BakeState | null;
  dex: DexState;
  /** Canonical OWNED ingredient ids (Phase 3C-3). Always a superset of the Starter Set.
   *  Read-only in this phase -- there is no purchase action yet, so this only ever flows
   *  through from `createInitialGameState`'s hydration into every subsequent order. */
  ownedIngredientIds: readonly string[];
  justDiscovered: boolean;
  /** True when REGISTER_TO_DEX just improved this recipe's Dex BEST (including its very
   *  first discovery, which trivially sets the first BEST). RESULT/DISCOVERED UI uses this
   *  to show a "NEW BEST!" moment for repeat plays specifically. */
  justGotNewBest: boolean;
  hint: DialogueLine | null;
  placement: PlacementFeedback | null;
}

export type GameAction =
  | { type: "BEGIN_PREPARE" }
  | { type: "APPLY_SAUCE"; ingredientId: string; x: number; y: number }
  | { type: "PLACE_TOPPING"; ingredientId: string; x: number; y: number }
  | { type: "RESET_PIZZA" }
  | { type: "START_BAKE" }
  | { type: "CONFIRM_BAKE"; value: number }
  | { type: "REGISTER_TO_DEX" }
  | { type: "PLAY_AGAIN" }
  | { type: "SHOW_HINT" }
  // Phase 3C-4 (Lunch Rush): both below reuse this same round machinery (an ORDER phase with
  // a freshly-picked, available recipe) -- there is no separate Mission round state. See
  // src/mission/lunchRush.ts's top comment for the canonical/derived boundary this keeps.
  | { type: "MISSION_NEXT_ORDER" }
  | { type: "MISSION_RESET_ORDER" };

/** Builds a fresh ORDER-phase state around an already-picked `order` -- the one place that
 *  resets pizza/score/bakeState/hint/placement/justDiscovered/justGotNewBest for a new round,
 *  shared by every "start a new round" path (free play's `nextOrderState` below, and Mission's
 *  MISSION_NEXT_ORDER/MISSION_RESET_ORDER) so they can never drift out of sync on what a
 *  "fresh round" resets. */
function buildOrderState(
  order: Order,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): GameState {
  const recipe = getRecipe(order.recipeId);
  if (!recipe) {
    throw new Error(`Unknown recipe for order ${order.id}`);
  }
  return {
    phase: "ORDER",
    order,
    recipe,
    pizza: createEmptyPizza(),
    score: null,
    bakeState: null,
    dex,
    ownedIngredientIds,
    justDiscovered: false,
    justGotNewBest: false,
    hint: null,
    placement: null,
  };
}

function nextOrderState(
  dex: DexState,
  ownedIngredientIds: readonly string[],
  orderOptions: NextOrderOptions,
): GameState {
  const order = getNextOrder({
    ...orderOptions,
    dex: discoveredRecipeIds(dex),
    availableRecipeIds: availableRecipeIds(ownedIngredientIds),
  });
  return buildOrderState(order, dex, ownedIngredientIds);
}

/** Picks a fresh Mission order (see ../mission/lunchRush.ts's `pickMissionOrder`) and builds
 *  the ORDER-phase state around it. Shared by MISSION_NEXT_ORDER and MISSION_RESET_ORDER so
 *  both pick a Mission order the exact same way. */
function nextMissionOrderState(state: GameState): GameState {
  const ids = availableRecipeIds(state.ownedIngredientIds);
  const order = pickMissionOrder(ids, state.recipe.id);
  return buildOrderState(order, state.dex, state.ownedIngredientIds);
}

/** `dex` defaults to empty and `ownedIngredientIds` defaults to the Starter Set for
 *  existing call sites (tests, a from-scratch player); App.tsx passes in both from
 *  persistence.ts so a reload hydrates BEST/timesMade/ownership while everything else (the
 *  round in progress) starts fresh at ORDER regardless. */
export function createInitialGameState(
  dex: DexState = EMPTY_DEX,
  ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS,
): GameState {
  return nextOrderState(dex, ownedIngredientIds, { preferFirst: true });
}

let placedIdCounter = 0;
let placementTokenCounter = 0;

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "BEGIN_PREPARE":
      return { ...state, phase: "PREPARE", hint: buildHintLine(state.recipe, state.pizza) };

    case "APPLY_SAUCE": {
      const pizza: PizzaState = {
        ...state.pizza,
        sauceIds: [action.ingredientId],
        sauceOrigin: { x: action.x, y: action.y },
        sauceToken: state.pizza.sauceToken + 1,
      };
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza) };
    }

    case "PLACE_TOPPING": {
      const spot = findOpenSpot(state.pizza.toppings, action.x, action.y);
      placementTokenCounter += 1;

      if (!spot) {
        return {
          ...state,
          placement: {
            status: "rejected",
            x: action.x,
            y: action.y,
            token: placementTokenCounter,
          },
        };
      }

      placedIdCounter += 1;
      const pizza: PizzaState = {
        ...state.pizza,
        toppings: [
          ...state.pizza.toppings,
          {
            id: `topping-${placedIdCounter}`,
            ingredientId: action.ingredientId,
            x: spot.x,
            y: spot.y,
          },
        ],
      };
      const wasAdjusted = spot.x !== action.x || spot.y !== action.y;
      return {
        ...state,
        pizza,
        hint: buildHintLine(state.recipe, pizza),
        placement: {
          status: wasAdjusted ? "adjusted" : "placed",
          x: spot.x,
          y: spot.y,
          token: placementTokenCounter,
        },
      };
    }

    case "RESET_PIZZA": {
      const pizza = createEmptyPizza();
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza), placement: null };
    }

    case "START_BAKE":
      return { ...state, phase: "BAKE" };

    case "CONFIRM_BAKE": {
      const pizza: PizzaState = { ...state.pizza, bakeResult: action.value };
      const score = scorePizza(state.recipe, pizza);
      const bakeState = classifyBake(action.value, state.recipe.bakeTarget);
      return { ...state, pizza, score, bakeState, phase: "RESULT" };
    }

    case "REGISTER_TO_DEX": {
      // Only a RESULT with a score can register. This makes the Dex update atomic per
      // round: a stray or repeated dispatch (e.g. after the phase has already moved on to
      // DISCOVERED) can never double-count timesMade or re-evaluate BEST for the same round.
      if (state.phase !== "RESULT" || !state.score) {
        return state;
      }
      const { dex, wasNewDiscovery, isNewBest } = registerScoreToDex(
        state.dex,
        state.recipe.id,
        state.score,
      );
      return {
        ...state,
        dex,
        justDiscovered: wasNewDiscovery,
        justGotNewBest: isNewBest,
        phase: "DISCOVERED",
      };
    }

    case "PLAY_AGAIN":
      return nextOrderState(state.dex, state.ownedIngredientIds, {
        excludeRecipeId: state.recipe.id,
      });

    // Registers the current RESULT into the Dex (same rule as REGISTER_TO_DEX: BEST never
    // goes down, timesMade always increments once) and, in the same step, advances straight
    // to the next Mission order -- deliberately skipping DISCOVERED so Mission's serve flow
    // never pays the DISCOVERED overlay's pacing cost (SSOT section 11 / Phase 3C-4 scope).
    // Same atomicity guarantee as REGISTER_TO_DEX: only valid from a RESULT with a score, so
    // a stray/repeated dispatch can never double-register a round.
    case "MISSION_NEXT_ORDER": {
      if (state.phase !== "RESULT" || !state.score) {
        return state;
      }
      const { dex } = registerScoreToDex(state.dex, state.recipe.id, state.score);
      return nextMissionOrderState({ ...state, dex });
    }

    // Forces a fresh Mission order regardless of the current phase -- used when a Mission run
    // starts or retries, since the underlying round could be sitting anywhere (idle at ORDER,
    // or frozen mid-PREPARE/BAKE/RESULT if the previous run's timer expired mid-round).
    case "MISSION_RESET_ORDER":
      return nextMissionOrderState(state);

    case "SHOW_HINT":
      return { ...state, hint: buildHintLine(state.recipe, state.pizza, true) };

    default:
      return state;
  }
}
