import { describe, expect, it } from "vitest";
import { FREE_COOK_BAKE_TARGET } from "../data/freeCook";
import { RECIPES } from "../data/recipes";
import { postBakeSteps } from "../data/cookingProfiles";
import { classifyBake } from "../logic/bake";
import { bakeCompletionFailure, evaluatePizzaCompletion } from "../logic/completionGate";
import { resolveFreeCookPizza, withFreeCookBakeWindow } from "../logic/discovery/freeCook";
import { computeScoringV2, toLegacyScoreBreakdown } from "../logic/scoringV2";
import { finalizeRound, type FinalizeRoundInput } from "./finalizeRound";
import { gameReducer, type GameState } from "./gameReducer";
import { consumePizzaInventory } from "./inventory";
import { completionPolicyForRound } from "./roundKind";
import {
  atBake,
  atBakeFreeWith,
  BAKE_LEVELS,
  bakeValueFor,
  confirmBake,
  PIZZA_VARIANTS,
  ROUND_MODES,
  UNMATCHED_FREE_PIZZAS,
  type RoundMode,
} from "./testSupport/confirmBakeMatrix";

/**
 * Cooking Steps 2.0 CS-1b (Issue #294, PR-C): `finalizeRound` was extracted from CONFIRM_BAKE with no
 * behavior change. The proof is structured so that adding a recipe needs NO snapshot to be regenerated:
 *
 *   1. `legacyFinalize` below is the pre-extraction inline algorithm, kept verbatim as a test-only
 *      oracle (built from the same primitives the reducer used: the matcher, Scoring 2.0, the
 *      Completion Gate, `consumePizzaInventory`). Every `RECIPES` entry is run through the real
 *      reducer in all four modes and three bakes, and compared with the oracle -- the recipe list is
 *      derived, never pinned.
 *   2. Mode-independent invariants (exactly-once consumption, the #256 skip, no mutation).
 *
 * The one-time before/after proof on the original code (every field of the whole `GameState`,
 * 672 cases, byte-identical) is recorded in docs/reports/TETO_COOKING-STEPS-2.0_CS-1B_Result.md.
 */

/** The pre-extraction CONFIRM_BAKE finalization, verbatim (oracle). */
function legacyFinalize(state: GameState, value: number) {
  const pizza = { ...state.pizza, bakeResult: value };
  const freeCook = state.freeCook ? resolveFreeCookPizza(pizza, state.dex) : null;
  if (freeCook && freeCook.kind !== "MATCHED") {
    return {
      matched: false as const,
      pizza,
      score: null,
      bakeState: classifyBake(value, state.recipe.bakeTarget),
      scoringV2Result: null,
      completion: freeCook.kind === "FAILED" ? freeCook.completion : { status: "PASS" as const },
      inventory: consumePizzaInventory(pizza, state.inventory),
      recipe: state.recipe,
    };
  }
  const recipe = freeCook ? freeCook.recipe : state.recipe;
  const judged = freeCook ? FREE_COOK_BAKE_TARGET : recipe.bakeTarget;
  const scoringV2Result = computeScoringV2(recipe, pizza);
  return {
    matched: true as const,
    pizza,
    recipe,
    bakeState: classifyBake(value, judged),
    scoringV2Result,
    score: toLegacyScoreBreakdown(scoringV2Result, value, judged),
    completion: evaluatePizzaCompletion(
      freeCook ? withFreeCookBakeWindow(recipe) : recipe,
      pizza,
      state.isMissionRound ? "order" : completionPolicyForRound(state),
    ),
    inventory: consumePizzaInventory(pizza, state.inventory),
  };
}

function inputOf(state: GameState, bakeValue: number): FinalizeRoundInput {
  return {
    recipe: state.recipe,
    pizza: state.pizza,
    bakeValue,
    freeCook: state.freeCook,
    isMissionRound: state.isMissionRound,
    roundKind: state.roundKind,
    dex: state.dex,
    inventory: state.inventory,
  };
}

describe("finalizeRound == the pre-extraction CONFIRM_BAKE, for every recipe x mode x bake", () => {
  it("covers every recipe in RECIPES (derived, not pinned) in all four modes", () => {
    expect(RECIPES.length).toBeGreaterThan(0);
    expect(ROUND_MODES).toHaveLength(4);
    expect(BAKE_LEVELS).toHaveLength(3);
  });

  for (const mode of ROUND_MODES) {
    it(`${mode}: finalizeRound and the reducer agree with the oracle on every recipe and bake`, () => {
      const cases = RECIPES.flatMap((recipe) =>
        PIZZA_VARIANTS.flatMap((variant) => BAKE_LEVELS.map((level) => ({ recipe, variant, level }))),
      );
      for (const { recipe, variant, level } of cases) {
        const label = `${mode} / ${recipe.id} / ${variant} / ${level}`;
        const before = atBake(mode, recipe.id, variant);
        expect(before.phase, label).toBe("BAKE");
        const value = bakeValueFor(mode, before, level);
        const expected = legacyFinalize(before, value);
        const finalized = finalizeRound(inputOf(before, value));

        expect(finalized.kind, label).toBe(expected.matched ? "SCORED" : "UNMATCHED_FREE_COOK");
        expect(finalized.pizza, label).toEqual(expected.pizza);
        expect(finalized.bakeState, label).toEqual(expected.bakeState);
        expect(finalized.completion, label).toEqual(expected.completion);
        expect(finalized.inventory, label).toEqual(expected.inventory);
        if (finalized.kind === "SCORED") {
          expect(finalized.recipe, label).toBe(expected.recipe);
          expect(finalized.scoringV2Result, label).toEqual(expected.scoringV2Result);
          expect(finalized.score, label).toEqual(expected.score);
        }

        // The reducer applies exactly that finalization (Dinner clears score / completion by design).
        const after = confirmBake(before, value);
        expect(after.inventory, label).toEqual(expected.inventory);
        expect(after.pizza.bakeResult, label).toBe(value);
        if (mode === "dinner") {
          expect([after.score, after.scoringV2Result, after.completion], label).toEqual([null, null, null]);
        } else {
          expect(after.score, label).toEqual(expected.score);
          expect(after.scoringV2Result, label).toEqual(expected.scoringV2Result);
          expect(after.completion, label).toEqual(expected.completion);
          expect(after.bakeState, label).toEqual(expected.bakeState);
        }
      }
    }, 120_000);
  }

  it("a short order passes the 'recipe' policy but fails Lunch Rush's 'order' policy (the mode wiring is real)", () => {
    const multi = RECIPES.filter((r) => r.requiredIngredients.some((q) => q.minCount > 1));
    expect(multi.length).toBeGreaterThan(0);
    const recipe = multi[0];
    const guided = atBake("guided", recipe.id, "partial");
    const rush = atBake("lunchRush", recipe.id, "partial");
    const value = bakeValueFor("guided", guided, "good");
    const g = finalizeRound(inputOf(guided, value));
    const l = finalizeRound(inputOf(rush, value));
    expect(g.completion).toEqual(evaluatePizzaCompletion(recipe, g.pizza, "recipe"));
    expect(l.completion).toEqual(evaluatePizzaCompletion(recipe, l.pizza, "order"));
    expect(g.completion.status).toBe("PASS");
    expect(l.completion.status).toBe("FAILED");
  });
});

describe("Free Cooking pizzas the matcher does not resolve (the non-MATCHED branch)", () => {
  for (const [name, pizza] of Object.entries(UNMATCHED_FREE_PIZZAS)) {
    for (const level of BAKE_LEVELS) {
      it(`${name} / ${level}: UNMATCHED_FREE_COOK or SCORED agrees with the oracle`, () => {
        const before = atBakeFreeWith(pizza);
        const value = bakeValueFor("free", before, level);
        const expected = legacyFinalize(before, value);
        const finalized = finalizeRound(inputOf(before, value));
        expect(finalized.kind).toBe(expected.matched ? "SCORED" : "UNMATCHED_FREE_COOK");
        expect(finalized.completion).toEqual(expected.completion);
        expect(finalized.inventory).toEqual(expected.inventory);
        expect(finalized.bakeState).toEqual(expected.bakeState);
        if (finalized.kind === "UNMATCHED_FREE_COOK") {
          // The reducer keeps the sentinel recipe, leaves the round unscored, and ends it at RESULT.
          const after = confirmBake(before, value);
          expect([after.score, after.scoringV2Result, after.phase]).toEqual([null, null, "RESULT"]);
          expect(after.recipe).toBe(before.recipe);
          expect(after.inventory).toEqual(finalized.inventory);
        }
      });
    }
  }

  it("the set covers a FAILED and a non-FAILED unmatched pizza (both side-effect paths run)", () => {
    const kinds = new Set<string>();
    for (const pizza of Object.values(UNMATCHED_FREE_PIZZAS)) {
      for (const level of BAKE_LEVELS) {
        const before = atBakeFreeWith(pizza);
        const finalized = finalizeRound(inputOf(before, bakeValueFor("free", before, level)));
        if (finalized.kind === "UNMATCHED_FREE_COOK") kinds.add(finalized.freeCook.kind);
      }
    }
    expect(kinds.has("FAILED")).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe("what stays in CONFIRM_BAKE (phase, CUT skip, exactly-once, purity)", () => {
  it("lands on RESULT when the bake failed (#256), else on the first post-BAKE step; never both", () => {
    for (const mode of ["guided", "lunchRush"] as RoundMode[]) {
      for (const recipe of RECIPES) {
        for (const level of BAKE_LEVELS) {
          const before = atBake(mode, recipe.id);
          const after = confirmBake(before, bakeValueFor(mode, before, level));
          const steps = postBakeSteps(before.cookingProfile);
          const skipped = bakeCompletionFailure(after.completion!) !== null;
          const label = `${mode} / ${recipe.id} / ${level}`;
          if (skipped || steps.length === 0) {
            expect(after.phase, label).toBe("RESULT");
          } else {
            expect([after.phase, after.makingStep], label).toEqual(["POST_BAKE", steps[0]]);
          }
        }
      }
    }
  }, 120_000);

  it("a repeated CONFIRM_BAKE consumes nothing a second time (the BAKE phase guard)", () => {
    for (const mode of ROUND_MODES) {
      const recipe = RECIPES[0];
      const before = atBake(mode, recipe.id);
      const once = confirmBake(before, bakeValueFor(mode, before, "good"));
      expect(once.phase).not.toBe("BAKE");
      const twice = gameReducer(once, { type: "CONFIRM_BAKE", value: 50, now: 1 });
      expect(twice, mode).toBe(once);
    }
  });

  it("is pure: the input state is not mutated, and equal inputs give equal results", () => {
    const before = atBake("guided", RECIPES[0].id);
    const input = inputOf(before, bakeValueFor("guided", before, "good"));
    const snapshot = JSON.stringify(input);
    const first = finalizeRound(input);
    const second = finalizeRound(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(first).toEqual(second);
    expect(first.pizza).not.toBe(input.pizza);
    expect(first.pizza.bakeResult).toBe(input.bakeValue);
    expect(input.pizza.bakeResult).toBe(before.pizza.bakeResult);
  });
});
