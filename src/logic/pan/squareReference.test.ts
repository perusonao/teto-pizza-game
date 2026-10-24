import { describe, expect, it } from "vitest";
import { buildIdealSauceFixture } from "../../data/referencePizza";
import { getRecipe } from "../../data/recipes";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluatePizzaCompletion, isSauceBelowMinimum } from "../completionGate";
import { computeScoringV2 } from "../scoringV2";
import { computeSauceMetrics } from "../sauceField";
import { SQUARE_TARGET_HALF_SIDE } from "./panGeometry";
import {
  buildIdealSquareSauceFixture,
  getSquareReferenceSlots,
  IDEAL_SQUARE_SAUCE_METRICS,
  sauceMetricsForPan,
  sauceTargetForPan,
} from "./squareReference";
import { computeSquareSauceMetrics } from "./squareSauce";

describe("square ideal fixture (E-1)", () => {
  it("has the round fixture's point count and per-point amount, all inside the square target region", () => {
    const sq = buildIdealSquareSauceFixture();
    const round = buildIdealSauceFixture();
    expect(sq).toHaveLength(round.length);
    expect(sq.map((d) => d.amount)).toEqual(round.map((d) => d.amount));
    for (const d of sq) {
      expect(Math.abs(d.x - 50)).toBeLessThanOrEqual(SQUARE_TARGET_HALF_SIDE);
      expect(Math.abs(d.y - 50)).toBeLessThanOrEqual(SQUARE_TARGET_HALF_SIDE);
    }
  });
  it("is reachable: ideal square painting meets its own Reference with the rim bare and nothing overflowing", () => {
    expect(IDEAL_SQUARE_SAUCE_METRICS.overflowAmount).toBe(0);
    expect(IDEAL_SQUARE_SAUCE_METRICS.quantity).toBeGreaterThan(0.2);
    expect(IDEAL_SQUARE_SAUCE_METRICS.coverage).toBeGreaterThan(0.4);
    expect(IDEAL_SQUARE_SAUCE_METRICS.coverage).toBeLessThan(1);
  });
});

describe("pan resolution is inert for round (byte-identical)", () => {
  const deposits = buildIdealSauceFixture();
  it("sauceMetricsForPan('round') is exactly computeSauceMetrics, and 'square' is exactly computeSquareSauceMetrics", () => {
    expect(sauceMetricsForPan("round", deposits)).toEqual(computeSauceMetrics(deposits));
    expect(sauceMetricsForPan("square", deposits)).toEqual(computeSquareSauceMetrics(deposits));
  });
  it("sauceTargetForPan('round', ref) returns the same object; 'square' keeps the ingredient and swaps the two numbers", () => {
    const ref = { ingredientId: "tomato-sauce", quantity: 0.5, coverage: 0.6 };
    expect(sauceTargetForPan("round", ref)).toBe(ref);
    const sq = sauceTargetForPan("square", ref);
    expect(sq.ingredientId).toBe("tomato-sauce");
    expect(sq.quantity).toBe(Math.round(IDEAL_SQUARE_SAUCE_METRICS.quantity * 100) / 100);
    expect(sq.coverage).toBe(Math.round(IDEAL_SQUARE_SAUCE_METRICS.coverage * 100) / 100);
  });
  it("isSauceBelowMinimum: default / 'round' unchanged; ideal square painting passes on 'square', and the thin square painting fails", () => {
    const ref = { quantity: 0.5, coverage: 0.6 };
    expect(isSauceBelowMinimum(deposits, ref)).toBe(isSauceBelowMinimum(deposits, ref, "round"));
    expect(isSauceBelowMinimum(buildIdealSquareSauceFixture(), ref, "square")).toBe(false);
    expect(isSauceBelowMinimum(buildIdealSquareSauceFixture().slice(0, 2), ref, "square")).toBe(true);
  });
});

describe("getSquareReferenceSlots", () => {
  it("returns n distinct slots inside the target region, deterministically; 0 / invalid -> none; 1 -> centre", () => {
    expect(getSquareReferenceSlots(0)).toEqual([]);
    expect(getSquareReferenceSlots(Number.NaN)).toEqual([]);
    expect(getSquareReferenceSlots(1)).toEqual([{ x: 50, y: 50 }]);
    for (const n of [2, 3, 4, 5, 7, 8, 9, 12, 16]) {
      const slots = getSquareReferenceSlots(n);
      expect(slots).toHaveLength(n);
      expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(n);
      for (const s of slots) {
        expect(Math.abs(s.x - 50)).toBeLessThan(SQUARE_TARGET_HALF_SIDE);
        expect(Math.abs(s.y - 50)).toBeLessThan(SQUARE_TARGET_HALF_SIDE);
      }
      expect(getSquareReferenceSlots(n)).toEqual(slots);
    }
  });
});

describe("wiring: the pizza's pan picks the sauce metrics and Reference (margherita as the host recipe)", () => {
  const recipe = getRecipe("margherita")!;
  const pizzaOn = (pan: PizzaState["pan"], deposits: PizzaState["sauceDeposits"]): PizzaState => ({
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    sauceDeposits: deposits,
    ...(pan === undefined ? {} : { pan }),
  });
  const squareDeposits = buildIdealSquareSauceFixture();
  const roundDeposits = buildIdealSauceFixture();
  const sauceScore = (pizza: PizzaState) => {
    const c = computeScoringV2(recipe, pizza).components.sauce;
    if (!c.available) throw new Error("sauce unavailable");
    return c;
  };

  it("scoring: the ideal square painting scores like the ideal round painting on its own pan, and a pan-less pizza is the round path", () => {
    const onTray = sauceScore(pizzaOn("tray", squareDeposits));
    const onRound = sauceScore(pizzaOn(undefined, roundDeposits));
    expect(onTray.quantitySimilarity).toBeCloseTo(onRound.quantitySimilarity, 1);
    expect(onTray.coverageSimilarity).toBeCloseTo(onRound.coverageSimilarity, 1);
    // pan: null / absent / "tray" absent => identical to the legacy round result for the same deposits
    expect(sauceScore(pizzaOn(null, roundDeposits))).toEqual(sauceScore(pizzaOn(undefined, roundDeposits)));
  });
  it("scoring: the same deposits are judged differently on the tray (the pan is a real input)", () => {
    expect(sauceScore(pizzaOn("tray", squareDeposits))).not.toEqual(sauceScore(pizzaOn(undefined, squareDeposits)));
  });
  it("completion gate: the ideal square painting is not 'thin' on the tray, and a barely-touched tray is", () => {
    const failures = (pizza: PizzaState) => {
      const r = evaluatePizzaCompletion(recipe, pizza);
      return r.status === "FAILED" ? r.failures.map((f) => f.reason) : [];
    };
    expect(failures(pizzaOn("tray", squareDeposits))).not.toContain("INSUFFICIENT_SAUCE");
    expect(failures(pizzaOn("tray", squareDeposits.slice(0, 2)))).toContain("INSUFFICIENT_SAUCE");
  });
});

describe("player Reference guide follows the recipe's pan (E-1)", () => {
  it("a square-pan recipe lays its pieces on the square grid; the same recipe without panShape keeps the ring layout", async () => {
    const { getPlayerReferencePizza } = await import("../../data/playerReference");
    const base = getRecipe("margherita")!;
    const ring = getPlayerReferencePizza(base);
    const square = getPlayerReferencePizza({ ...base, panShape: "square" });
    const count = (r: typeof ring) => r.pieceGroups.reduce((n, g) => n + g.positions.length, 0);
    expect(count(square)).toBe(count(ring));
    expect(square.pieceGroups.map((g) => g.ingredientId)).toEqual(ring.pieceGroups.map((g) => g.ingredientId));
    expect(square.pieceGroups).not.toEqual(ring.pieceGroups);
    const all = square.pieceGroups.flatMap((g) => g.positions);
    expect(new Set(all.map((p) => `${p.x},${p.y}`)).size).toBe(all.length);
  });
});
