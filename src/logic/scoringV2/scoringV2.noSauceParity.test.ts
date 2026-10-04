import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import snapshot from "./__fixtures__/scoreParity.main-7bb0116.json";
import calabresaSnapshot from "./__fixtures__/scoreParity.pr4bb-brazilian-calabresa.json";
import pestoPolloSnapshot from "./__fixtures__/scoreParity.no27-pesto-pollo.json";
import pestoGamberiSnapshot from "./__fixtures__/scoreParity.expansion1-pesto-gamberi.json";
import { computeParityRows, PARITY_VARIANTS, type ParityRow } from "./testSupport/parityPizzas";

/**
 * TQ-1B (Issue #263, OD-TQ-S1 absolute condition): the no-sauce profile must not move any existing
 * sauce recipe's score by a single point. The snapshot was captured on unmodified `main` 7bb0116,
 * before the profile existed, and committed on its own (commit 858c287, "capture the 25-recipe
 * score-parity snapshot") ahead of the scoring change. It is never regenerated: every row must
 * still match exactly (total, stars, every component score, the quantity factor).
 *
 * PR-4b-B: the 26th recipe (brazilian-calabresa) is pinned in its OWN fixture rather than by
 * regenerating the frozen file, so the original 25 rows stay byte-identical to main 7bb0116.
 * Discovery 3.0 No.27: the 27th recipe (pesto-pollo) is likewise pinned in its OWN fixture.
 * Expansion Slice 1: the 28th recipe (pesto-gamberi) is likewise pinned in its OWN fixture.
 */
describe("TQ-1B: existing recipe scores are bit-identical to main 7bb0116", () => {
  const allRows = computeParityRows();
  const frozen = snapshot as { base: string; rows: ParityRow[] };
  const added = calabresaSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const addedNo27 = pestoPolloSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const addedExp1 = pestoGamberiSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const rows = allRows.filter((r) => r.recipeId !== "brazilian-calabresa" && r.recipeId !== "pesto-pollo" && r.recipeId !== "pesto-gamberi");

  it("covers every production recipe x every variant (the original 25 frozen, the 26th, 27th and 28th in their own fixtures)", () => {
    expect(frozen.base).toBe("7bb0116");
    expect(RECIPES).toHaveLength(28);
    expect(frozen.rows).toHaveLength((RECIPES.length - 3) * PARITY_VARIANTS.length);
    expect(added.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedNo27.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedExp1.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedExp1.rows.every((r) => r.recipeId === "pesto-gamberi")).toBe(true);
    expect(addedNo27.rows.every((r) => r.recipeId === "pesto-pollo")).toBe(true);
    expect(added.rows.every((r) => r.recipeId === "brazilian-calabresa")).toBe(true);
    expect(new Set(frozen.rows.map((r) => r.stars))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("every total, star and component score equals the snapshot exactly (existing 25: byte-identical)", () => {
    expect(rows).toEqual(frozen.rows);
  });

  it("the 26th recipe's rows equal its own fixture", () => {
    expect(allRows.filter((r) => r.recipeId === "brazilian-calabresa")).toEqual(added.rows);
  });

  it("the 27th recipe's rows equal its own fixture", () => {
    expect(allRows.filter((r) => r.recipeId === "pesto-pollo")).toEqual(addedNo27.rows);
  });

  it("the 28th recipe's rows equal its own fixture", () => {
    expect(allRows.filter((r) => r.recipeId === "pesto-gamberi")).toEqual(addedExp1.rows);
  });

  it("every production recipe has a sauce Reference, so none of them can take the no-sauce profile", () => {
    for (const row of allRows.filter((r) => r.variant === "ideal")) {
      expect(row.available).toBe(true);
      expect(row.components.sauce).not.toBeNull();
    }
  });
});
