import { describe, expect, it } from "vitest";
import { computeScoringV2Shadow, SCORING_V2_RULESET_VERSION } from "./index";
import { scoreBakeComponentV2 } from "./bakeComponent";
import { scoreSauceComponentV2 } from "./sauceComponent";
import { scorePieceGroupV2, scorePiecesComponentV2 } from "./piecesComponent";
import { scoreRecipeComponentV2 } from "./recipeComponent";
import { isValidToleranceBand, safeToleranceSimilarity, safeUnit } from "./tolerance";
import { getRecipe, type RecipeId } from "../../data/recipes";
import {
  buildIdealMargheritaSauceFixture,
  buildIdealSauceFixture,
  getReferencePizza,
  MARGHERITA_REFERENCE,
  type ReferencePieceGroup,
} from "../../data/referencePizza";
import { computeSauceMetrics, emptySauceMetrics } from "../sauceField";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "../../state/pizzaState";

const MARGHERITA = getRecipe("margherita")!;
const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function pizzaWith(overrides: Partial<PizzaState>): PizzaState {
  return { ...createEmptyPizza(), ...overrides };
}

/** Codex P1 blocker fix, Round 2: `scorePiecesComponentV2`/`scoreRecipeComponentV2` can now
 *  return `{ available: false }` (strict authoritative-data validation) alongside their
 *  normal shape -- this narrows a result for tests that pass genuinely valid input and only
 *  want to assert on the normal-shape fields, without repeating an `if (!result.available)
 *  throw` at every call site. */
function assertAvailable<T extends { available: boolean }>(
  result: T,
): asserts result is Extract<T, { available: true }> {
  expect(result.available).toBe(true);
}

function ring(radius: number, count: number, amount = 0.02): SauceDeposit[] {
  const deposits: SauceDeposit[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    deposits.push({ x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, amount });
  }
  return deposits;
}

/** The exact Reference piece positions, at Margherita's required counts -- a "physically
 *  recreated the reference" pizza. */
function referenceLikePizza(): PizzaState {
  return pizzaWith({
    sauceIds: ["tomato-sauce"],
    sauceDeposits: buildIdealMargheritaSauceFixture(),
    toppings: [
      ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      ...BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
    ],
  });
}

describe("tolerance.ts (P1-1 tolerance-band validation)", () => {
  it("isValidToleranceBand rejects zero <= full", () => {
    expect(isValidToleranceBand(10, 10)).toBe(false);
    expect(isValidToleranceBand(10, 5)).toBe(false);
  });

  it("isValidToleranceBand rejects non-finite or negative bounds", () => {
    expect(isValidToleranceBand(Number.NaN, 10)).toBe(false);
    expect(isValidToleranceBand(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidToleranceBand(-1, 10)).toBe(false);
  });

  it("isValidToleranceBand accepts a well-formed band", () => {
    expect(isValidToleranceBand(0, 10)).toBe(true);
    expect(isValidToleranceBand(5, 10)).toBe(true);
  });

  it("safeToleranceSimilarity fails closed (0, never NaN/Infinity) for an invalid band", () => {
    const invalid = [
      safeToleranceSimilarity(5, 10, 10), // zero <= full
      safeToleranceSimilarity(5, 10, 5), // zero <= full
      safeToleranceSimilarity(5, Number.NaN, 10),
      safeToleranceSimilarity(5, -1, 10),
      safeToleranceSimilarity(Number.NaN, 0, 10), // bad distance too
      safeToleranceSimilarity(Number.POSITIVE_INFINITY, 0, 10),
    ];
    for (const value of invalid) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBe(0);
    }
  });

  it("safeToleranceSimilarity is a normal continuous similarity for a valid band", () => {
    expect(safeToleranceSimilarity(0, 5, 20)).toBe(1);
    expect(safeToleranceSimilarity(20, 5, 20)).toBe(0);
    const mid = safeToleranceSimilarity(12, 5, 20);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("safeUnit fails closed for non-finite input", () => {
    expect(safeUnit(Number.NaN)).toBe(0);
    expect(safeUnit(Number.POSITIVE_INFINITY)).toBe(0);
    expect(safeUnit(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(safeUnit(1.5)).toBe(1);
    expect(safeUnit(-0.5)).toBe(0);
  });
});

describe("scoreSauceComponentV2", () => {
  const reference = MARGHERITA_REFERENCE.sauce;

  it("the Reference fixture itself scores near-perfect and finite", () => {
    const metrics = computeSauceMetrics(buildIdealMargheritaSauceFixture());
    const result = scoreSauceComponentV2(metrics, reference);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThan(90);
  });

  it("empty sauce (no deposits) scores 0, not a placeholder-propped-up partial credit", () => {
    const result = scoreSauceComponentV2(emptySauceMetrics(), reference);
    expect(result.score).toBe(0);
    expect(result.quantitySimilarity).toBe(0);
    expect(result.coverageSimilarity).toBe(0);
    // presence gate: the empty-metrics placeholder evenness=1/edgeRatio=0 must not leak
    // through as free credit for sauce that was never applied.
    expect(result.evennessScore).toBe(0);
    expect(result.edgeScore).toBe(0);
  });

  it("too little sauce (a single light dab) scores far below the Reference fixture", () => {
    const metrics = computeSauceMetrics(ring(4, 2, 0.02));
    const tooLittle = scoreSauceComponentV2(metrics, reference);
    const perfect = scoreSauceComponentV2(computeSauceMetrics(buildIdealMargheritaSauceFixture()), reference);
    expect(Number.isFinite(tooLittle.score)).toBe(true);
    expect(tooLittle.score).toBeLessThan(perfect.score);
  });

  it("a concentrated dump (same total quantity as the fixture, all in one spot) scores worse on evenness than the fixture", () => {
    const dumpDeposits: SauceDeposit[] = Array.from({ length: 46 }, () => ({ x: 50, y: 50, amount: 0.02 }));
    const dump = scoreSauceComponentV2(computeSauceMetrics(dumpDeposits), reference);
    const fixture = scoreSauceComponentV2(computeSauceMetrics(buildIdealMargheritaSauceFixture()), reference);
    expect(Number.isFinite(dump.score)).toBe(true);
    expect(dump.evennessScore).toBeLessThan(fixture.evennessScore);
    expect(dump.score).toBeLessThan(fixture.score);
  });

  it("broad but uneven sauce (wide coverage, lumpy density) scores between concentrated-dump and the fixture", () => {
    // A broad ring, revisited unevenly (extra passes over half the ring only).
    const unevenDeposits = [...ring(30, 24, 0.02), ...ring(30, 12, 0.03).slice(0, 6)];
    const uneven = scoreSauceComponentV2(computeSauceMetrics(unevenDeposits), reference);
    const dumpDeposits: SauceDeposit[] = Array.from({ length: 46 }, () => ({ x: 50, y: 50, amount: 0.02 }));
    const dump = scoreSauceComponentV2(computeSauceMetrics(dumpDeposits), reference);
    expect(Number.isFinite(uneven.score)).toBe(true);
    expect(uneven.coverageSimilarity).toBeGreaterThan(dump.coverageSimilarity);
  });

  it("edge/overflow sauce (painted past the target rim) scores a lower edge sub-score than the fixture", () => {
    // Radius 44 sits beyond SAUCE_TARGET_RADIUS (40) but still inside the dough (48) --
    // squarely in the "touched the ear" edge band.
    const edgeDeposits = ring(44, 20, 0.02);
    const edgeCase = scoreSauceComponentV2(computeSauceMetrics(edgeDeposits), reference);
    const fixture = scoreSauceComponentV2(computeSauceMetrics(buildIdealMargheritaSauceFixture()), reference);
    expect(Number.isFinite(edgeCase.score)).toBe(true);
    expect(edgeCase.edgeScore).toBeLessThan(fixture.edgeScore);
  });

  it("PAINT_TEMPORARY-sourced deposits score identically to PAINT-sourced ones for the same deposit shape (Sauce component reads only SauceMetrics, never the interaction kind)", () => {
    // recipeSauceProfiles.ts's PAINT vs PAINT_TEMPORARY only changes the player-facing paint
    // trail visual (PizzaStage.tsx) -- both commit through the exact same COMMIT_SAUCE_DISPENSE
    // path into `sauceDeposits`, so the scoring component (which only ever sees the resulting
    // SauceMetrics) cannot tell them apart, and must not need to.
    const deposits = ring(20, 10, 0.02);
    const a = scoreSauceComponentV2(computeSauceMetrics(deposits), reference);
    const b = scoreSauceComponentV2(computeSauceMetrics([...deposits]), reference);
    expect(a).toEqual(b);
  });
});

describe("scoreBakeComponentV2 (B1)", () => {
  const target = MARGHERITA.bakeTarget; // { start: 60, end: 80 }

  it("ideal: any bakeResult inside the target zone scores a perfect 100, distance 0, state 'perfect'", () => {
    for (const bakeResult of [target.start, (target.start + target.end) / 2, target.end]) {
      const result = scoreBakeComponentV2(bakeResult, target);
      assertAvailable(result);
      expect(result.score).toBe(100);
      expect(result.similarity).toBe(1);
      expect(result.distanceFromIdeal).toBe(0);
      expect(result.bakeState).toBe("perfect");
      expect(result.bakeResult).toBe(bakeResult);
    }
  });

  it("under (raw): below the target zone scores below 100, finite, state 'raw', with a positive distance", () => {
    const result = scoreBakeComponentV2(target.start - 15, target);
    assertAvailable(result);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.bakeState).toBe("raw");
    expect(result.distanceFromIdeal).toBe(15);
  });

  it("over (burnt): above the target zone scores below 100, finite, state 'burnt', with a positive distance", () => {
    const result = scoreBakeComponentV2(target.end + 15, target);
    assertAvailable(result);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.bakeState).toBe("burnt");
    expect(result.distanceFromIdeal).toBe(15);
  });

  it("symmetric nearest-edge model: equal distance below start and above end score identically", () => {
    const raw = scoreBakeComponentV2(target.start - 12, target);
    const burnt = scoreBakeComponentV2(target.end + 12, target);
    assertAvailable(raw);
    assertAvailable(burnt);
    expect(raw.score).toBeCloseTo(burnt.score, 9);
    expect(raw.distanceFromIdeal).toBe(burnt.distanceFromIdeal);
  });

  it("degrades monotonically the further bakeResult drifts from the zone, on both sides", () => {
    const nearRaw = scoreBakeComponentV2(target.start - 5, target);
    const farRaw = scoreBakeComponentV2(target.start - 25, target);
    const nearBurnt = scoreBakeComponentV2(target.end + 5, target);
    const farBurnt = scoreBakeComponentV2(target.end + 25, target);
    assertAvailable(nearRaw);
    assertAvailable(farRaw);
    assertAvailable(nearBurnt);
    assertAvailable(farBurnt);
    expect(nearRaw.score).toBeGreaterThan(farRaw.score);
    expect(nearBurnt.score).toBeGreaterThan(farBurnt.score);
  });

  it("boundary: one tick below start is 'raw' and one tick above end is 'burnt' (classifyBake's own exclusive edges)", () => {
    const justBelow = scoreBakeComponentV2(target.start - 1, target);
    const justAbove = scoreBakeComponentV2(target.end + 1, target);
    assertAvailable(justBelow);
    assertAvailable(justAbove);
    expect(justBelow.bakeState).toBe("raw");
    expect(justAbove.bakeState).toBe("burnt");
    expect(justBelow.score).toBeGreaterThan(90);
    expect(justAbove.score).toBeGreaterThan(90);
  });

  it("malformed: bakeResult null (not yet baked) scores 0, available, state null -- never a crash or NaN", () => {
    const result = scoreBakeComponentV2(null, target);
    assertAvailable(result);
    expect(result.score).toBe(0);
    expect(result.similarity).toBe(0);
    expect(result.bakeState).toBeNull();
    expect(result.bakeResult).toBeNull();
    expect(result.distanceFromIdeal).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "70" as unknown as number, undefined as unknown as number])(
    "malformed: bakeResult %p reads as not-yet-baked, never NaN/throws",
    (malformed) => {
      expect(() => scoreBakeComponentV2(malformed, target)).not.toThrow();
      const result = scoreBakeComponentV2(malformed, target);
      assertAvailable(result);
      expect(result.score).toBe(0);
      expect(result.bakeResult).toBeNull();
    },
  );

  it("malformed: an inverted or zero-width bakeTarget fails the component closed (available:false), never divides by zero", () => {
    const zeroWidth = scoreBakeComponentV2(70, { start: 70, end: 70 });
    const inverted = scoreBakeComponentV2(70, { start: 80, end: 60 });
    expect(zeroWidth.available).toBe(false);
    expect(inverted.available).toBe(false);
  });

  it("malformed: a non-finite bakeTarget fails the component closed", () => {
    const result = scoreBakeComponentV2(70, { start: Number.NaN, end: 80 });
    expect(result.available).toBe(false);
  });

  it("score is always finite and within [0, 100] across a wide sweep of bakeResult values", () => {
    for (let value = -200; value <= 200; value += 5) {
      const result = scoreBakeComponentV2(value, target);
      assertAvailable(result);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("scorePieceGroupV2 / scorePiecesComponentV2", () => {
  function mozzarellaAtReference(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `m${i}`,
      ingredientId: "mozzarella" as const,
      ...MOZZARELLA_GROUP.positions[i % MOZZARELLA_GROUP.positions.length],
    }));
  }

  function mozzarellaFarFromReference(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `far-m${i}`,
      ingredientId: "mozzarella" as const,
      x: 0,
      y: 0,
    }));
  }

  it("Reference-exact mozzarella placement scores near-perfect", () => {
    const toppings = MOZZARELLA_GROUP.positions.map((p, i) => ({
      id: `m${i}`,
      ingredientId: "mozzarella",
      ...p,
    }));
    const result = scorePieceGroupV2(toppings, MOZZARELLA_GROUP);
    assertAvailable(result);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThan(95);
  });

  it("slightly displaced mozzarella (still within the zero-credit radius) scores lower than exact, but above a badly displaced set", () => {
    const exact = scorePieceGroupV2(
      MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      MOZZARELLA_GROUP,
    );
    const slightlyOff = scorePieceGroupV2(
      MOZZARELLA_GROUP.positions.map((p, i) => ({
        id: `m${i}`,
        ingredientId: "mozzarella",
        x: p.x + 6,
        y: p.y + 6,
      })),
      MOZZARELLA_GROUP,
    );
    const badlyOff = scorePieceGroupV2(
      [
        { id: "m0", ingredientId: "mozzarella", x: 5, y: 5 },
        { id: "m1", ingredientId: "mozzarella", x: 95, y: 5 },
        { id: "m2", ingredientId: "mozzarella", x: 5, y: 95 },
      ],
      MOZZARELLA_GROUP,
    );
    assertAvailable(exact);
    assertAvailable(slightlyOff);
    assertAvailable(badlyOff);
    expect(exact.score).toBeGreaterThan(slightlyOff.score);
    expect(slightlyOff.score).toBeGreaterThan(badlyOff.score);
    expect(Number.isFinite(badlyOff.score)).toBe(true);
  });

  it("Reference-exact basil placement scores near-perfect, and displaced basil scores lower", () => {
    const exact = scorePieceGroupV2(
      BASIL_GROUP.positions.map((p, i) => ({ id: `b${i}`, ingredientId: "basil", ...p })),
      BASIL_GROUP,
    );
    const poor = scorePieceGroupV2(
      [
        { id: "b0", ingredientId: "basil", x: 10, y: 10 },
        { id: "b1", ingredientId: "basil", x: 90, y: 90 },
      ],
      BASIL_GROUP,
    );
    assertAvailable(exact);
    assertAvailable(poor);
    expect(exact.score).toBeGreaterThan(90);
    expect(poor.score).toBeLessThan(exact.score);
    expect(Number.isFinite(poor.score)).toBe(true);
  });

  it("missing pieces (none placed) score 0, finite, with a null placementSimilarity", () => {
    const result = scorePieceGroupV2([], MOZZARELLA_GROUP);
    assertAvailable(result);
    expect(result.playerCount).toBe(0);
    expect(result.quantitySimilarity).toBe(0);
    expect(result.placementSimilarity).toBeNull();
    expect(result.score).toBe(0);
  });

  it("an extra piece beyond the target count is still scoreable (not a crash / not NaN)", () => {
    const toppings = [
      ...MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      { id: "m-extra", ingredientId: "mozzarella", x: 50, y: 20 },
    ];
    const result = scorePieceGroupV2(toppings, MOZZARELLA_GROUP);
    assertAvailable(result);
    expect(result.playerCount).toBe(4);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("applies the asymmetric over-quantity placement gate without penalizing exact-count placement", () => {
    const exactExcellent = scorePieceGroupV2(mozzarellaAtReference(3), MOZZARELLA_GROUP);
    const exactPoor = scorePieceGroupV2(mozzarellaFarFromReference(3), MOZZARELLA_GROUP);
    const underExcellent = scorePieceGroupV2(mozzarellaAtReference(2), MOZZARELLA_GROUP);
    assertAvailable(exactExcellent);
    assertAvailable(exactPoor);
    assertAvailable(underExcellent);

    expect(exactExcellent.quantitySimilarity).toBe(1);
    expect(exactExcellent.placementSimilarity).toBe(1);
    expect(exactExcellent.score).toBe(100);
    expect(exactPoor.score).toBeCloseTo(
      30 + (exactPoor.placementSimilarity ?? 0) * 70,
      10,
    );
    expect(underExcellent.quantitySimilarity).toBe(0.75);
    expect(underExcellent.placementSimilarity).toBe(1);
    expect(underExcellent.score).toBe(92.5);
  });

  it("continuously reduces placement influence for one extra, moderate, and severe over-quantity", () => {
    const counts = [3, 4, 5, 9];
    const excellent = counts.map((count) => {
      const result = scorePieceGroupV2(mozzarellaAtReference(count), MOZZARELLA_GROUP);
      assertAvailable(result);
      return result;
    });
    const poor = counts.map((count) => {
      const result = scorePieceGroupV2(mozzarellaFarFromReference(count), MOZZARELLA_GROUP);
      assertAvailable(result);
      return result;
    });

    expect(excellent.map((result) => result.quantitySimilarity)).toEqual([1, 0.75, 0.5, 0]);
    expect(excellent.map((result) => result.score)).toEqual([100, 75, 50, 0]);

    const placementInfluence = excellent.map((result, index) => result.score - poor[index].score);
    expect(placementInfluence[0]).toBeGreaterThan(placementInfluence[1]);
    expect(placementInfluence[1]).toBeGreaterThan(placementInfluence[2]);
    expect(placementInfluence[2]).toBeGreaterThan(placementInfluence[3]);
    expect(placementInfluence[3]).toBeCloseTo(0, 10);
  });

  it("gates a severe over-quantity group even when Hungarian matching finds an excellent subset", () => {
    const result = scorePieceGroupV2(mozzarellaAtReference(9), MOZZARELLA_GROUP);
    assertAvailable(result);
    expect(result.playerCount).toBe(9);
    expect(result.targetCount).toBe(3);
    expect(result.quantitySimilarity).toBe(0);
    expect(result.placementSimilarity).toBe(1);
    expect(result.score).toBe(0);
  });

  it("keeps severe-overquantity scoring permutation-invariant", () => {
    const toppings = mozzarellaAtReference(9);
    const shuffled = [
      toppings[8],
      toppings[1],
      toppings[6],
      toppings[3],
      toppings[0],
      toppings[7],
      toppings[2],
      toppings[5],
      toppings[4],
    ];
    const a = scorePieceGroupV2(toppings, MOZZARELLA_GROUP);
    const b = scorePieceGroupV2(shuffled, MOZZARELLA_GROUP);
    assertAvailable(a);
    assertAvailable(b);
    expect(a).toEqual(b);
  });

  it("same-type piece permutation invariance: shuffling player order never changes the group score", () => {
    const toppings = MOZZARELLA_GROUP.positions.map((p, i) => ({
      id: `m${i}`,
      ingredientId: "mozzarella",
      ...p,
    }));
    const shuffled = [toppings[2], toppings[0], toppings[1]];
    const a = scorePieceGroupV2(toppings, MOZZARELLA_GROUP);
    const b = scorePieceGroupV2(shuffled, MOZZARELLA_GROUP);
    assertAvailable(a);
    assertAvailable(b);
    expect(a.score).toBeCloseTo(b.score, 10);
    expect(a.quantitySimilarity).toBe(b.quantitySimilarity);
  });

  it("scorePieceGroupV2 fails closed (available:false) for an invalid tolerance band, instead of trusting the group's own data", () => {
    const brokenGroup: ReferencePieceGroup = {
      ...MOZZARELLA_GROUP,
      matching: { fullCreditRadius: 30, zeroCreditRadius: 10 }, // zero <= full
    };
    const result = scorePieceGroupV2(
      MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      brokenGroup,
    );
    expect(result.available).toBe(false);
  });

  it("scorePiecesComponentV2 averages across mozzarella + basil and stays finite", () => {
    const pizza = referenceLikePizza();
    const result = scorePiecesComponentV2(pizza.toppings, MARGHERITA_REFERENCE.pieceGroups);
    assertAvailable(result);
    expect(result.groups).toHaveLength(2);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThan(90);
  });
});

describe("scoreRecipeComponentV2 (presence-only, no overlap with Pieces)", () => {
  it("all required ingredient types present (regardless of amount) scores 100", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [
        { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
        { id: "b0", ingredientId: "basil", x: 50, y: 65 },
      ],
    });
    const result = scoreRecipeComponentV2(MARGHERITA, pizza);
    assertAvailable(result);
    expect(result.score).toBe(100);
    expect(result.requiredTypesPresent).toBe(3);
  });

  it("a missing required type lowers the score proportionally", () => {
    const pizza = pizzaWith({ sauceIds: ["tomato-sauce"] }); // no mozzarella, no basil
    const result = scoreRecipeComponentV2(MARGHERITA, pizza);
    assertAvailable(result);
    expect(result.requiredTypesPresent).toBe(1);
    expect(result.score).toBeCloseTo((1 / 3) * 100, 10);
  });

  it("Recipe correctness does not double-penalize a Pieces-level quantity shortfall: one mozzarella piece (below the recipe's minCount of 3) scores the same Recipe correctness as three", () => {
    const onePiece = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [
        { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
        { id: "b0", ingredientId: "basil", x: 50, y: 65 },
      ],
    });
    const threePieces = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [
        { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
        { id: "m1", ingredientId: "mozzarella", x: 60, y: 40 },
        { id: "m2", ingredientId: "mozzarella", x: 50, y: 60 },
        { id: "b0", ingredientId: "basil", x: 50, y: 65 },
      ],
    });
    const onePieceRecipe = scoreRecipeComponentV2(MARGHERITA, onePiece);
    const threePiecesRecipe = scoreRecipeComponentV2(MARGHERITA, threePieces);
    assertAvailable(onePieceRecipe);
    assertAvailable(threePiecesRecipe);
    expect(onePieceRecipe.score).toBe(threePiecesRecipe.score);
    expect(onePieceRecipe.score).toBe(100);

    // ...while Pieces itself *does* tell the two apart (the count/placement concern that
    // belongs there, per the Fresh Audit's "no double-penalizing" contract).
    const onePieceGroup = scorePieceGroupV2(onePiece.toppings, MOZZARELLA_GROUP);
    const threePieceGroup = scorePieceGroupV2(threePieces.toppings, MOZZARELLA_GROUP);
    assertAvailable(onePieceGroup);
    assertAvailable(threePieceGroup);
    expect(onePieceGroup.quantitySimilarity).toBeLessThan(threePieceGroup.quantitySimilarity);
  });
});

/**
 * Issue #32: purity -- Recipe must also detect ingredient types the recipe never asked for,
 * not just check presence of required types. See
 * docs/reports/TETO_ISSUE-32_RECIPE-PURITY_Result.md for the formula this pins:
 * `score = (requiredTypesPresent / requiredTypesTotal) * 100 * purityMultiplier`, where
 * `purityMultiplier = 1 - extraTypesCount / usedTypesTotal` (0 when no types are used at all).
 */
describe("scoreRecipeComponentV2 purity (Issue #32 -- extra/wrong ingredient types)", () => {
  it("1: all required types present, zero extras -> unchanged full score (regression pin)", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [
        { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
        { id: "m1", ingredientId: "mozzarella", x: 45, y: 45 },
        { id: "m2", ingredientId: "mozzarella", x: 50, y: 50 },
        { id: "b0", ingredientId: "basil", x: 50, y: 65 },
        { id: "b1", ingredientId: "basil", x: 55, y: 65 },
      ],
    });
    const result = scoreRecipeComponentV2(MARGHERITA, pizza);
    assertAvailable(result);
    expect(result.score).toBe(100);
    expect(result.extraTypesCount).toBe(0);
    expect(result.purityMultiplier).toBe(1);
  });

  it("2: a missing required type (no extras) lowers score via presence only, purity untouched", () => {
    const pizza = pizzaWith({ sauceIds: ["tomato-sauce"], toppings: [] }); // no mozzarella, no basil
    const result = scoreRecipeComponentV2(MARGHERITA, pizza);
    assertAvailable(result);
    expect(result.extraTypesCount).toBe(0);
    expect(result.purityMultiplier).toBe(1);
    expect(result.score).toBeCloseTo((1 / 3) * 100, 10);
  });

  it("3: wrong-type substitution (basil missing, pepperoni placed instead) scores at or below missing-alone -- never identical (closes the Fresh Audit's case F/E parity gap)", () => {
    const missingAlone = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
          { id: "m1", ingredientId: "mozzarella", x: 45, y: 45 },
          { id: "m2", ingredientId: "mozzarella", x: 50, y: 50 },
        ],
      }),
    );
    const wrongSubstitution = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
          { id: "m1", ingredientId: "mozzarella", x: 45, y: 45 },
          { id: "m2", ingredientId: "mozzarella", x: 50, y: 50 },
          { id: "p0", ingredientId: "pepperoni", x: 50, y: 65 },
        ],
      }),
    );
    assertAvailable(missingAlone);
    assertAvailable(wrongSubstitution);
    expect(missingAlone.score).toBeCloseTo((2 / 3) * 100, 10);
    expect(wrongSubstitution.extraTypesCount).toBe(1);
    expect(wrongSubstitution.purityMultiplier).toBeLessThan(1);
    expect(wrongSubstitution.score).toBeLessThan(missingAlone.score);
  });

  it("4: all required types present + one extra unspecified type -> below full, but not zero (no all-or-nothing cliff); extra > no-extra ordering holds", () => {
    const clean = scoreRecipeComponentV2(MARGHERITA, referenceLikePizza());
    const withExtra = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        ...referenceLikePizza(),
        toppings: [...referenceLikePizza().toppings, { id: "x0", ingredientId: "mushroom", x: 20, y: 20 }],
      }),
    );
    assertAvailable(clean);
    assertAvailable(withExtra);
    expect(clean.score).toBe(100);
    expect(withExtra.extraTypesCount).toBe(1);
    expect(withExtra.score).toBeLessThan(clean.score);
    expect(withExtra.score).toBeGreaterThan(0);
    // Pieces/Sauce must never react to a Recipe-level extra ingredient -- responsibility guard.
    const cleanShadow = computeScoringV2Shadow(MARGHERITA, referenceLikePizza());
    const extraShadow = computeScoringV2Shadow(
      MARGHERITA,
      pizzaWith({
        ...referenceLikePizza(),
        toppings: [...referenceLikePizza().toppings, { id: "x0", ingredientId: "mushroom", x: 20, y: 20 }],
      }),
    );
    if (cleanShadow.components.pieces.available && extraShadow.components.pieces.available) {
      expect(extraShadow.components.pieces.score).toBe(cleanShadow.components.pieces.score);
    }
    if (cleanShadow.components.sauce.available && extraShadow.components.sauce.available) {
      expect(extraShadow.components.sauce.score).toBe(cleanShadow.components.sauce.score);
    }
  });

  it("5: severe same-type overquantity (9 mozzarella vs. target 3) never changes Recipe -- purity counts extra TYPES, not extra pieces of an already-required type", () => {
    const normal = scoreRecipeComponentV2(MARGHERITA, referenceLikePizza());
    const overquantity = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        toppings: [
          ...Array.from({ length: 9 }, (_, i) => ({
            id: `m${i}`,
            ingredientId: "mozzarella",
            x: 30 + i * 4,
            y: 40,
          })),
          { id: "b0", ingredientId: "basil", x: 50, y: 65 },
          { id: "b1", ingredientId: "basil", x: 55, y: 65 },
        ],
      }),
    );
    assertAvailable(normal);
    assertAvailable(overquantity);
    expect(overquantity.score).toBe(normal.score);
    expect(overquantity.score).toBe(100);
    expect(overquantity.extraTypesCount).toBe(0);
  });

  it("6: poor placement (correct types, far from Reference spots) does not affect Recipe -- placement stays purely Pieces' concern", () => {
    const goodPlacement = scoreRecipeComponentV2(MARGHERITA, referenceLikePizza());
    const poorPlacement = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 5, y: 5 },
          { id: "m1", ingredientId: "mozzarella", x: 8, y: 5 },
          { id: "m2", ingredientId: "mozzarella", x: 5, y: 8 },
          { id: "b0", ingredientId: "basil", x: 95, y: 95 },
          { id: "b1", ingredientId: "basil", x: 92, y: 95 },
        ],
      }),
    );
    assertAvailable(goodPlacement);
    assertAvailable(poorPlacement);
    expect(poorPlacement.score).toBe(goodPlacement.score);
    expect(poorPlacement.score).toBe(100);
  });

  it("7: empty pizza scores 0 with full purity (no extras exist to detect on nothing)", () => {
    const result = scoreRecipeComponentV2(MARGHERITA, createEmptyPizza());
    assertAvailable(result);
    expect(result.score).toBe(0);
    expect(result.usedTypesTotal).toBe(0);
    expect(result.extraTypesCount).toBe(0);
    expect(result.purityMultiplier).toBe(1);
  });

  it("8: duplicate placements of the same extra type count once, not per-piece (extraTypesCount is type-cardinality, not quantity)", () => {
    const oneExtraPiece = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        ...referenceLikePizza(),
        toppings: [...referenceLikePizza().toppings, { id: "x0", ingredientId: "mushroom", x: 20, y: 20 }],
      }),
    );
    const fiveExtraPieces = scoreRecipeComponentV2(
      MARGHERITA,
      pizzaWith({
        ...referenceLikePizza(),
        toppings: [
          ...referenceLikePizza().toppings,
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `x${i}`,
            ingredientId: "mushroom",
            x: 20 + i,
            y: 20,
          })),
        ],
      }),
    );
    assertAvailable(oneExtraPiece);
    assertAvailable(fiveExtraPieces);
    expect(oneExtraPiece.extraTypesCount).toBe(1);
    expect(fiveExtraPieces.extraTypesCount).toBe(1);
    expect(oneExtraPiece.score).toBe(fiveExtraPieces.score);
  });

  it("9: Bismarck Recipe component (pure function, no Reference fixture needed) -- correct required types score 100, an extra unspecified type lowers it below 100", () => {
    const bismarck = getRecipe("bismarck")!;
    const correct = scoreRecipeComponentV2(
      bismarck,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
          { id: "m1", ingredientId: "mozzarella", x: 45, y: 45 },
          { id: "m2", ingredientId: "mozzarella", x: 50, y: 50 },
          { id: "e0", ingredientId: "egg", x: 50, y: 50 },
        ],
      }),
    );
    const withExtra = scoreRecipeComponentV2(
      bismarck,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 40, y: 40 },
          { id: "m1", ingredientId: "mozzarella", x: 45, y: 45 },
          { id: "m2", ingredientId: "mozzarella", x: 50, y: 50 },
          { id: "e0", ingredientId: "egg", x: 50, y: 50 },
          { id: "p0", ingredientId: "pepperoni", x: 20, y: 20 },
        ],
      }),
    );
    assertAvailable(correct);
    assertAvailable(withExtra);
    expect(correct.score).toBe(100);
    expect(withExtra.extraTypesCount).toBe(1);
    expect(withExtra.score).toBeLessThan(100);

    // Bismarck itself still has no Scoring 2.0 Reference fixture -- the whole Shadow result
    // stays available:false regardless of this purity fix (P0-1 gate untouched).
    const shadow = computeScoringV2Shadow(bismarck, createEmptyPizza());
    expect(shadow.available).toBe(false);
    expect(shadow.totalScore).toBeNull();
  });
});

describe("computeScoringV2Shadow (P0-1 Reference availability + P0-2 canonical entry point)", () => {
  /** B2 PART A (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md section 10):
   *  marinara and funghi now have reviewed Reference geometry -- this example switched to
   *  bismarck (still no Reference) so this "unavailable" pin keeps testing a genuinely
   *  unavailable recipe rather than silently becoming a stale/misleading example. */
  it("unavailable Reference recipe (e.g. bismarck) returns available:false, totalScore:null, and every Reference-dependent component unavailable -- never a fabricated number", () => {
    const bismarck = getRecipe("bismarck")!;
    const result = computeScoringV2Shadow(bismarck, createEmptyPizza());
    expect(result.available).toBe(false);
    expect(result.totalScore).toBeNull();
    expect(result.unavailableReason).not.toBeNull();
    expect(result.components.sauce.available).toBe(false);
    expect(result.components.pieces.available).toBe(false);
    expect(result.components.recipe.available).toBe(false);
    // B1: Bake needs no Reference fixture at all (../../data/recipes.ts's `bakeTarget` is
    // static per-recipe data, defined for all 7 recipes) -- it stays real even when the whole
    // result is unavailable because Sauce/Pieces/Recipe still are (P0-1/B2).
    expect(result.components.bake.available).toBe(true);
  });

  /** B2 PART A/C1: marinara/funghi/genovese/fugazza moved out of this "still unavailable"
   *  list -- see the new "B2 newly covered recipes" describe block below for their own
   *  availability + Golden ordering coverage. */
  it("every recipe still without a Reference fixture is unavailable (bismarck/quattro-formaggi)", () => {
    for (const id of ["quattro-formaggi", "bismarck"] as const) {
      const recipe = getRecipe(id)!;
      const result = computeScoringV2Shadow(recipe, createEmptyPizza());
      expect(result.available).toBe(false);
      expect(result.totalScore).toBeNull();
    }
  });

  it("B1: Bake is real for Margherita and folds into totalScore -- ideal bake scores higher than raw/burnt", () => {
    const { start, end } = MARGHERITA.bakeTarget;
    const idealResult = computeScoringV2Shadow(
      MARGHERITA,
      pizzaWith({ ...referenceLikePizza(), bakeResult: (start + end) / 2 }),
    );
    const rawResult = computeScoringV2Shadow(
      MARGHERITA,
      pizzaWith({ ...referenceLikePizza(), bakeResult: start - 20 }),
    );
    const burntResult = computeScoringV2Shadow(
      MARGHERITA,
      pizzaWith({ ...referenceLikePizza(), bakeResult: end + 20 }),
    );

    expect(idealResult.components.bake.available).toBe(true);
    expect(idealResult.components.bake.available && idealResult.components.bake.score).toBe(100);
    expect(idealResult.totalScore).not.toBeNull();
    expect(rawResult.totalScore).not.toBeNull();
    expect(burntResult.totalScore).not.toBeNull();
    expect(idealResult.totalScore as number).toBeGreaterThan(rawResult.totalScore as number);
    expect(idealResult.totalScore as number).toBeGreaterThan(burntResult.totalScore as number);
  });

  it("carries the ruleset version so a stored/compared result can't be misread against a different formula", () => {
    const result = computeScoringV2Shadow(MARGHERITA, referenceLikePizza());
    expect(result.rulesetVersion).toBe(SCORING_V2_RULESET_VERSION);
  });

  it("Infinity/NaN in the pizza's own raw data can never escape the public API as a non-finite score", () => {
    const pathological: PizzaState = {
      ...createEmptyPizza(),
      sauceDeposits: [
        { x: Number.NaN, y: 50, amount: Number.POSITIVE_INFINITY },
        { x: 50, y: 50, amount: Number.NaN },
      ],
      toppings: [
        { id: "m0", ingredientId: "mozzarella", x: Number.POSITIVE_INFINITY, y: 50 },
        { id: "b0", ingredientId: "basil", x: Number.NaN, y: Number.NaN },
      ],
    };
    const result = computeScoringV2Shadow(MARGHERITA, pathological);
    expect(result.totalScore).not.toBeNull();
    expect(Number.isFinite(result.totalScore as number)).toBe(true);
    if (result.components.sauce.available) expect(Number.isFinite(result.components.sauce.score)).toBe(true);
    if (result.components.pieces.available) {
      expect(Number.isFinite(result.components.pieces.score)).toBe(true);
      for (const group of result.components.pieces.groups) {
        expect(Number.isFinite(group.score)).toBe(true);
      }
    }
    if (result.components.recipe.available) expect(Number.isFinite(result.components.recipe.score)).toBe(true);
  });
});

describe("Golden ordering (Fresh Audit scoring principle: better physical pizza -> higher Shadow score)", () => {
  it("perfect (Reference-exact) > good (slightly imperfect) > poor (concentrated/badly placed) > empty", () => {
    const perfect = computeScoringV2Shadow(MARGHERITA, referenceLikePizza());

    const good = computeScoringV2Shadow(
      MARGHERITA,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        sauceDeposits: ring(28, 24, 0.02), // decent coverage, a bit short of the full fixture
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 33, y: 33 },
          { id: "m1", ingredientId: "mozzarella", x: 67, y: 38 },
          { id: "m2", ingredientId: "mozzarella", x: 48, y: 64 },
          { id: "b0", ingredientId: "basil", x: 34, y: 60 },
          { id: "b1", ingredientId: "basil", x: 66, y: 64 },
        ],
      }),
    );

    const poor = computeScoringV2Shadow(
      MARGHERITA,
      pizzaWith({
        sauceIds: ["tomato-sauce"],
        sauceDeposits: Array.from({ length: 10 }, () => ({ x: 55, y: 55, amount: 0.02 })), // dumped, off-center
        toppings: [
          { id: "m0", ingredientId: "mozzarella", x: 12, y: 12 },
          { id: "b0", ingredientId: "basil", x: 88, y: 88 },
        ],
      }),
    );

    const empty = computeScoringV2Shadow(MARGHERITA, createEmptyPizza());

    expect(perfect.totalScore).not.toBeNull();
    expect(good.totalScore).not.toBeNull();
    expect(poor.totalScore).not.toBeNull();
    expect(empty.totalScore).toBe(0);

    expect(perfect.totalScore as number).toBeGreaterThan(good.totalScore as number);
    expect(good.totalScore as number).toBeGreaterThan(poor.totalScore as number);
    expect(poor.totalScore as number).toBeGreaterThan(empty.totalScore as number);

    for (const result of [perfect, good, poor, empty]) {
      expect(Number.isFinite(result.totalScore as number)).toBe(true);
    }
  });
});

/**
 * B2 PART A (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md section 10): marinara
 * and funghi now have reviewed, ChatGPT-approved Reference geometry (`MARINARA_REFERENCE`/
 * `FUNGHI_REFERENCE`, ../../data/referencePizza.ts) -- Scoring 2.0 coverage is 3/7. These
 * helpers mirror the existing `referenceLikePizza`/Golden-ordering fixtures above, generalized
 * to read whichever recipe's own Reference is being tested instead of hardcoding
 * mozzarella/basil, so the same Golden Matrix shape (perfect > good > poor > empty) is proven
 * for the two newly-covered recipes without duplicating margherita's own fixture literals.
 */
function referenceLikePizzaForRecipe(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `${recipeId}-ref-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
  });
}

function goodPizzaForRecipe(recipeId: RecipeId): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: ring(28, 24, 0.02), // decent coverage, a bit short of the full fixture (same shape as Margherita's own "good" fixture above)
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
  const reference = getReferencePizza(recipeId)!;
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: Array.from({ length: 10 }, () => ({ x: 55, y: 55, amount: 0.02 })), // dumped, off-center
    toppings: [
      { id: `${recipeId}-poor-0`, ingredientId: reference.pieceGroups[0].ingredientId, x: 12, y: 12 },
      { id: `${recipeId}-poor-1`, ingredientId: reference.pieceGroups[1].ingredientId, x: 88, y: 88 },
    ],
  });
}

describe("computeScoringV2Shadow -- B2 newly covered recipes (marinara, funghi, genovese, fugazza)", () => {
  it.each(["marinara", "funghi", "genovese", "fugazza"] as const)(
    "%s is now available:true with a reviewed Reference",
    (id) => {
      const recipe = getRecipe(id)!;
      const result = computeScoringV2Shadow(recipe, referenceLikePizzaForRecipe(id));
      expect(result.available).toBe(true);
      expect(result.unavailableReason).toBeNull();
      expect(result.totalScore).not.toBeNull();
      expect(result.components.sauce.available).toBe(true);
      expect(result.components.pieces.available).toBe(true);
      expect(result.components.recipe.available).toBe(true);
      // B1 (merged onto main after this test was first written): Bake needs no Reference
      // fixture at all, so it's already real/available for every recipe including these four
      // -- see bakeComponent.ts's file header. Not B2's concern to test further here (B1 owns
      // its own Golden ordering coverage); just confirmed not to regress for the newly-covered
      // recipes' overall `available:true` result.
      expect(result.components.bake.available).toBe(true);
    },
  );

  it.each(["margherita", "marinara", "funghi", "genovese", "fugazza"] as const)(
    "%s: perfect (Reference-exact) > good > poor > empty",
    (id) => {
      const recipe = getRecipe(id)!;
      const perfect = computeScoringV2Shadow(recipe, referenceLikePizzaForRecipe(id));
      const good = computeScoringV2Shadow(recipe, goodPizzaForRecipe(id));
      const poor = computeScoringV2Shadow(recipe, poorPizzaForRecipe(id));
      const empty = computeScoringV2Shadow(recipe, createEmptyPizza());

      expect(perfect.totalScore).not.toBeNull();
      expect(good.totalScore).not.toBeNull();
      expect(poor.totalScore).not.toBeNull();
      expect(empty.totalScore).toBe(0);

      expect(perfect.totalScore as number).toBeGreaterThan(good.totalScore as number);
      expect(good.totalScore as number).toBeGreaterThan(poor.totalScore as number);
      expect(poor.totalScore as number).toBeGreaterThan(empty.totalScore as number);

      for (const result of [perfect, good, poor, empty]) {
        expect(Number.isFinite(result.totalScore as number)).toBe(true);
      }
    },
  );

  it.each(["marinara", "funghi", "genovese", "fugazza"] as const)(
    "%s: same-type piece permutation invariance holds for the new Reference groups too",
    (id) => {
      const recipe = getRecipe(id)!;
      const ordered = referenceLikePizzaForRecipe(id);
      const shuffled = { ...ordered, toppings: [...ordered.toppings].reverse() };

      const orderedResult = computeScoringV2Shadow(recipe, ordered);
      const shuffledResult = computeScoringV2Shadow(recipe, shuffled);

      expect(orderedResult.totalScore).toEqual(shuffledResult.totalScore);
    },
  );

  it("margherita remains available and unaffected by marinara/funghi/genovese/fugazza's new coverage (no cross-recipe regression)", () => {
    const result = computeScoringV2Shadow(MARGHERITA, referenceLikePizza());
    expect(result.available).toBe(true);
    expect(result.totalScore).not.toBeNull();
  });

  it("marinara and funghi (PART A) remain available and unaffected by genovese/fugazza's new coverage (no cross-recipe regression)", () => {
    for (const id of ["marinara", "funghi"] as const) {
      const recipe = getRecipe(id)!;
      const result = computeScoringV2Shadow(recipe, referenceLikePizzaForRecipe(id));
      expect(result.available).toBe(true);
      expect(result.totalScore).not.toBeNull();
    }
  });

  it("Scoring 2.0 stays non-authoritative for the newly-covered recipes too -- computeScoringV2Shadow has no side effects on state.score/Dex/Mission", () => {
    // computeScoringV2Shadow is a pure function of (recipe, pizza) with no reducer/state
    // access at all -- calling it twice with the same input is deterministic and produces no
    // observable effect beyond its return value, which is exactly the Shadow-only contract
    // this whole module (see its own file header) is built on. Explicitly re-pinned here for
    // the two newly-covered recipes since PART A is the first time they can produce a
    // non-null totalScore, i.e. the first time this contract is actually exercised for them.
    const marinara = getRecipe("marinara")!;
    const first = computeScoringV2Shadow(marinara, referenceLikePizzaForRecipe("marinara"));
    const second = computeScoringV2Shadow(marinara, referenceLikePizzaForRecipe("marinara"));
    expect(first).toEqual(second);
  });
});
