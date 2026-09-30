/**
 * Test-only fixtures for the P3-3a Trial Notebook wiring: real free-cook rounds walked with the real reducer
 * actions a player's taps dispatch (no state injection), shared by the reducer and React-harness suites.
 */
import { FREE_COOK_BAKE_TARGET } from "../../data/freeCook";
import { buildIdealSauceFixture, getReferencePizza } from "../../data/referencePizza";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../gameReducer";
import type { DexState } from "../dex";
import { walkPostBakeToResult } from "./postBakeFlow";
import { discoveredDex } from "./guidedRound";

export const NOW = 1_000_000;
export const MID_BAKE = (FREE_COOK_BAKE_TARGET.start + FREE_COOK_BAKE_TARGET.end) / 2;

export const DEX_3 = discoveredDex(["margherita", "bismarck", "breakfast-pizza"]);
export const OWNED = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom"];
export const INVENTORY = { egg: 30, bacon: 30, mushroom: 30 };

const spot = (n: number) => ({ x: 30 + (n % 5) * 10, y: 35 + Math.floor(n / 5) * 12 });
export function pieces(id: string, count: number, from = 0) {
  return Array.from({ length: count }, (_, i) => ({ id, ...spot(from + i) }));
}
export function referencePieces(recipeId: string, ingredientId: string) {
  const group = getReferencePizza(recipeId as never)!.pieceGroups.find((g) => g.ingredientId === ingredientId)!;
  return group.positions.map((p) => ({ id: ingredientId, ...p }));
}

export interface Pizza {
  sauce?: string;
  sauceDeposits?: ReturnType<typeof buildIdealSauceFixture>;
  cheese?: { id: string; x: number; y: number }[];
  toppings?: { id: string; x: number; y: number }[];
}

export function freeRound(dex: DexState = DEX_3): GameState {
  return gameReducer(createInitialGameState(dex, OWNED, 0, INVENTORY, []), { type: "START_FREE_COOK", now: NOW });
}

/** Walks the PREPARE steps of the state's current round with real actions and bakes it to RESULT. */
export function cook(state: GameState, pizza: Pizza, bake = MID_BAKE): GameState {
  let s = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  if (pizza.sauce) {
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: pizza.sauce, deposits: pizza.sauceDeposits ?? buildIdealSauceFixture() });
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.cheese ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.toppings ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  s = ([{ type: "START_BAKE", now: NOW + 60_000 }, { type: "CONFIRM_BAKE", value: bake }] as GameAction[]).reduce(gameReducer, s);
  return walkPostBakeToResult(s);
}

export const register = (s: GameState) => gameReducer(s, { type: "REGISTER_TO_DEX" });

// Scenarios (Dex 3: funghi = tomato sauce + mozzarella + mushroom is the one discoverable recipe).
export const ORDINARY: Pizza = { sauce: "tomato-sauce", cheese: pieces("mozzarella", 3), toppings: [] };
export const FAR_ORIGINAL: Pizza = {
  sauce: "tomato-sauce",
  cheese: [],
  toppings: [...pieces("basil", 1), ...pieces("egg", 2, 1), ...pieces("bacon", 2, 3)],
};
export const INCOMPLETE: Pizza = {
  sauce: "tomato-sauce",
  sauceDeposits: buildIdealSauceFixture().slice(0, 1),
  cheese: pieces("mozzarella", 2),
  toppings: pieces("mushroom", 3, 2),
};
export const MARGHERITA: Pizza = {
  sauce: "tomato-sauce",
  cheese: referencePieces("margherita", "mozzarella"),
  toppings: referencePieces("margherita", "basil"),
};

/** One complete free-cook ORIGINAL round from `state` (a fresh free round is started first). */
export function playFreeRound(state: GameState, pizza: Pizza, bake = MID_BAKE): GameState {
  return register(cook(gameReducer(state, { type: "START_FREE_COOK", now: NOW }), pizza, bake));
}
