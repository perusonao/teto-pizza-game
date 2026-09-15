import { describe, expect, it } from "vitest";
import { scoreSauceAgainstReference } from "./referenceScoring";
import { MARGHERITA_REFERENCE } from "../data/referencePizza";

describe("scoreSauceAgainstReference (shadow-only)", () => {
  it("scores a perfect match at 1.0 overall", () => {
    const result = scoreSauceAgainstReference(
      { quantity: MARGHERITA_REFERENCE.sauce.quantity, coverage: MARGHERITA_REFERENCE.sauce.coverage },
      MARGHERITA_REFERENCE.sauce,
    );
    expect(result.quantitySimilarity).toBeCloseTo(1);
    expect(result.coverageSimilarity).toBeCloseTo(1);
    expect(result.overall).toBeCloseTo(1);
  });

  it("scores a maximally-wrong match at 0.0 overall", () => {
    const result = scoreSauceAgainstReference({ quantity: 0, coverage: 1 }, { ingredientId: "tomato-sauce", quantity: 1, coverage: 0 });
    expect(result.quantitySimilarity).toBeCloseTo(0);
    expect(result.coverageSimilarity).toBeCloseTo(0);
    expect(result.overall).toBeCloseTo(0);
  });

  it("is monotonic: getting closer to the reference never decreases similarity", () => {
    const far = scoreSauceAgainstReference({ quantity: 0.1, coverage: 0.1 }, MARGHERITA_REFERENCE.sauce);
    const closer = scoreSauceAgainstReference({ quantity: 0.4, coverage: 0.5 }, MARGHERITA_REFERENCE.sauce);
    expect(closer.overall).toBeGreaterThan(far.overall);
  });

  it("stays within [0, 1] for out-of-range inputs", () => {
    const result = scoreSauceAgainstReference({ quantity: 5, coverage: -3 }, MARGHERITA_REFERENCE.sauce);
    expect(result.quantitySimilarity).toBeGreaterThanOrEqual(0);
    expect(result.coverageSimilarity).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });
});
