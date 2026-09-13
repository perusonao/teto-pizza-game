import { getNextOrder, type Order } from "../data/orders";
import { getRecipe, type Recipe } from "../data/recipes";
import { scorePizza, type ScoreBreakdown } from "../logic/scoring";
import { createEmptyPizza, type PizzaState } from "./pizzaState";

export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";

export interface GameState {
  phase: GamePhase;
  order: Order;
  recipe: Recipe;
  pizza: PizzaState;
  score: ScoreBreakdown | null;
  dex: string[];
  justDiscovered: boolean;
  hintKey: string | null;
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

function initialOrderState(dex: string[]): GameState {
  const order = getNextOrder();
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
    dex,
    justDiscovered: false,
    hintKey: null,
  };
}

export function createInitialGameState(): GameState {
  return initialOrderState([]);
}

function nextHint(pizza: PizzaState): string | null {
  const hasSauce = pizza.sauceIds.length > 0;
  const cheeseCount = pizza.toppings.filter((t) => t.ingredientId === "mozzarella").length;
  const basilCount = pizza.toppings.filter((t) => t.ingredientId === "basil").length;

  if (!hasSauce) return "prepare.hint.empty";
  if (cheeseCount < 3) return "prepare.hint.sauceOnly";
  if (basilCount < 2) return "prepare.hint.needBasil";
  return "prepare.hint.ready";
}

let placedIdCounter = 0;

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "BEGIN_PREPARE":
      return { ...state, phase: "PREPARE", hintKey: nextHint(state.pizza) };

    case "APPLY_SAUCE": {
      const pizza: PizzaState = {
        ...state.pizza,
        sauceIds: [action.ingredientId],
      };
      return { ...state, pizza, hintKey: nextHint(pizza) };
    }

    case "PLACE_TOPPING": {
      placedIdCounter += 1;
      const pizza: PizzaState = {
        ...state.pizza,
        toppings: [
          ...state.pizza.toppings,
          {
            id: `topping-${placedIdCounter}`,
            ingredientId: action.ingredientId,
            x: action.x,
            y: action.y,
          },
        ],
      };
      return { ...state, pizza, hintKey: nextHint(pizza) };
    }

    case "RESET_PIZZA": {
      const pizza = createEmptyPizza();
      return { ...state, pizza, hintKey: nextHint(pizza) };
    }

    case "START_BAKE":
      return { ...state, phase: "BAKE" };

    case "CONFIRM_BAKE": {
      const pizza: PizzaState = { ...state.pizza, bakeResult: action.value };
      const score = scorePizza(state.recipe, pizza);
      return { ...state, pizza, score, phase: "RESULT" };
    }

    case "REGISTER_TO_DEX": {
      const alreadyDiscovered = state.dex.includes(state.recipe.id);
      const dex = alreadyDiscovered ? state.dex : [...state.dex, state.recipe.id];
      return { ...state, dex, justDiscovered: !alreadyDiscovered, phase: "DISCOVERED" };
    }

    case "PLAY_AGAIN":
      return initialOrderState(state.dex);

    case "SHOW_HINT":
      return { ...state, hintKey: nextHint(state.pizza) };

    default:
      return state;
  }
}
