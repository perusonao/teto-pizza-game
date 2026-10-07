import { describe, expect, it } from "vitest";
import snapshot from "./__fixtures__/scoreParity.main-7bb0116.json";
import calabresaSnapshot from "./__fixtures__/scoreParity.pr4bb-brazilian-calabresa.json";
import pestoPolloSnapshot from "./__fixtures__/scoreParity.no27-pesto-pollo.json";
import pestoGamberiSnapshot from "./__fixtures__/scoreParity.expansion1-pesto-gamberi.json";
import wave2Snapshot from "./__fixtures__/scoreParity.expansion2-wave2.json";
import trapaneseSnapshot from "./__fixtures__/scoreParity.expansion3-pesto-trapanese.json";
import aussieSnapshot from "./__fixtures__/scoreParity.tq1d-aussie.json";
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
 * Expansion Wave 2: the 29th-31st recipes (vongole / pesto-vegetariana / ratatouille-pizza) share ONE own fixture.
 * Expansion Slice 3: the 33rd recipe (pesto-trapanese) is likewise pinned in its OWN fixture.
 * TQ-1D: the 32nd recipe (aussie, the first NO_SAUCE recipe) is likewise pinned in its OWN fixture: it is the one
 * production recipe that takes the NO_SAUCE weight profile (pieces 68 / recipe 12 / bake 20), and no other row moves.
 */
describe("TQ-1B: existing recipe scores are bit-identical to main 7bb0116", () => {
  const allRows = computeParityRows();
  const frozen = snapshot as { base: string; rows: ParityRow[] };
  const added = calabresaSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const addedNo27 = pestoPolloSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const addedExp1 = pestoGamberiSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const addedWave2 = wave2Snapshot as { base: string; recipeIds: string[]; rows: ParityRow[] };
  const addedAussie = aussieSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  const addedTrapanese = trapaneseSnapshot as { base: string; recipeId: string; rows: ParityRow[] };
  // The frozen snapshot defines "existing" recipes; any recipe added after it has its own fixture / is outside this parity.
  const frozenIds = new Set(frozen.rows.map((r) => r.recipeId));
  const rows = allRows.filter((r) => frozenIds.has(r.recipeId));

  it("covers every production recipe x every variant (the original 25 frozen, the 26th-33rd in their own fixtures)", () => {
    expect(frozen.base).toBe("7bb0116");
    expect(frozen.rows).toHaveLength(frozenIds.size * PARITY_VARIANTS.length);
    expect(addedAussie.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedAussie.rows.every((r) => r.recipeId === "aussie")).toBe(true);
    expect(addedTrapanese.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedTrapanese.rows.every((r) => r.recipeId === "pesto-trapanese")).toBe(true);
    expect(added.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedNo27.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedExp1.rows).toHaveLength(PARITY_VARIANTS.length);
    expect(addedExp1.rows.every((r) => r.recipeId === "pesto-gamberi")).toBe(true);
    expect(addedWave2.rows).toHaveLength(3 * PARITY_VARIANTS.length);
    expect(addedWave2.recipeIds).toEqual(["vongole", "pesto-vegetariana", "ratatouille-pizza"]);
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

  it("the 29th-31st recipes' rows equal their own fixture", () => {
    expect(allRows.filter((r) => addedWave2.recipeIds.includes(r.recipeId))).toEqual(addedWave2.rows);
  });

  it("the 28th recipe's rows equal its own fixture", () => {
    expect(allRows.filter((r) => r.recipeId === "pesto-gamberi")).toEqual(addedExp1.rows);
  });

  it("the 33rd recipe's (pesto-trapanese's) rows equal its own fixture", () => {
    expect(allRows.filter((r) => r.recipeId === "pesto-trapanese")).toEqual(addedTrapanese.rows);
  });

  it("the 32nd recipe's (aussie's) rows equal its own fixture", () => {
    expect(allRows.filter((r) => r.recipeId === "aussie")).toEqual(addedAussie.rows);
  });

  it("every production recipe but aussie has a sauce Reference, so only aussie takes the no-sauce profile (no sauce component, never a fabricated 0)", () => {
    for (const row of allRows.filter((r) => r.variant === "ideal")) {
      expect(row.available).toBe(true);
      if (row.recipeId === "aussie") expect(row.components.sauce).toBeNull();
      else expect(row.components.sauce).not.toBeNull();
    }
  });
});
