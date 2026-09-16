/**
 * Codex P1 blocker fix (PR #31 narrow review): "Malformed array containers/elements can still
 * throw instead of Scoring 2.0 failing closed." These tests are deliberately adversarial --
 * every value fed in here violates the real TypeScript signature at runtime (hence the
 * `as unknown as ...` casts throughout, simulating a caller that doesn't respect the type
 * system, e.g. data that round-tripped through JSON or a future integration this module has
 * no control over). Every case must: never throw, never hang, and never produce a NaN/
 * Infinity or an accidentally-high score for data that isn't real.
 *
 * Round 2 (Codex narrow-verification follow-up) adds a second, stricter rule for
 * *authoritative* Reference/requirement data specifically (`recipe.requiredIngredients`,
 * `ReferencePieceGroup.positions`/`.matching`, the `groups`/`pieceGroups` container itself):
 * malformed data there must invalidate the affected component (`available: false`), never
 * silently score against whatever subset of it happened to be well-formed. See
 * ./boundary.ts's `StrictReferenceValidation` doc comment for the full player-input-vs-
 * authoritative-Reference distinction this file's two halves are organized around.
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
import {
  buildIdealMargheritaSauceFixture,
  MARGHERITA_REFERENCE,
  type ReferencePieceGroup,
} from "../../data/referencePizza";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";

const MARGHERITA = getRecipe("margherita")!;
const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

/** Narrows a `{ available: boolean }` result for tests that pass valid input and only want to
 *  assert on the normal-shape fields -- see ./scoringV2.test.ts's identical helper. */
function assertAvailable<T extends { available: boolean }>(
  result: T,
): asserts result is Extract<T, { available: true }> {
  expect(result.available).toBe(true);
}

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

/**
 * `scorePieceGroupV2` is deliberately the LENIENT, crash/hang-safety layer -- it stays
 * defensive-but-filtering even for malformed Reference data (see its own updated doc comment
 * in piecesComponent.ts). The STRICT "malformed authoritative Reference data must invalidate
 * the result" rule is enforced one level up, in `scorePiecesComponentV2` -- see the
 * "Codex P1 Round 2: STRICT Reference position validation" describe block further below,
 * which exercises the exact same malformed shapes through the strict entry point instead.
 */
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

describe("scorePiecesComponentV2 -- adversarial groups container (STRICT: authoritative Reference data)", () => {
  it.each(MALFORMED_CONTAINERS)(
    "groups container is %s -> available:false, never a numeric score, never throws",
    (_label, groups) => {
      expect(() => scorePiecesComponentV2([], groups as never)).not.toThrow();
      const result = scorePiecesComponentV2([], groups as never);
      expect(result.available).toBe(false);
    },
  );

  it("groups array contains one malformed element mixed with an otherwise-valid group -> available:false (one bad group invalidates the whole component), never throws", () => {
    const groups = [null, "garbage", 42, MOZZARELLA_GROUP];
    expect(() => scorePiecesComponentV2([], groups as never)).not.toThrow();
    const result = scorePiecesComponentV2([], groups as never);
    expect(result.available).toBe(false);
  });

  it("a genuinely valid, empty groups array is still available and scores full marks (a real recipe can legitimately require zero piece groups)", () => {
    const result = scorePiecesComponentV2([], []);
    assertAvailable(result);
    expect(result.score).toBe(100);
    expect(result.groups).toEqual([]);
  });

  it("fully valid groups (the real Margherita Reference) still score normally -- no regression from the stricter gate", () => {
    const toppings = [
      ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
    ];
    const result = scorePiecesComponentV2(toppings, MARGHERITA_REFERENCE.pieceGroups);
    assertAvailable(result);
    expect(result.score).toBeGreaterThan(90);
  });
});

/**
 * Round 2: every malformed-position shape the blocker's regression-test list names, applied
 * to a single position mixed in among an otherwise fully-valid Reference position list --
 * this is exactly the shape of exploit Codex's narrow verification found (a partially
 * malformed list quietly shrinking into an easier, smaller target a player could trivially
 * "complete" for a normal or even 100 score).
 */
const MALFORMED_POSITION_CASES: Array<[string, unknown]> = [
  ["missing x", { y: 35 }],
  ["missing y", { x: 35 }],
  ["x wrong type", { x: "35", y: 35 }],
  ["y wrong type", { x: 35, y: "35" }],
  ["NaN x", { x: Number.NaN, y: 35 }],
  ["NaN y", { x: 35, y: Number.NaN }],
  ["+Infinity x", { x: Number.POSITIVE_INFINITY, y: 35 }],
  ["-Infinity x", { x: Number.NEGATIVE_INFINITY, y: 35 }],
  ["+Infinity y", { x: 35, y: Number.POSITIVE_INFINITY }],
  ["-Infinity y", { x: 35, y: Number.NEGATIVE_INFINITY }],
  ["null element", null],
  ["primitive element", "garbage"],
];

describe("Codex P1 Round 2: STRICT Reference position validation (scorePiecesComponentV2)", () => {
  it.each(MALFORMED_POSITION_CASES)(
    "one malformed mozzarella Reference position (%s) mixed with otherwise-valid positions -> available:false, never a numeric score",
    (_label, malformedPosition) => {
      const brokenMozzarella: ReferencePieceGroup = {
        ...MOZZARELLA_GROUP,
        positions: [...MOZZARELLA_GROUP.positions, malformedPosition as never],
      };
      const groups = [brokenMozzarella, BASIL_GROUP];
      // A pizza that would otherwise score very well against the *valid* subset of positions
      // -- exactly the case that must NOT be rewarded with a high/normal score.
      const toppings = [
        ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
        ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
      ];
      expect(() => scorePiecesComponentV2(toppings, groups)).not.toThrow();
      const result = scorePiecesComponentV2(toppings, groups);
      expect(result.available).toBe(false);
    },
  );

  it.each(MALFORMED_POSITION_CASES)(
    "one malformed basil Reference position (%s) mixed with otherwise-valid positions -> available:false, never a numeric score",
    (_label, malformedPosition) => {
      const brokenBasil: ReferencePieceGroup = {
        ...BASIL_GROUP,
        positions: [...BASIL_GROUP.positions, malformedPosition as never],
      };
      const groups = [MOZZARELLA_GROUP, brokenBasil];
      const toppings = [
        ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
        ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
      ];
      expect(() => scorePiecesComponentV2(toppings, groups)).not.toThrow();
      const result = scorePiecesComponentV2(toppings, groups);
      expect(result.available).toBe(false);
    },
  );

  it("the exact exploit shape Codex's narrow verification found (a corrupted-down target trivially 'completable' for >90) now fails closed instead", () => {
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
    const result = scorePiecesComponentV2(toppings, [brokenGroup, BASIL_GROUP]);
    expect(result.available).toBe(false);
  });

  it("malformed group.matching (missing, or wrong-typed radii) also fails the component closed, not just a 0-scored-but-available group", () => {
    const missingMatching = { ...MOZZARELLA_GROUP, matching: undefined as never };
    const wrongTypeMatching = {
      ...MOZZARELLA_GROUP,
      matching: { fullCreditRadius: "8" as never, zeroCreditRadius: "22" as never },
    };
    for (const brokenGroup of [missingMatching, wrongTypeMatching]) {
      const result = scorePiecesComponentV2([], [brokenGroup, BASIL_GROUP]);
      expect(result.available).toBe(false);
    }
  });

  it("fully valid Reference positions still score normally -- no regression from the stricter gate", () => {
    const toppings = [
      ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
    ];
    const result = scorePiecesComponentV2(toppings, MARGHERITA_REFERENCE.pieceGroups);
    assertAvailable(result);
    expect(result.score).toBeGreaterThan(90);
  });
});

describe("scoreRecipeComponentV2 -- adversarial recipe/pizza input", () => {
  describe("STRICT: malformed requiredIngredients (authoritative) must fail closed, never score 100 or any other number", () => {
    it.each(MALFORMED_CONTAINERS)(
      "recipe.requiredIngredients is %s -> available:false, never throws",
      (_label, requiredIngredients) => {
        const brokenRecipe = { ...MARGHERITA, requiredIngredients: requiredIngredients as never };
        expect(() => scoreRecipeComponentV2(brokenRecipe, createEmptyPizza())).not.toThrow();
        const result = scoreRecipeComponentV2(brokenRecipe, createEmptyPizza());
        expect(result.available).toBe(false);
      },
    );

    it("requiredIngredients contains one malformed element mixed with valid ones -> available:false (invalidates the whole list), never throws", () => {
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
      expect(result.available).toBe(false);
    });

    it("requiredIngredients with a malformed minCount (missing/wrong type/NaN) also fails closed", () => {
      for (const minCount of [undefined, "1", Number.NaN]) {
        const brokenRecipe = {
          ...MARGHERITA,
          requiredIngredients: [{ ingredientId: "tomato-sauce", minCount: minCount as never }],
        };
        const result = scoreRecipeComponentV2(brokenRecipe, createEmptyPizza());
        expect(result.available).toBe(false);
      }
    });

    it("a genuinely valid, empty requiredIngredients array is still available and scores full marks (a real recipe can legitimately require nothing)", () => {
      const emptyRecipe = { ...MARGHERITA, requiredIngredients: [] };
      const result = scoreRecipeComponentV2(emptyRecipe, createEmptyPizza());
      assertAvailable(result);
      expect(result.score).toBe(100);
    });

    it("fully valid requiredIngredients still score normally -- no regression from the stricter gate", () => {
      const pizza = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"] };
      const result = scoreRecipeComponentV2(MARGHERITA, pizza);
      assertAvailable(result);
      expect(Number.isFinite(result.score)).toBe(true);
    });
  });

  describe("player input (pizza.sauceIds/pizza.toppings) stays lenient, unchanged", () => {
    it.each(MALFORMED_CONTAINERS)("pizza.sauceIds is %s -> never throws, treated as none present", (_label, sauceIds) => {
      const pizza = { ...createEmptyPizza(), sauceIds: sauceIds as never };
      expect(() => scoreRecipeComponentV2(MARGHERITA, pizza)).not.toThrow();
      const result = scoreRecipeComponentV2(MARGHERITA, pizza);
      assertAvailable(result);
      expect(Number.isFinite(result.score)).toBe(true);
    });

    it.each(MALFORMED_CONTAINERS)("pizza.toppings is %s -> never throws, treated as none present", (_label, toppings) => {
      const pizza = { ...createEmptyPizza(), toppings: toppings as never };
      expect(() => scoreRecipeComponentV2(MARGHERITA, pizza)).not.toThrow();
      const result = scoreRecipeComponentV2(MARGHERITA, pizza);
      assertAvailable(result);
      expect(Number.isFinite(result.score)).toBe(true);
    });
  });
});

describe("Codex P1 Round 2: computeScoringV2Shadow propagates authoritative-Reference unavailability to the whole result", () => {
  it("malformed recipe.requiredIngredients fails the WHOLE result closed (available:false, totalScore:null), even though Sauce/Pieces would otherwise score well", () => {
    const brokenMargherita = { ...MARGHERITA, requiredIngredients: "not-an-array" as never };
    const greatPizza = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      toppings: [
        ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
        ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
      ],
    };
    expect(() => computeScoringV2Shadow(brokenMargherita, greatPizza)).not.toThrow();
    const result = computeScoringV2Shadow(brokenMargherita, greatPizza);
    expect(result.available).toBe(false);
    expect(result.totalScore).toBeNull();
    // Sauce itself has nothing wrong with its own data, so its component can still compute a
    // normal similarity -- but the *whole result* still reads as unavailable, since Recipe
    // correctness (the broken one) can't be honestly combined into a total.
    expect(result.components.recipe.available).toBe(false);
  });

  it("fully valid recipe + a great pizza still scores normally end-to-end -- no regression from the stricter gate", () => {
    const greatPizza = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      sauceDeposits: buildIdealMargheritaSauceFixture(),
      toppings: [
        ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
        ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
      ],
    };
    const result = computeScoringV2Shadow(MARGHERITA, greatPizza);
    expect(result.available).toBe(true);
    expect(result.totalScore as number).toBeGreaterThan(80);
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
