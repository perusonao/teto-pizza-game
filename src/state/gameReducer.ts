import { getNextOrder, type NextOrderOptions, type Order } from "../data/orders";
import { getRecipe, type Recipe } from "../data/recipes";
import { buildHintLine } from "../data/hints";
import type { DialogueLine } from "../data/dialogue";
import { scorePizza, type ScoreBreakdown } from "../logic/scoring";
import { classifyBake, type BakeState } from "../logic/bake";
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
  dex: string[];
  justDiscovered: boolean;
  hint: DialogueLine | null;
  placement: PlacementFeedback | null;
}

export type GameAction =
  | { type: "BEGIN_PREPARE" }
  | { type: "APPLY_SAUCE"; ingredientId: string }
  | { type: "PLACE_TOPPING"; ingredientId: string; x: number; y: number }
  | { type: "RESET_PIZZA" }
  | { type: "START_BAKE" }
  | { type: "CONFIRM_BAKE"; value: number }
  | { type: "REGISTER_TO_DEX" }
  | { type: "PLAY_AGAIN" }
  | { type: "SHOW_HINT" };

function nextOrderState(dex: string[], orderOptions: NextOrderOptions): GameState {
  const order = getNextOrder(orderOptions);
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
    justDiscovered: false,
    hint: null,
    placement: null,
  };
}

export function createInitialGameState(): GameState {
  return nextOrderState([], { preferFirst: true });
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
      const alreadyDiscovered = state.dex.includes(state.recipe.id);
      const dex = alreadyDiscovered ? state.dex : [...state.dex, state.recipe.id];
      return { ...state, dex, justDiscovered: !alreadyDiscovered, phase: "DISCOVERED" };
    }

    case "PLAY_AGAIN":
      return nextOrderState(state.dex, { excludeRecipeId: state.recipe.id });

    case "SHOW_HINT":
      return { ...state, hint: buildHintLine(state.recipe, state.pizza) };

    default:
      return state;
  }
}
