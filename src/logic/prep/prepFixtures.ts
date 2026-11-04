import { gameReducer, type GameState } from "../../state/gameReducer";
import { createGuidedInitialState } from "../../state/testSupport/guidedRound";

/** Cooking Prep Phase 1 PR-A test helpers: a Guided or Free Cooking round standing in the TOPPING step with beef owned. */
const confirm = (s: GameState) => gameReducer(s, { type: "CONFIRM_MAKING_STEP" });

export function initialWithBeef(owned = true): GameState {
  return createGuidedInitialState("margherita", owned ? { ownedIngredientIds: ["beef"], inventory: { beef: 9 } } : {});
}

export function toStep(kind: "GUIDED" | "FREE_COOK", upTo: "DOUGH" | "SAUCE" | "TOPPING", owned = true): GameState {
  const init = initialWithBeef(owned);
  let s = kind === "GUIDED" ? gameReducer(init, { type: "BEGIN_PREPARE" }) : gameReducer(init, { type: "START_FREE_COOK" });
  if (s.phase !== "PREPARE" || s.roundKind !== kind) throw new Error(`setup: ${s.phase} ${s.roundKind}`);
  if (upTo === "DOUGH") return s;
  s = gameReducer(s, { type: "COMMIT_DOUGH_STRETCH", shape: { radii: Array(8).fill(48) } as never });
  s = confirm(s);
  if (upTo === "SAUCE") return s;
  s = confirm(confirm(s));
  if (s.makingStep !== "TOPPING") throw new Error(`setup: expected TOPPING, got ${s.makingStep}`);
  return s;
}

export function placeBeefAndBake(s: GameState, prep: boolean | number): GameState {
  // `true` = prepped without a look (PR-B), a number = prepped and taken out at that progress (Phase 1B).
  if (prep !== false) s = gameReducer(s, typeof prep === "number" ? { type: "PREP_INGREDIENT", ingredientId: "beef", progress: prep } : { type: "PREP_INGREDIENT", ingredientId: "beef" });
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "beef", x, y });
  s = gameReducer(s, { type: "START_BAKE" });
  return gameReducer(s, { type: "CONFIRM_BAKE", value: 70 });
}

/** The state with module-level counters (topping ids, placement token) normalised, minus the prep set and its look. */
export function normalised(s: GameState): unknown {
  const { preparedIngredientIds: _prep, preparedLook: _look, ...rest } = s;
  return JSON.parse(JSON.stringify(rest).replace(/"topping-\d+"/g, '"topping-N"').replace(/"token":\d+/g, '"token":0'));
}
