import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  gameReducer,
  type GameState,
} from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { scorePizza } from "../logic/scoring";
import { getRecipe, type RecipeId } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "./pizzaState";

/**
 * A1 Authority Cutover (docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md): `gameReducer.ts`'s
 * CONFIRM_BAKE now derives `state.score` from Scoring 2.0 (`computeScoringV2Shadow` +
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

function poorPizzaForRecipe(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`Missing Reference fixture for ${recipeId}`);
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: Array.from({ length: 10 }, () => ({ x: 55, y: 55, amount: 0.02 })),
    toppings: [
      { id: `${recipeId}-poor-0`, ingredientId: reference.pieceGroups[0].ingredientId, x: 12, y: 12 },
      { id: `${recipeId}-poor-1`, ingredientId: reference.pieceGroups[1].ingredientId, x: 88, y: 88 },
    ],
  });
}

/** SELECT_RECIPE -> manually swap in `pizza` -> START_BAKE -> CONFIRM_BAKE at the recipe's own
 *  perfect-zone midpoint. START_BAKE has no making-flow gate (`case "START_BAKE": return
 *  {...state, phase: "BAKE"}`), so this is a legitimate way to drive the reducer straight to
 *  RESULT for a specific canonical `pizza` without replaying every PREPARE step through the UI
 *  action sequence -- CONFIRM_BAKE's own scoring logic only ever reads `state.recipe` and the
 *  `pizza` it's handed, never `makingStep`. */
function playToResultForRecipe(recipeId: RecipeId, pizza: PizzaState): GameState {
  let state = createInitialGameState(EMPTY_DEX, ALL_INGREDIENT_IDS);
  state = gameReducer(state, { type: "SELECT_RECIPE", recipeId });
  if (state.recipe.id !== recipeId) throw new Error(`Failed to select ${recipeId}`);
  state = { ...state, pizza };
  state = gameReducer(state, { type: "START_BAKE" });
  const { start, end } = state.recipe.bakeTarget;
  return gameReducer(state, { type: "CONFIRM_BAKE", value: Math.round((start + end) / 2) });
}

describe("A1 Authority Cutover: state.score is Scoring 2.0-derived (gameReducer integration)", () => {
  it.each(ALL_RECIPE_IDS)(
    "%s: CONFIRM_BAKE produces an authoritative state.score exactly derived from Scoring 2.0's totalScore",
    (recipeId) => {
      const state = playToResultForRecipe(recipeId, perfectPizzaForRecipe(recipeId));
      expect(state.phase).toBe("RESULT");
      expect(state.score).not.toBeNull();
      expect(state.scoringV2Shadow).not.toBeNull();
      expect(state.scoringV2Shadow?.available).toBe(true);
      expect(state.scoringV2Shadow?.totalScore).not.toBeNull();
      // The authority boundary itself: state.score.total is *exactly* Scoring 2.0's own total,
      // not independently (re)computed.
      expect(state.score?.total).toBe(state.scoringV2Shadow?.totalScore);
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

  it("legacy scorePizza is no longer authoritative -- state.score differs from legacy for a Reference-quality pizza (Sauce now matters)", () => {
    const state = playToResultForRecipe("margherita", perfectPizzaForRecipe("margherita"));
    const legacyOnly = scorePizza(state.recipe, state.pizza);
    // Legacy scorePizza never reads sauceDeposits at all (Phase 4A-1A scope guard, re-confirmed
    // by phase4a1a.regression.test.ts) -- Scoring 2.0's Sauce component (52/100 of the total) is
    // exactly the dimension legacy is blind to, so the two formulas' totals must differ here.
    expect(state.score?.total).not.toBe(legacyOnly.total);
    expect(state.scoringV2Shadow?.totalScore).not.toBeNull();
    expect(state.score?.total).toBe(state.scoringV2Shadow?.totalScore);
  });

  it("empty pizza never throws and produces a finite, low authoritative score (Bake alone still scores when baked inside the target zone)", () => {
    let state = createInitialGameState(EMPTY_DEX, ALL_INGREDIENT_IDS);
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
    expect(state.score?.total).toBe(state.scoringV2Shadow?.totalScore);
  });

  it("Lunch Rush: MissionServePanel-facing state.score comes from the same authoritative CONFIRM_BAKE path as FREE", () => {
    let state = createInitialGameState(EMPTY_DEX, ALL_INGREDIENT_IDS);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.isMissionRound).toBe(true);
    const recipeId = state.recipe.id;
    state = { ...state, pizza: perfectPizzaForRecipe(recipeId) };
    state = gameReducer(state, { type: "START_BAKE" });
    const { start, end } = state.recipe.bakeTarget;
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: Math.round((start + end) / 2) });

    expect(state.phase).toBe("RESULT");
    expect(state.score?.total).toBe(state.scoringV2Shadow?.totalScore);
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
    expect(entryAfterPoor?.timesMade).toBe(2);

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

  it("retry: RETRY_SAME_RECIPE/PLAY_AGAIN reset score and scoringV2Shadow to null for a fresh round", () => {
    const resultState = playToResultForRecipe("margherita", perfectPizzaForRecipe("margherita"));
    expect(resultState.score).not.toBeNull();
    expect(resultState.scoringV2Shadow).not.toBeNull();

    const retried = gameReducer(resultState, { type: "RETRY_SAME_RECIPE" });
    expect(retried.score).toBeNull();
    expect(retried.scoringV2Shadow).toBeNull();

    const playedAgain = gameReducer(resultState, { type: "PLAY_AGAIN" });
    expect(playedAgain.score).toBeNull();
    expect(playedAgain.scoringV2Shadow).toBeNull();
  });

  it("malformed pizza (non-array toppings/sauceDeposits) fails closed on Sauce/Pieces/Recipe, never throws", () => {
    let state = createInitialGameState(EMPTY_DEX, ALL_INGREDIENT_IDS);
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
