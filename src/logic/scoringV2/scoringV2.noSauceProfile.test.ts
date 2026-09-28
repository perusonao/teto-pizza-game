import { describe, expect, it } from "vitest";
import {
  BREAKFAST_PIZZA_REFERENCE,
  TONNO_E_CIPOLLA_REFERENCE,
  getReferencePizza,
} from "../../data/referencePizza";
import { getRecipe, RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluatePizzaCompletion } from "../completionGate";
import { qualityMultiplierForScore } from "../pitzReward";
import { starsFromTotal } from "../scoring";
import { LUNCH_RUSH_RULESET_VERSION } from "../../shared/lunchRushScoring";
import {
  combineWeightedComponents,
  computeScoringV2,
  type ComputeScoringV2Options,
  SCORING_V2_RULESET_VERSION,
  SCORING_V2_WEIGHT_PROFILES,
  toLegacyScoreBreakdown,
} from "./index";
import type { ScoringReferencePizza } from "./types";

/**
 * TQ-1B (Issue #263, Owner Decision OD-TQ-S1 = option B): the no-sauce weight profile.
 *
 * No production recipe is made without a sauce yet (Aussie ships in TQ-1D), so these tests use a
 * synthetic no-sauce recipe -- the Aussie ingredient shape (bacon, egg, mozzarella, onion) under a
 * synthetic id -- with a synthetic Reference whose piece groups are copied from reviewed production
 * References (breakfast-pizza's mozzarella/egg/bacon, tonno-e-cipolla's onion) and whose sauce is
 * `null`. It is passed through `computeScoringV2`'s `options.reference` seam.
 */

const BREAKFAST = getRecipe("breakfast-pizza")!;
const groupOf = (ref: ScoringReferencePizza, id: string) => ref.pieceGroups.find((g) => g.ingredientId === id)!;
const ONION_GROUP = groupOf(TONNO_E_CIPOLLA_REFERENCE, "onion");
const PIECE_GROUPS = [
  groupOf(BREAKFAST_PIZZA_REFERENCE, "mozzarella"),
  groupOf(BREAKFAST_PIZZA_REFERENCE, "egg"),
  groupOf(BREAKFAST_PIZZA_REFERENCE, "bacon"),
  ONION_GROUP,
];

const SYN_ID = "syn-no-sauce" as RecipeId;
const SYN_RECIPE: Recipe = {
  ...BREAKFAST,
  id: SYN_ID,
  nameJa: "テスト用ソースなしピザ",
  requiredIngredients: PIECE_GROUPS.map((g) => ({ ingredientId: g.ingredientId, minCount: g.positions.length })),
};
const SYN_REFERENCE: ScoringReferencePizza = { recipeId: SYN_ID, sauce: null, pieceGroups: PIECE_GROUPS };
const MID_BAKE = (SYN_RECIPE.bakeTarget.start + SYN_RECIPE.bakeTarget.end) / 2;

function pieces(dx = 0, keep: (i: number) => boolean = () => true) {
  return PIECE_GROUPS.flatMap((g, gi) =>
    g.positions
      .map((p, i) => ({ id: `syn-${gi}-${i}`, ingredientId: g.ingredientId, x: p.x + (i % 2 === 0 ? -dx : dx), y: p.y + (i % 2 === 0 ? dx : -dx) }))
      .filter((_, i) => keep(i)),
  );
}

function noSaucePizza(overrides: Partial<PizzaState> = {}): PizzaState {
  return { ...createEmptyPizza(), sauceIds: [], sauceDeposits: [], toppings: pieces(), bakeResult: MID_BAKE, ...overrides };
}

function score(pizza: PizzaState, recipe: Recipe = SYN_RECIPE, reference: ScoringReferencePizza | null = SYN_REFERENCE) {
  const result = computeScoringV2(recipe, pizza, { reference });
  const legacy = toLegacyScoreBreakdown(result, pizza.bakeResult, recipe.bakeTarget);
  return { result, legacy };
}

describe("TQ-1B: weight profiles", () => {
  it("STANDARD is the unchanged B1 split; NO_SAUCE moves exactly the sauce weight to pieces", () => {
    const { STANDARD, NO_SAUCE } = SCORING_V2_WEIGHT_PROFILES;
    expect(STANDARD).toEqual({ id: "STANDARD", sauce: 52, pieces: 16, recipe: 12, bake: 20 });
    expect(NO_SAUCE).toEqual({ id: "NO_SAUCE", sauce: 0, pieces: 68, recipe: 12, bake: 20 });
    for (const p of [STANDARD, NO_SAUCE]) expect(p.sauce + p.pieces + p.recipe + p.bake).toBe(100);
    expect(NO_SAUCE.pieces).toBe(STANDARD.sauce + STANDARD.pieces);
    expect(NO_SAUCE.recipe).toBe(STANDARD.recipe);
    expect(NO_SAUCE.bake).toBe(STANDARD.bake);
  });

  it("versions do not change (OD-TQ-S2 / OD-TQ-S3)", () => {
    expect(SCORING_V2_RULESET_VERSION).toBe("phase-4a-2-shadow-4-quantity");
    expect(LUNCH_RUSH_RULESET_VERSION).toBe("lunch-rush-v1");
  });

  it("every production recipe still scores through STANDARD", () => {
    for (const id of ["margherita", "pizza-bianca", "quattro-formaggi", "fugazza", "new-haven-apizza"] as const) {
      const recipe = getRecipe(id)!;
      const ref = getReferencePizza(id)!;
      const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: [ref.sauce.ingredientId], bakeResult: 60 };
      expect(computeScoringV2(recipe, pizza).weightProfile).toBe("STANDARD");
    }
  });
});

describe("TQ-1B: a no-sauce recipe is scored accurately", () => {
  it("the ideal no-sauce pizza scores 100 / ★5 through NO_SAUCE, with sauce not applicable", () => {
    const { result, legacy } = score(noSaucePizza());
    expect(result.available).toBe(true);
    expect(result.weightProfile).toBe("NO_SAUCE");
    expect(result.components.sauce.available).toBe(false);
    expect(result.totalScore).toBeCloseTo(100, 9);
    expect(legacy.stars).toBe(5);
  });

  it("the total is exactly Pieces 68 / Recipe 12 / Bake 20 times the quantity factor", () => {
    const pizza = noSaucePizza({ toppings: pieces(4) });
    const { result } = score(pizza);
    const c = result.components;
    if (!c.pieces.available || !c.recipe.available || !c.bake.available || !c.quantity.available) throw new Error("unavailable");
    const expected =
      combineWeightedComponents({ sauce: 0, pieces: c.pieces.score, recipe: c.recipe.score, bake: c.bake.score }, SCORING_V2_WEIGHT_PROFILES.NO_SAUCE) *
      c.quantity.factor *
      100;
    expect(result.totalScore).toBeCloseTo(expected, 9);
  });

  it("careless pieces cost 0.68 x the pieces loss (quantity unchanged)", () => {
    const ideal = score(noSaucePizza()).result;
    const careless = score(noSaucePizza({ toppings: pieces(10) })).result;
    if (!ideal.components.pieces.available || !careless.components.pieces.available) throw new Error("unavailable");
    const lost = ideal.components.pieces.score - careless.components.pieces.score;
    expect(lost).toBeGreaterThan(10);
    expect(ideal.totalScore! - careless.totalScore!).toBeCloseTo(lost * 0.68, 6);
  });

  it("too few pieces degrade the total through the quantity factor", () => {
    const { result } = score(noSaucePizza({ toppings: pieces(0, (i) => i === 0) }));
    if (!result.components.quantity.available) throw new Error("unavailable");
    expect(result.components.quantity.factor).toBeLessThan(1);
    expect(result.totalScore!).toBeLessThan(score(noSaucePizza()).result.totalScore!);
  });

  it("the bake cap still applies: raw or burnt never reads ★5", () => {
    for (const bake of [SYN_RECIPE.bakeTarget.start - 15, SYN_RECIPE.bakeTarget.end + 15]) {
      expect(score(noSaucePizza({ bakeResult: bake })).legacy.stars).toBeLessThanOrEqual(4);
    }
  });

  it("painting a sauce on a no-sauce recipe never raises its score", () => {
    const ideal = score(noSaucePizza()).result.totalScore!;
    const sauced = score(noSaucePizza({ sauceIds: ["tomato-sauce"], sauceDeposits: [{ x: 50, y: 50, amount: 0.5 }] })).result;
    expect(sauced.components.sauce.available).toBe(false);
    expect(sauced.totalScore!).toBeLessThanOrEqual(ideal);
  });
});

describe("TQ-1B: equal skill => equal stars (Gate 11-point comparison)", () => {
  const { STANDARD, NO_SAUCE } = SCORING_V2_WEIGHT_PROFILES;
  const at = (x: number) => ({
    sauceRecipe: combineWeightedComponents({ sauce: x, pieces: x, recipe: 100, bake: 100 }, STANDARD) * 100,
    noSauceRecipe: combineWeightedComponents({ sauce: 0, pieces: x, recipe: 100, bake: 100 }, NO_SAUCE) * 100,
  });

  it("0 star mismatches and 0 Pitz-band mismatches over x = 0, 10, ..., 100", () => {
    for (let x = 0; x <= 100; x += 10) {
      const { sauceRecipe, noSauceRecipe } = at(x);
      expect(noSauceRecipe).toBeCloseTo(sauceRecipe, 9);
      expect(starsFromTotal(noSauceRecipe)).toBe(starsFromTotal(sauceRecipe));
      expect(qualityMultiplierForScore(noSauceRecipe)).toBe(qualityMultiplierForScore(sauceRecipe));
    }
  });

  it("negative controls: the rejected options give free stars at zero skill", () => {
    const proportional = ((0 * 16 + 100 * 12 + 100 * 20) / 48);
    const sauceAsFull = (100 * 52 + 0 * 16 + 100 * 12 + 100 * 20) / 100;
    expect(starsFromTotal(proportional)).toBe(3);
    expect(starsFromTotal(sauceAsFull)).toBe(4);
    expect(starsFromTotal(at(0).noSauceRecipe)).toBe(1);
  });
});

describe("TQ-1B: thresholds and other authorities are untouched", () => {
  it("★ thresholds and Pitz bands are the same numbers", () => {
    expect([90, 89.999, 75, 74.999, 60, 59.999, 40, 39.999, 0].map(starsFromTotal)).toEqual([5, 4, 4, 3, 3, 2, 2, 1, 1]);
    expect([90, 75, 60, 40, 0].map(qualityMultiplierForScore)).toEqual([1.2, 1.0, 0.8, 0.5, 0]);
  });

  it("Completion Gate: a no-sauce recipe passes without sauce and still fails a missing piece or a bad bake", () => {
    expect(evaluatePizzaCompletion(SYN_RECIPE, noSaucePizza()).status).toBe("PASS");
    const missing = evaluatePizzaCompletion(SYN_RECIPE, noSaucePizza({ toppings: pieces().filter((t) => t.ingredientId !== "egg") }));
    expect(missing).toMatchObject({ status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: "egg" });
    expect(evaluatePizzaCompletion(SYN_RECIPE, noSaucePizza({ bakeResult: SYN_RECIPE.bakeTarget.end + 40 }))).toMatchObject({ status: "FAILED", reason: "OVERBAKED" });
  });

  it("Dinner minimumStars: every threshold S = 1..5 is reachable by a no-sauce pizza (today's formula caps it at ★2)", () => {
    const reachable = new Set<number>();
    for (let x = 0; x <= 100; x += 1) {
      reachable.add(starsFromTotal(combineWeightedComponents({ sauce: 0, pieces: x, recipe: 100, bake: 100 }, SCORING_V2_WEIGHT_PROFILES.NO_SAUCE) * 100));
    }
    expect([...reachable].sort()).toEqual([1, 2, 3, 4, 5]);
    const withoutProfile = combineWeightedComponents({ sauce: 0, pieces: 100, recipe: 100, bake: 100 }, SCORING_V2_WEIGHT_PROFILES.STANDARD) * 100;
    expect(starsFromTotal(withoutProfile)).toBe(2);
  });

  it("Lunch Rush and Dinner read only the total/stars, never the weight profile", () => {
    const sources = import.meta.glob<string>(["../../shared/lunchRushScoring.ts", "../../mission/**/*.ts", "!../../mission/**/*.test.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(3);
    for (const [path, source] of Object.entries(sources)) {
      expect(source.includes("weightProfile") || source.includes("SCORING_V2_WEIGHT_PROFILES"), path).toBe(false);
    }
  });
});

describe("TQ-1B: adversarial Reference data fails closed", () => {
  it("a sauce-less Reference for a recipe that requires a sauce is not scored", () => {
    const margherita = getRecipe("margherita")!;
    const ref = getReferencePizza("margherita")!;
    const { result } = score(noSaucePizza(), margherita, { ...ref, sauce: null });
    expect(result.available).toBe(false);
    expect(result.totalScore).toBeNull();
    expect(result.weightProfile).toBeNull();
  });

  it("an explicit `reference: null` means no Reference (unavailable), never a default", () => {
    const { result } = score(noSaucePizza(), SYN_RECIPE, null);
    expect(result.available).toBe(false);
    expect(result.weightProfile).toBeNull();
  });

  it("omitting the option reads the production Reference exactly as before", () => {
    const recipe = getRecipe("funghi")!;
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    expect(computeScoringV2(recipe, pizza)).toEqual(computeScoringV2(recipe, pizza, { reference: getReferencePizza("funghi")! }));
  });

  it("a Reference for another recipe fails closed instead of producing a hybrid score (Codex review on #271)", () => {
    const margherita = getRecipe("margherita")!;
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    const result = computeScoringV2(margherita, pizza, { reference: getReferencePizza("funghi")! });
    expect(result.available).toBe(false);
    expect(result.totalScore).toBeNull();
    expect(result.weightProfile).toBeNull();
    expect(result.unavailableReason).toContain("別のレシピ");
    const noSauce = score(noSaucePizza(), SYN_RECIPE, { ...SYN_REFERENCE, recipeId: "margherita" }).result;
    expect(noSauce.available).toBe(false);
  });

  it("a malformed injected Reference fails closed and never throws (Codex review on #271)", () => {
    const malformed: unknown[] = [
      { recipeId: SYN_ID, pieceGroups: PIECE_GROUPS },
      { recipeId: SYN_ID, sauce: undefined, pieceGroups: PIECE_GROUPS },
      { recipeId: SYN_ID, sauce: {}, pieceGroups: PIECE_GROUPS },
      { recipeId: SYN_ID, sauce: { ingredientId: "tomato-sauce", quantity: Number.NaN, coverage: 0.5 }, pieceGroups: PIECE_GROUPS },
      { recipeId: SYN_ID, sauce: { ingredientId: 7, quantity: 0.5, coverage: 0.5 }, pieceGroups: PIECE_GROUPS },
      { recipeId: SYN_ID, sauce: "tomato-sauce", pieceGroups: PIECE_GROUPS },
      { recipeId: SYN_ID, sauce: null, pieceGroups: "not-an-array" },
      "not-an-object",
      42,
    ];
    for (const reference of malformed) {
      let result: ReturnType<typeof computeScoringV2> | undefined;
      expect(() => {
        result = computeScoringV2(SYN_RECIPE, noSaucePizza(), { reference: reference as ScoringReferencePizza });
      }).not.toThrow();
      expect(result!.available, JSON.stringify(reference)).toBe(false);
      expect(result!.totalScore).toBeNull();
      expect(result!.weightProfile).toBeNull();
    }
  });

  it("a Reference whose nested contents belong to another recipe fails closed (Codex review on #271)", () => {
    const margherita = getRecipe("margherita")!;
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    const funghiWithMargheritaId = { ...getReferencePizza("funghi")!, recipeId: "margherita" as const };
    expect(computeScoringV2(margherita, pizza, { reference: funghiWithMargheritaId }).available).toBe(false);
    const foreignSauce = { ...getReferencePizza("margherita")!, sauce: { ...getReferencePizza("margherita")!.sauce, ingredientId: "pesto" } };
    expect(computeScoringV2(margherita, pizza, { reference: foreignSauce }).available).toBe(false);
    const foreignGroup = { ...SYN_REFERENCE, pieceGroups: [...PIECE_GROUPS, groupOf(TONNO_E_CIPOLLA_REFERENCE, "tuna")] };
    expect(score(noSaucePizza(), SYN_RECIPE, foreignGroup).result.available).toBe(false);
  });

  it("a role-swapped Reference (sauce as a piece group, a piece ingredient as the sauce) fails closed (Codex review on #271)", () => {
    const margherita = getRecipe("margherita")!;
    const ref = getReferencePizza("margherita")!;
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    const sauceAsGroup = { ...ref, pieceGroups: [...ref.pieceGroups, { ...ref.pieceGroups[0], ingredientId: "tomato-sauce" }] };
    expect(computeScoringV2(margherita, pizza, { reference: sauceAsGroup }).available).toBe(false);
    const pieceAsSauce = { ...ref, sauce: { ...ref.sauce, ingredientId: "mozzarella" } };
    expect(computeScoringV2(margherita, pizza, { reference: pieceAsSauce }).available).toBe(false);
    expect(computeScoringV2(margherita, pizza, { reference: ref }).available).toBe(true);
  });

  it("a Reference missing or duplicating a placed requirement fails closed (Codex review on #271)", () => {
    const margherita = getRecipe("margherita")!;
    const ref = getReferencePizza("margherita")!;
    expect(ref.pieceGroups.length).toBeGreaterThan(1);
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    const missingGroup = { ...ref, pieceGroups: ref.pieceGroups.slice(0, 1) };
    expect(computeScoringV2(margherita, pizza, { reference: missingGroup }).available).toBe(false);
    const duplicatedGroup = { ...ref, pieceGroups: [...ref.pieceGroups, ref.pieceGroups[0]] };
    expect(computeScoringV2(margherita, pizza, { reference: duplicatedGroup }).available).toBe(false);
    const noSauceMissing = { ...SYN_REFERENCE, pieceGroups: SYN_REFERENCE.pieceGroups.slice(1) };
    expect(score(noSaucePizza(), SYN_RECIPE, noSauceMissing).result.available).toBe(false);
    // Every production Reference covers its recipe's placed requirements exactly once.
    for (const recipe of RECIPES) {
      expect(computeScoringV2(recipe, pizza, { reference: getReferencePizza(recipe.id) }).available, recipe.id).toBe(true);
    }
  });

  it("a non-object options argument fails closed instead of throwing (Codex review on #271)", () => {
    const margherita = getRecipe("margherita")!;
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    for (const bad of [null, 0, "reference", true]) {
      const result = computeScoringV2(margherita, pizza, bad as unknown as ComputeScoringV2Options);
      expect(result.available, String(bad)).toBe(false);
      expect(result.totalScore).toBeNull();
    }
    expect(computeScoringV2(margherita, pizza, undefined).available).toBe(true);
    expect(computeScoringV2(margherita, pizza, {}).available).toBe(true);
  });

  it("an out-of-range sauce target fails closed instead of being clamped into a score (Codex review on #271)", () => {
    const margherita = getRecipe("margherita")!;
    const ref = getReferencePizza("margherita")!;
    const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 60 };
    for (const bad of [{ quantity: -1 }, { coverage: 2 }, { quantity: 1.0001 }, { coverage: -0.0001 }]) {
      const result = computeScoringV2(margherita, pizza, { reference: { ...ref, sauce: { ...ref.sauce, ...bad } } });
      expect(result.available, JSON.stringify(bad)).toBe(false);
      expect(result.totalScore).toBeNull();
    }
    for (const edge of [{ quantity: 0, coverage: 0 }, { quantity: 1, coverage: 1 }]) {
      expect(computeScoringV2(margherita, pizza, { reference: { ...ref, sauce: { ...ref.sauce, ...edge } } }).available).toBe(true);
    }
  });

  it("the synthetic recipe without the seam has no Reference (it is not a production recipe)", () => {
    expect(computeScoringV2(SYN_RECIPE, noSaucePizza()).available).toBe(false);
  });
});
