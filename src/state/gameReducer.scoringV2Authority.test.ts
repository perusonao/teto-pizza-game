import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  gameReducer,
  type GameState,
} from "./gameReducer";
import { getRecipe, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "./pizzaState";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { EMPTY_DEX, registerScoreToDex } from "./dex";

const MARGHERITA_DISCOVERED_DEX = registerScoreToDex(EMPTY_DEX, "margherita", {
  // Keep this seed deliberately below every real-round BEST assertion in this authority suite:
  // its only purpose is making Margherita a legal discovered Mission candidate.
  total: 20,
  stars: 1,
  matchScore: 80,
  ingredientScore: 80,
  placementScore: 80,
  bakeScore: 80,
}).dex;

/**
 * A1 Authority Cutover (docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md): `gameReducer.ts`'s
 * CONFIRM_BAKE now derives `state.score` from Scoring 2.0 (`computeScoringV2` +
 * `toLegacyScoreBreakdown`), not legacy `scorePizza`. These tests are specifically about the
 * *authority boundary* -- that `state.score` (read by Dex/progression/Mission/RESULT) really is
 * Scoring 2.0-derived now, for all 7 recipes, in both FREE and Lunch Rush, and that nothing
 * throws on malformed/empty input. Scoring 2.0's own formula/ordering correctness is
 * `scoringV2/scoringV2.test.ts`'s job, not re-tested here.
 */

const ALL_RECIPE_IDS: readonly RecipeId[] = [
  "margherita",
  "marinara",
  "quattro-formaggi",
  "genovese",
  "bismarck",
  "funghi",
  "fugazza",
];

// `onion` (fugazza) is the only ingredient gated behind a Mastery unlock (see
// src/data/ingredients.ts) -- owning it explicitly here keeps every one of the 7 recipes
// selectable regardless of the test's own totalStars, since availability is orthogonal to what
// this suite is actually testing (the authority boundary, not progression gating).
const ALL_INGREDIENT_IDS: readonly string[] = [...STARTER_INGREDIENT_IDS, "onion"];

function pizzaWith(overrides: Partial<PizzaState>): PizzaState {
  return { ...createEmptyPizza(), ...overrides };
}

function ring(radius: number, count: number, amount = 0.02): SauceDeposit[] {
  const deposits: SauceDeposit[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    deposits.push({ x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, amount });
  }
  return deposits;
}

/** A physically-recreated-the-Reference pizza for `recipeId` -- exact sauce fixture, exact
 *  piece positions. Mirrors scoringV2.test.ts's own `referenceLikePizzaForRecipe`, kept
 *  independent (not imported from a .test.ts module) since this file tests a different layer
 *  (the reducer's authority boundary, not the scoring formula itself). */
function perfectPizzaForRecipe(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`Missing Reference fixture for ${recipeId}`);
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `${recipeId}-perfect-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
  });
}

function goodPizzaForRecipe(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`Missing Reference fixture for ${recipeId}`);
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: ring(28, 24, 0.02),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `${recipeId}-good-${gi}-${i}`,
        ingredientId: group.ingredientId,
        x: p.x + (i % 2 === 0 ? -3 : 3),
        y: p.y + (i % 2 === 0 ? 3 : -3),
      })),
    ),
  });
}

/**
 * Completion Gate Phase 1: a "poor" pizza for this suite's Dex BEST comparison must still
 * PASS the gate (every required ingredient at least at its own `minCount`, sauce above the
 * gate's own minimum floor -- see ../logic/completionGate.ts) while still scoring badly under
 * Scoring 2.0 -- otherwise this is no longer "a worse but real round," it's a FAILED one, which
 * this suite's BEST-never-lowers assertion isn't about. `ring(25, 16)` (a small, tight blob
 * rather than the Reference's own full-dough spread) clears the gate's sauce floor but stays
 * well below the "poor" sauce tier boundary (../logic/sauceEvaluation.ts's
 * `COVERAGE_POOR_RATIO`), and every required piece is placed (never fewer than `minCount`) but
 * clustered in one corner instead of matched to the Reference's own positions.
 */
function poorPizzaForRecipe(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`Missing Reference fixture for ${recipeId}`);
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: ring(25, 16, 0.02),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((_, i) => ({
        id: `${recipeId}-poor-${gi}-${i}`,
        ingredientId: group.ingredientId,
        x: 10 + (i % 3) * 4,
        y: 10 + (i % 3) * 4,
      })),
    ),
  });
}

/** Directly swaps in `recipe`/`order`/`pizza` -> START_BAKE -> CONFIRM_BAKE at the recipe's own
 *  perfect-zone midpoint. START_BAKE has no making-flow gate (`case "START_BAKE": return
 *  {...state, phase: "BAKE"}`), so this is a legitimate way to drive the reducer straight to
 *  RESULT for a specific canonical `pizza` without replaying every PREPARE step through the UI
 *  action sequence -- CONFIRM_BAKE's own scoring logic only ever reads `state.recipe` and the
 *  `pizza` it's handed, never `makingStep`. Bypasses `SELECT_RECIPE` (and therefore Economy &
 *  Progression 1.0 EP1's recipe-unlock chain gate, src/state/progression.ts's
 *  `isRecipeAvailable`) entirely and deliberately, per this file's own top comment: this suite
 *  tests the CONFIRM_BAKE authority boundary for all 7 recipes, which is orthogonal to
 *  progression gating -- exactly like the ownership axis already was, and exactly like this
 *  same function already bypasses `makingStep`. */
function playToResultForRecipe(recipeId: RecipeId, pizza: PizzaState): GameState {
  const recipe = getRecipe(recipeId);
  const order = findOrderForRecipe(recipeId);
  if (!recipe || !order) throw new Error(`Unknown recipe ${recipeId}`);
  let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX, ALL_INGREDIENT_IDS);
  // Pizza Cutting 1.0 Phase 2: `createInitialGameState` always seeds margherita's own
  // CUT-enabled profile (../data/orders.ts's `preferFirst`) -- re-resolve `cookingProfile`/
  // `cutState` for the *actual* `recipeId` under test, same fix as
  // gameReducer.completionGate.test.ts's own `playToResultForRecipe`.
  const cookingProfile = getCookingProfile(recipeId);
  state = { ...state, recipe, order, pizza, cookingProfile, cutState: createCutState(cookingProfile.cutConfig) };
  state = gameReducer(state, { type: "START_BAKE" });
  const { start, end } = state.recipe.bakeTarget;
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: Math.round((start + end) / 2) });
  return walkPostBakeToResult(state);
}

describe("A1 Authority Cutover: state.score is Scoring 2.0-derived (gameReducer integration)", () => {
  it.each(ALL_RECIPE_IDS)(
    "%s: CONFIRM_BAKE produces an authoritative state.score exactly derived from Scoring 2.0's totalScore",
    (recipeId) => {
      const state = playToResultForRecipe(recipeId, perfectPizzaForRecipe(recipeId));
      expect(state.phase).toBe("RESULT");
      expect(state.score).not.toBeNull();
      expect(state.scoringV2Result).not.toBeNull();
      expect(state.scoringV2Result?.available).toBe(true);
      expect(state.scoringV2Result?.totalScore).not.toBeNull();
      // The authority boundary itself: state.score.total is *exactly* Scoring 2.0's own total,
      // not independently (re)computed.
      expect(state.score?.total).toBe(state.scoringV2Result?.totalScore);
      expect(Number.isFinite(state.score?.total)).toBe(true);
      expect(state.score?.stars).toBeGreaterThanOrEqual(1);
      expect(state.score?.stars).toBeLessThanOrEqual(5);
    },
  );

  it.each(ALL_RECIPE_IDS)(
    "%s: authoritative state.score.total orders perfect > good > poor",
    (recipeId) => {
      const perfect = playToResultForRecipe(recipeId, perfectPizzaForRecipe(recipeId));
      const good = playToResultForRecipe(recipeId, goodPizzaForRecipe(recipeId));
      const poor = playToResultForRecipe(recipeId, poorPizzaForRecipe(recipeId));

      expect(perfect.score?.total as number).toBeGreaterThan(good.score?.total as number);
      expect(good.score?.total as number).toBeGreaterThan(poor.score?.total as number);
    },
  );

  it("empty pizza never throws and produces a finite, low authoritative score (Bake alone still scores when baked inside the target zone)", () => {
    let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX, ALL_INGREDIENT_IDS);
    state = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "margherita" });
    state = gameReducer(state, { type: "START_BAKE" });
    expect(() => gameReducer(state, { type: "CONFIRM_BAKE", value: 70 })).not.toThrow();
    const result = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(result.score).not.toBeNull();
    expect(Number.isFinite(result.score?.total)).toBe(true);
    // Sauce/Pieces/Recipe are all 0 for a genuinely empty pizza -- only Bake (20/100 weight,
    // needs no pizza content, just `bakeResult` vs. `recipe.bakeTarget`) contributes, since 70
    // falls inside Margherita's own 60-80 perfect zone.
    expect(result.score?.total).toBe(20);
    expect(result.score?.stars).toBe(1);
  });

  it("FREE: ResultPanel-facing state.score comes from Scoring 2.0 in a non-Mission round", () => {
    const state = playToResultForRecipe("margherita", perfectPizzaForRecipe("margherita"));
    expect(state.isMissionRound).toBe(false);
    expect(state.score?.total).toBe(state.scoringV2Result?.totalScore);
  });

  it("Lunch Rush: MissionServePanel-facing state.score comes from the same authoritative CONFIRM_BAKE path as FREE", () => {
    let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX, ALL_INGREDIENT_IDS);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.isMissionRound).toBe(true);
    const recipeId = state.recipe.id;
    state = { ...state, pizza: perfectPizzaForRecipe(recipeId) };
    state = gameReducer(state, { type: "START_BAKE" });
    const { start, end } = state.recipe.bakeTarget;
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: Math.round((start + end) / 2) });
    state = walkPostBakeToResult(state);

    expect(state.phase).toBe("RESULT");
    expect(state.score?.total).toBe(state.scoringV2Result?.totalScore);
    expect(Number.isFinite(state.score?.total)).toBe(true);
  });

  it("Dex BEST: a better replay raises BEST, a worse replay never lowers it, under the new authority", () => {
    const good = playToResultForRecipe("margherita", goodPizzaForRecipe("margherita"));
    const afterGood = gameReducer(good, { type: "REGISTER_TO_DEX" });
    const entryAfterGood = afterGood.dex.find((e) => e.recipeId === "margherita");
    expect(entryAfterGood?.bestScore).toBe(good.score?.total);

    // A worse round (poor pizza) registered next must never lower BEST.
    const poor = playToResultForRecipe("margherita", poorPizzaForRecipe("margherita"));
    const poorWithDex = { ...poor, dex: afterGood.dex };
    const afterPoor = gameReducer(poorWithDex, { type: "REGISTER_TO_DEX" });
    const entryAfterPoor = afterPoor.dex.find((e) => e.recipeId === "margherita");
    expect(entryAfterPoor?.bestScore).toBe(entryAfterGood?.bestScore);
    expect(entryAfterPoor?.bestStars).toBe(entryAfterGood?.bestStars);
    expect(entryAfterPoor?.timesMade).toBe(3);

    // A better round (perfect pizza) afterward must raise BEST.
    const perfect = playToResultForRecipe("margherita", perfectPizzaForRecipe("margherita"));
    const perfectWithDex = { ...perfect, dex: afterPoor.dex };
    const afterPerfect = gameReducer(perfectWithDex, { type: "REGISTER_TO_DEX" });
    const entryAfterPerfect = afterPerfect.dex.find((e) => e.recipeId === "margherita");
    expect(entryAfterPerfect?.bestScore as number).toBeGreaterThan(entryAfterGood?.bestScore as number);
  });

  it("progression: totalStars/isRecipeAvailable derive from the new Scoring 2.0-driven Dex bestStars unchanged (formula-agnostic, per Audit section 4)", () => {
    const perfect = playToResultForRecipe("margherita", perfectPizzaForRecipe("margherita"));
    const after = gameReducer(perfect, { type: "REGISTER_TO_DEX" });
    const entry = after.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestStars).toBe(perfect.score?.stars);
    // Recipes remain gated purely by ownedIngredientIds, never by which formula produced a
    // Dex entry's stars (getRecipe/isRecipeAvailable are pure and untouched by this cutover).
    const bismarck = getRecipe("bismarck");
    expect(bismarck).toBeDefined();
  });

  it("retry: RETRY_SAME_RECIPE/PLAY_AGAIN reset score and scoringV2Result to null for a fresh round", () => {
    const resultState = playToResultForRecipe("margherita", perfectPizzaForRecipe("margherita"));
    expect(resultState.score).not.toBeNull();
    expect(resultState.scoringV2Result).not.toBeNull();

    const retried = gameReducer(resultState, { type: "RETRY_SAME_RECIPE" });
    expect(retried.score).toBeNull();
    expect(retried.scoringV2Result).toBeNull();

    const playedAgain = gameReducer(resultState, { type: "PLAY_AGAIN" });
    expect(playedAgain.score).toBeNull();
    expect(playedAgain.scoringV2Result).toBeNull();
  });

  it("malformed pizza (non-array toppings/sauceDeposits) fails closed on Sauce/Pieces/Recipe, never throws", () => {
    let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX, ALL_INGREDIENT_IDS);
    state = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "margherita" });
    const malformedPizza = {
      ...createEmptyPizza(),
      toppings: null as unknown as PizzaState["toppings"],
      sauceDeposits: "not-an-array" as unknown as PizzaState["sauceDeposits"],
    };
    state = { ...state, pizza: malformedPizza };
    state = gameReducer(state, { type: "START_BAKE" });
    expect(() => gameReducer(state, { type: "CONFIRM_BAKE", value: 70 })).not.toThrow();
    const result = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(Number.isFinite(result.score?.total)).toBe(true);
    // Same reasoning as the empty-pizza case above: malformed toppings/sauceDeposits are
    // sanitized to empty by Scoring 2.0's own boundary (../logic/scoringV2/boundary.ts), so
    // Sauce/Pieces/Recipe all read 0 -- only Bake (needs no pizza content) still contributes.
    expect(result.score?.total).toBe(20);
  });
});
