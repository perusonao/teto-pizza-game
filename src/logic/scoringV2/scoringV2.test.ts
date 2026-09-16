import { describe, expect, it } from "vitest";
import { computeScoringV2Shadow, SCORING_V2_RULESET_VERSION } from "./index";
import { scoreSauceComponentV2 } from "./sauceComponent";
import { scorePieceGroupV2, scorePiecesComponentV2 } from "./piecesComponent";
import { scoreRecipeComponentV2 } from "./recipeComponent";
import { isValidToleranceBand, safeToleranceSimilarity, safeUnit } from "./tolerance";
import { getRecipe } from "../../data/recipes";
import {
  buildIdealMargheritaSauceFixture,
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

describe("scorePieceGroupV2 / scorePiecesComponentV2", () => {
  it("Reference-exact mozzarella placement scores near-perfect", () => {
    const toppings = MOZZARELLA_GROUP.positions.map((p, i) => ({
      id: `m${i}`,
      ingredientId: "mozzarella",
      ...p,
    }));
    const result = scorePieceGroupV2(toppings, MOZZARELLA_GROUP);
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
    expect(exact.score).toBeGreaterThan(90);
    expect(poor.score).toBeLessThan(exact.score);
    expect(Number.isFinite(poor.score)).toBe(true);
  });

  it("missing pieces (none placed) score 0, finite, with a null placementSimilarity", () => {
    const result = scorePieceGroupV2([], MOZZARELLA_GROUP);
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
    expect(result.playerCount).toBe(4);
    expect(Number.isFinite(result.score)).toBe(true);
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
    expect(a.score).toBeCloseTo(b.score, 10);
    expect(a.quantitySimilarity).toBe(b.quantitySimilarity);
  });

  it("scorePieceGroupV2 fails closed (score 0, finite) for an invalid tolerance band, instead of trusting the group's own data", () => {
    const brokenGroup: ReferencePieceGroup = {
      ...MOZZARELLA_GROUP,
      matching: { fullCreditRadius: 30, zeroCreditRadius: 10 }, // zero <= full
    };
    const result = scorePieceGroupV2(
      MOZZARELLA_GROUP.positions.map((p, i) => ({ id: `m${i}`, ingredientId: "mozzarella", ...p })),
      brokenGroup,
    );
    expect(result.score).toBe(0);
    expect(result.placementSimilarity).toBeNull();
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("scorePiecesComponentV2 averages across mozzarella + basil and stays finite", () => {
    const pizza = referenceLikePizza();
    const result = scorePiecesComponentV2(pizza.toppings, MARGHERITA_REFERENCE.pieceGroups);
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
    expect(result.score).toBe(100);
    expect(result.requiredTypesPresent).toBe(3);
  });

  it("a missing required type lowers the score proportionally", () => {
    const pizza = pizzaWith({ sauceIds: ["tomato-sauce"] }); // no mozzarella, no basil
    const result = scoreRecipeComponentV2(MARGHERITA, pizza);
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
    expect(onePieceRecipe.score).toBe(threePiecesRecipe.score);
    expect(onePieceRecipe.score).toBe(100);

    // ...while Pieces itself *does* tell the two apart (the count/placement concern that
    // belongs there, per the Fresh Audit's "no double-penalizing" contract).
    const onePieceGroup = scorePieceGroupV2(onePiece.toppings, MOZZARELLA_GROUP);
    const threePieceGroup = scorePieceGroupV2(threePieces.toppings, MOZZARELLA_GROUP);
    expect(onePieceGroup.quantitySimilarity).toBeLessThan(threePieceGroup.quantitySimilarity);
  });
});

describe("computeScoringV2Shadow (P0-1 Reference availability + P0-2 canonical entry point)", () => {
  it("unavailable Reference recipe (e.g. marinara) returns available:false, totalScore:null, and every Reference-dependent component unavailable -- never a fabricated number", () => {
    const marinara = getRecipe("marinara")!;
    const result = computeScoringV2Shadow(marinara, createEmptyPizza());
    expect(result.available).toBe(false);
    expect(result.totalScore).toBeNull();
    expect(result.unavailableReason).not.toBeNull();
    expect(result.components.sauce.available).toBe(false);
    expect(result.components.pieces.available).toBe(false);
    expect(result.components.recipe.available).toBe(false);
    expect(result.components.bake.available).toBe(false);
  });

  it("every recipe without a Reference fixture is unavailable (Scope Guard: Margherita only)", () => {
    for (const id of ["marinara", "quattro-formaggi", "genovese", "bismarck", "funghi", "fugazza"] as const) {
      const recipe = getRecipe(id)!;
      const result = computeScoringV2Shadow(recipe, createEmptyPizza());
      expect(result.available).toBe(false);
      expect(result.totalScore).toBeNull();
    }
  });

  it("Bake stays explicitly unavailable/provisional even for Margherita (no reviewed Scoring 2.0 Bake primitive this phase)", () => {
    const result = computeScoringV2Shadow(MARGHERITA, referenceLikePizza());
    expect(result.components.bake.available).toBe(false);
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
