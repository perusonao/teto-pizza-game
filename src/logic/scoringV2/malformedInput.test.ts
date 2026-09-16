/**
 * Codex P1 blocker fix (PR #31 narrow review): "Malformed array containers/elements can still
 * throw instead of Scoring 2.0 failing closed." These tests are deliberately adversarial --
 * every value fed in here violates the real TypeScript signature at runtime (hence the
 * `as unknown as ...` casts throughout, simulating a caller that doesn't respect the type
 * system, e.g. data that round-tripped through JSON or a future integration this module has
 * no control over). Every case must: never throw, never hang, and never produce a NaN/
 * Infinity or an accidentally-high score for data that isn't real.
 */
import { describe, expect, it } from "vitest";
import { computeScoringV2Shadow } from "./index";
import { scorePieceGroupV2, scorePiecesComponentV2 } from "./piecesComponent";
import { scoreRecipeComponentV2 } from "./recipeComponent";
import {
  sanitizeCoordinates,
  sanitizeSauceDeposits,
  sanitizeStringArray,
  sanitizeToppings,
  toSafeArray,
} from "./boundary";
import { getRecipe } from "../../data/recipes";
import { MARGHERITA_REFERENCE, type ReferencePieceGroup } from "../../data/referencePizza";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";

const MARGHERITA = getRecipe("margherita")!;
const [MOZZARELLA_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

/** Every malformed-container shape the P1 blocker names, reused across every sanitizer test
 *  below so each sanitizer is checked against the exact same adversarial matrix. */
const MALFORMED_CONTAINERS: Array<[string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["object instead of array", { not: "an array" }],
  ["string instead of array", "not-an-array"],
  ["number instead of array", 42],
  ["boolean instead of array", true],
];

const MALFORMED_ELEMENTS: Array<[string, unknown]> = [
  ["null element", null],
  ["undefined element", undefined],
  ["primitive number element", 42],
  ["primitive string element", "mozzarella"],
  ["primitive boolean element", true],
  ["missing x/y", { ingredientId: "mozzarella" }],
  ["x wrong type", { x: "50", y: 50, ingredientId: "mozzarella" }],
  ["y wrong type", { x: 50, y: "50", ingredientId: "mozzarella" }],
  ["NaN x", { x: Number.NaN, y: 50, ingredientId: "mozzarella" }],
  ["NaN y", { x: 50, y: Number.NaN, ingredientId: "mozzarella" }],
  ["+Infinity x", { x: Number.POSITIVE_INFINITY, y: 50, ingredientId: "mozzarella" }],
  ["-Infinity x", { x: Number.NEGATIVE_INFINITY, y: 50, ingredientId: "mozzarella" }],
  ["+Infinity y", { x: 50, y: Number.POSITIVE_INFINITY, ingredientId: "mozzarella" }],
  ["-Infinity y", { x: 50, y: Number.NEGATIVE_INFINITY, ingredientId: "mozzarella" }],
];

describe("boundary.ts sanitizers -- malformed containers normalize to []", () => {
  it.each(MALFORMED_CONTAINERS)("toSafeArray(%s) -> []", (_label, value) => {
    expect(() => toSafeArray(value)).not.toThrow();
    expect(toSafeArray(value)).toEqual([]);
  });

  it.each(MALFORMED_CONTAINERS)("sanitizeCoordinates(%s) -> []", (_label, value) => {
    expect(() => sanitizeCoordinates(value)).not.toThrow();
    expect(sanitizeCoordinates(value)).toEqual([]);
  });

  it.each(MALFORMED_CONTAINERS)("sanitizeSauceDeposits(%s) -> []", (_label, value) => {
    expect(() => sanitizeSauceDeposits(value)).not.toThrow();
    expect(sanitizeSauceDeposits(value)).toEqual([]);
  });

  it.each(MALFORMED_CONTAINERS)("sanitizeToppings(%s) -> []", (_label, value) => {
    expect(() => sanitizeToppings(value)).not.toThrow();
    expect(sanitizeToppings(value)).toEqual([]);
  });

  it.each(MALFORMED_CONTAINERS)("sanitizeStringArray(%s) -> []", (_label, value) => {
    expect(() => sanitizeStringArray(value)).not.toThrow();
    expect(sanitizeStringArray(value)).toEqual([]);
  });
});

describe("boundary.ts sanitizers -- malformed elements are dropped, not thrown on", () => {
  it.each(MALFORMED_ELEMENTS)("sanitizeCoordinates drops: %s", (_label, element) => {
    const input = [element, { x: 10, y: 10 }];
    expect(() => sanitizeCoordinates(input)).not.toThrow();
    const result = sanitizeCoordinates(input);
    expect(result).toEqual([{ x: 10, y: 10 }]);
    for (const p of result) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it.each(MALFORMED_ELEMENTS)("sanitizeToppings drops: %s", (_label, element) => {
    const input = [element, { x: 10, y: 10, ingredientId: "basil" }];
    expect(() => sanitizeToppings(input)).not.toThrow();
    const result = sanitizeToppings(input);
    expect(result).toEqual([{ x: 10, y: 10, ingredientId: "basil" }]);
  });

  it.each(MALFORMED_ELEMENTS)("sanitizeSauceDeposits drops (with amount): %s", (_label, element) => {
    const withAmount =
      typeof element === "object" && element !== null ? { ...element, amount: 0.02 } : element;
    const input = [withAmount, { x: 10, y: 10, amount: 0.02 }];
    expect(() => sanitizeSauceDeposits(input)).not.toThrow();
    const result = sanitizeSauceDeposits(input);
    expect(result).toEqual([{ x: 10, y: 10, amount: 0.02 }]);
  });

  it("sanitizeSauceDeposits drops a deposit with a malformed amount (NaN/Infinity/wrong type)", () => {
    const input = [
      { x: 10, y: 10, amount: Number.NaN },
      { x: 20, y: 20, amount: Number.POSITIVE_INFINITY },
      { x: 30, y: 30, amount: "0.02" },
      { x: 40, y: 40, amount: 0.02 },
    ];
    const result = sanitizeSauceDeposits(input);
    expect(result).toEqual([{ x: 40, y: 40, amount: 0.02 }]);
  });

  it("empty array input stays an empty array, for every sanitizer", () => {
    expect(sanitizeCoordinates([])).toEqual([]);
    expect(sanitizeSauceDeposits([])).toEqual([]);
    expect(sanitizeToppings([])).toEqual([]);
    expect(sanitizeStringArray([])).toEqual([]);
  });

  it("mixed valid + invalid elements: only the valid ones survive, in order", () => {
    const input = [
      { x: 1, y: 1, ingredientId: "mozzarella" },
      null,
      { x: Number.NaN, y: 2, ingredientId: "mozzarella" },
      "garbage",
      { x: 3, y: 3, ingredientId: "basil" },
      { x: 4 }, // missing y/ingredientId
    ];
    expect(sanitizeToppings(input)).toEqual([
      { x: 1, y: 1, ingredientId: "mozzarella" },
      { x: 3, y: 3, ingredientId: "basil" },
    ]);
  });
});

describe("scorePieceGroupV2 -- adversarial toppings/group input", () => {
  it.each(MALFORMED_CONTAINERS)("toppings container is %s -> finite 0-ish result, never throws", (_label, toppings) => {
    expect(() => scorePieceGroupV2(toppings as never, MOZZARELLA_GROUP)).not.toThrow();
    const result = scorePieceGroupV2(toppings as never, MOZZARELLA_GROUP);
    expect(result.playerCount).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it.each(MALFORMED_CONTAINERS)("group is %s -> unavailable-shaped 0 result, never throws", (_label, group) => {
    const toppings = [{ id: "m0", ingredientId: "mozzarella", x: 35, y: 35 }];
    expect(() => scorePieceGroupV2(toppings, group as never)).not.toThrow();
    const result = scorePieceGroupV2(toppings, group as never);
    expect(result.score).toBe(0);
    expect(result.placementSimilarity).toBeNull();
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("group.positions malformed (not an array) -> targetCount 0, finite, never throws", () => {
    const brokenGroup = { ...MOZZARELLA_GROUP, positions: "not-an-array" as never };
    expect(() => scorePieceGroupV2([], brokenGroup)).not.toThrow();
    const result = scorePieceGroupV2([], brokenGroup);
    expect(result.targetCount).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("group.positions contains malformed Reference position elements (mixed valid + invalid) -> matches only the valid ones, never hangs, never throws", () => {
    const brokenGroup: ReferencePieceGroup = {
      ...MOZZARELLA_GROUP,
      positions: [
        { x: 35, y: 35 },
        { x: Number.NaN, y: 40 } as never,
        null as never,
        { x: Number.POSITIVE_INFINITY, y: 10 } as never,
        "garbage" as never,
      ],
    };
    const toppings = [{ id: "m0", ingredientId: "mozzarella", x: 35, y: 35 }];
    expect(() => scorePieceGroupV2(toppings, brokenGroup)).not.toThrow();
    const result = scorePieceGroupV2(toppings, brokenGroup);
    expect(result.targetCount).toBe(1); // only the one valid position survives sanitization
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThan(90); // the single valid position is an exact match
  });

  it("group.matching missing entirely -> invalid tolerance band -> 0 score, never throws", () => {
    const brokenGroup = { ...MOZZARELLA_GROUP, matching: undefined as never };
    expect(() => scorePieceGroupV2([], brokenGroup)).not.toThrow();
    expect(scorePieceGroupV2([], brokenGroup).score).toBe(0);
  });

  it("group.matching radii are wrong type (strings) -> invalid tolerance band -> 0 score, never throws", () => {
    const brokenGroup = {
      ...MOZZARELLA_GROUP,
      matching: { fullCreditRadius: "8" as never, zeroCreditRadius: "22" as never },
    };
    expect(() => scorePieceGroupV2([], brokenGroup)).not.toThrow();
    expect(scorePieceGroupV2([], brokenGroup).score).toBe(0);
  });

  it("toppings array contains malformed elements mixed with valid ones -> only valid ones counted, never throws", () => {
    const toppings = [
      { id: "m0", ingredientId: "mozzarella", x: 35, y: 35 },
      null,
      { id: "m1", ingredientId: "mozzarella", x: Number.NaN, y: 40 },
      "not-a-topping",
      { id: "m2", ingredientId: "mozzarella", x: 65, y: 36 },
    ];
    expect(() => scorePieceGroupV2(toppings as never, MOZZARELLA_GROUP)).not.toThrow();
    const result = scorePieceGroupV2(toppings as never, MOZZARELLA_GROUP);
    expect(result.playerCount).toBe(2); // only the two well-formed mozzarella pieces
    expect(Number.isFinite(result.score)).toBe(true);
  });
});

describe("scorePiecesComponentV2 -- adversarial groups container", () => {
  it.each(MALFORMED_CONTAINERS)("groups container is %s -> full marks (no groups to fall short on), never throws", (_label, groups) => {
    expect(() => scorePiecesComponentV2([], groups as never)).not.toThrow();
    const result = scorePiecesComponentV2([], groups as never);
    expect(result.score).toBe(100);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("groups array contains malformed elements mixed with a valid group -> degrades gracefully, never throws", () => {
    const groups = [null, "garbage", 42, MOZZARELLA_GROUP];
    expect(() => scorePiecesComponentV2([], groups as never)).not.toThrow();
    const result = scorePiecesComponentV2([], groups as never);
    expect(result.groups).toHaveLength(4);
    expect(Number.isFinite(result.score)).toBe(true);
  });
});

describe("scoreRecipeComponentV2 -- adversarial recipe/pizza input", () => {
  it.each(MALFORMED_CONTAINERS)("recipe.requiredIngredients is %s -> treated as no requirements, score 100, never throws", (_label, requiredIngredients) => {
    const brokenRecipe = { ...MARGHERITA, requiredIngredients: requiredIngredients as never };
    expect(() => scoreRecipeComponentV2(brokenRecipe, createEmptyPizza())).not.toThrow();
    const result = scoreRecipeComponentV2(brokenRecipe, createEmptyPizza());
    expect(result.score).toBe(100);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("requiredIngredients contains malformed elements mixed with valid ones -> only valid requirements counted, never throws", () => {
    const brokenRecipe = {
      ...MARGHERITA,
      requiredIngredients: [
        { ingredientId: "tomato-sauce", minCount: 1 },
        null,
        "garbage",
        42,
        { minCount: 1 }, // missing ingredientId
      ] as never,
    };
    expect(() => scoreRecipeComponentV2(brokenRecipe, createEmptyPizza())).not.toThrow();
    const result = scoreRecipeComponentV2(brokenRecipe, createEmptyPizza());
    expect(result.requiredTypesTotal).toBe(1);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it.each(MALFORMED_CONTAINERS)("pizza.sauceIds is %s -> never throws, treated as none present", (_label, sauceIds) => {
    const pizza = { ...createEmptyPizza(), sauceIds: sauceIds as never };
    expect(() => scoreRecipeComponentV2(MARGHERITA, pizza)).not.toThrow();
    expect(Number.isFinite(scoreRecipeComponentV2(MARGHERITA, pizza).score)).toBe(true);
  });

  it.each(MALFORMED_CONTAINERS)("pizza.toppings is %s -> never throws, treated as none present", (_label, toppings) => {
    const pizza = { ...createEmptyPizza(), toppings: toppings as never };
    expect(() => scoreRecipeComponentV2(MARGHERITA, pizza)).not.toThrow();
    expect(Number.isFinite(scoreRecipeComponentV2(MARGHERITA, pizza).score)).toBe(true);
  });
});

describe("computeScoringV2Shadow -- full public-API adversarial matrix (never throws, never hangs, always finite)", () => {
  it("pizza itself is null -> falls back to an effectively-empty pizza, never throws", () => {
    expect(() => computeScoringV2Shadow(MARGHERITA, null as unknown as PizzaState)).not.toThrow();
    const result = computeScoringV2Shadow(MARGHERITA, null as unknown as PizzaState);
    expect(result.available).toBe(true); // Margherita has a Reference; the *pizza* was the malformed part
    expect(result.totalScore).toBe(0);
  });

  it("pizza itself is undefined -> falls back to an effectively-empty pizza, never throws", () => {
    expect(() => computeScoringV2Shadow(MARGHERITA, undefined as unknown as PizzaState)).not.toThrow();
    expect(computeScoringV2Shadow(MARGHERITA, undefined as unknown as PizzaState).totalScore).toBe(0);
  });

  it.each(MALFORMED_CONTAINERS)("pizza.sauceDeposits is %s -> finite result, never throws", (_label, sauceDeposits) => {
    const pizza = { ...createEmptyPizza(), sauceDeposits: sauceDeposits as never };
    expect(() => computeScoringV2Shadow(MARGHERITA, pizza)).not.toThrow();
    const result = computeScoringV2Shadow(MARGHERITA, pizza);
    expect(result.totalScore).not.toBeNull();
    expect(Number.isFinite(result.totalScore as number)).toBe(true);
  });

  it.each(MALFORMED_CONTAINERS)("pizza.toppings is %s -> finite result, never throws", (_label, toppings) => {
    const pizza = { ...createEmptyPizza(), toppings: toppings as never };
    expect(() => computeScoringV2Shadow(MARGHERITA, pizza)).not.toThrow();
    const result = computeScoringV2Shadow(MARGHERITA, pizza);
    expect(result.totalScore).not.toBeNull();
    expect(Number.isFinite(result.totalScore as number)).toBe(true);
  });

  it("pizza with every collection maximally malformed at once -> still finite, still fails closed, never throws, never hangs", () => {
    const pizza = {
      sauceIds: "not-an-array" as never,
      sauceOrigin: null,
      sauceToken: 0,
      sauceDeposits: [null, "garbage", { x: Number.NaN, y: Number.POSITIVE_INFINITY, amount: Number.NEGATIVE_INFINITY }] as never,
      toppings: [undefined, 42, { ingredientId: "mozzarella" }, { x: Number.NaN, y: Number.NaN, ingredientId: "basil" }] as never,
      bakeResult: null,
    };
    expect(() => computeScoringV2Shadow(MARGHERITA, pizza as unknown as PizzaState)).not.toThrow();
    const result = computeScoringV2Shadow(MARGHERITA, pizza as unknown as PizzaState);
    expect(result.totalScore).not.toBeNull();
    expect(Number.isFinite(result.totalScore as number)).toBe(true);
    expect(result.totalScore).toBe(0); // every collection sanitized down to nothing real
  });

  it("still available:false / totalScore:null for a Reference-unavailable recipe, even with malformed pizza data at the same time", () => {
    const marinara = getRecipe("marinara")!;
    const pizza = { ...createEmptyPizza(), sauceDeposits: "garbage" as never, toppings: null as never };
    expect(() => computeScoringV2Shadow(marinara, pizza)).not.toThrow();
    const result = computeScoringV2Shadow(marinara, pizza);
    expect(result.available).toBe(false);
    expect(result.totalScore).toBeNull();
  });
});

describe("Permutation invariance and Golden Matrix survive the boundary fix unchanged", () => {
  it("valid-input permutation invariance for pieces still holds", () => {
    const toppings = MOZZARELLA_GROUP.positions.map((p, i) => ({
      id: `m${i}`,
      ingredientId: "mozzarella",
      ...p,
    }));
    const shuffled = [toppings[2], toppings[0], toppings[1]];
    expect(scorePieceGroupV2(toppings, MOZZARELLA_GROUP).score).toBeCloseTo(
      scorePieceGroupV2(shuffled, MOZZARELLA_GROUP).score,
      10,
    );
  });

  it("Golden ordering (perfect > good > poor > empty) is unaffected by the sanitization boundary", () => {
    const perfect = computeScoringV2Shadow(
      MARGHERITA,
      { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], sauceDeposits: [], toppings: [
          ...MARGHERITA_REFERENCE.pieceGroups[0].positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
          ...MARGHERITA_REFERENCE.pieceGroups[1].positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
        ] },
    );
    const empty = computeScoringV2Shadow(MARGHERITA, createEmptyPizza());
    expect(perfect.totalScore as number).toBeGreaterThan(empty.totalScore as number);
    expect(empty.totalScore).toBe(0);
  });
});
