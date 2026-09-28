import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import snapshot from "./__fixtures__/scoreParity.main-7bb0116.json";
import { computeParityRows, PARITY_VARIANTS, type ParityRow } from "./testSupport/parityPizzas";

/**
 * TQ-1B (Issue #263, OD-TQ-S1 absolute condition): the no-sauce profile must not move any existing
 * sauce recipe's score by a single point. The snapshot was captured on unmodified `main` 7bb0116,
 * before the profile existed, and committed on its own (commit 858c287, "capture the 25-recipe
 * score-parity snapshot") ahead of the scoring change. It is never regenerated: every row must
 * still match exactly (total, stars, every component score, the quantity factor).
 */
describe("TQ-1B: existing recipe scores are bit-identical to main 7bb0116", () => {
  const rows = computeParityRows();
  const frozen = snapshot as { base: string; rows: ParityRow[] };

  it("covers every production recipe x every variant", () => {
    expect(frozen.base).toBe("7bb0116");
    expect(frozen.rows).toHaveLength(RECIPES.length * PARITY_VARIANTS.length);
    expect(new Set(frozen.rows.map((r) => r.stars))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("every total, star and component score equals the snapshot exactly", () => {
    expect(rows).toEqual(frozen.rows);
  });

  it("every production recipe has a sauce Reference, so none of them can take the no-sauce profile", () => {
    for (const row of rows.filter((r) => r.variant === "ideal")) {
      expect(row.available).toBe(true);
      expect(row.components.sauce).not.toBeNull();
    }
  });
});
