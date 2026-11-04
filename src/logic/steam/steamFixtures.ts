import { gameReducer, type GameState } from "../../state/gameReducer";
import { createGuidedInitialState } from "../../state/testSupport/guidedRound";

/**
 * Cooking Steam Phase 1 (#726, S2) test helpers: a Guided or Free Cooking round standing in the TOPPING step with clam, mussel and sausage (and beef) owned.
 * A deliberate COPY of ../sear/searFixtures.ts, not an import: the three cooking treatments share no code.
 */
const confirm = (s: GameState) => gameReducer(s, { type: "CONFIRM_MAKING_STEP" });

export const OWNED = ["clam", "mussel", "sausage", "beef", "shrimp"] as const;

export function toStep(kind: "GUIDED" | "FREE_COOK", upTo: "DOUGH" | "SAUCE" | "TOPPING", owned = true): GameState {
  const init = createGuidedInitialState(
    "margherita",
    owned ? { ownedIngredientIds: [...OWNED], inventory: Object.fromEntries(OWNED.map((id) => [id, 9])) } : {},
  );
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

/** Optionally steams `ingredientId` (`steam`: false = not at all, true = 0.5, number = that amount), places three of it, bakes. */
export function placeAndBake(s: GameState, ingredientId: "clam" | "mussel", steam: boolean | number): GameState {
  if (steam !== false) s = gameReducer(s, { type: "STEAM_INGREDIENT", ingredientId, amount: typeof steam === "number" ? steam : 0.5 });
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId, x, y });
  s = gameReducer(s, { type: "START_BAKE" });
  return gameReducer(s, { type: "CONFIRM_BAKE", value: 70 });
}

/** The state with module-level counters (topping ids, placement token) normalised, minus the steam look. */
export function normalised(s: GameState): unknown {
  const { steamedLook: _look, ...rest } = s;
  return JSON.parse(JSON.stringify(rest).replace(/"topping-\d+"/g, '"topping-N"').replace(/"token":\d+/g, '"token":0'));
}
