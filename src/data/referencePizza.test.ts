import { describe, expect, it } from "vitest";
import {
  buildIdealMargheritaSauceFixture,
  buildIdealSauceFixture,
  computeMechanicalSauceReference,
  FUGAZZA_REFERENCE,
  FUNGHI_REFERENCE,
  GENOVESE_REFERENCE,
  getReferencePizza,
  IDEAL_MARGHERITA_SAUCE_FIXTURE,
  MARGHERITA_REFERENCE,
  MARINARA_REFERENCE,
} from "./referencePizza";
import { RECIPES, type RecipeId } from "./recipes";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { computeSauceMetrics } from "../logic/sauceField";
import { scoreSauceAgainstReference } from "../logic/referenceScoring";

/**
 * Codex Broad Review MUST FIX 6 (Reachable Reference): pins that the Margherita Reference
 * target is not just two independently-guessed numbers, but is *reachable* -- a concrete
 * deposit sequence a real gesture could produce lands within a small tolerance of it and
 * scores a high shadow similarity. If a future sauceField.ts tuning change ever drifted the
 * target and the fixture's own computed metrics apart, this test fails immediately instead
 * of silently shipping an unreachable target again.
 */
const TOLERANCE = 0.03;

describe("Reference fixture reachability", () => {
  it("the fixture's own computed metrics land within tolerance of the derived target", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    expect(Math.abs(metrics.quantity - MARGHERITA_REFERENCE.sauce.quantity)).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(Math.abs(metrics.coverage - MARGHERITA_REFERENCE.sauce.coverage)).toBeLessThanOrEqual(
      TOLERANCE,
    );
  });

  it("scores a high shadow similarity against its own target (it IS the target, by construction)", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    const shadow = scoreSauceAgainstReference(metrics, MARGHERITA_REFERENCE.sauce);
    expect(shadow.quantitySimilarity).toBeGreaterThan(0.95);
    expect(shadow.coverageSimilarity).toBeGreaterThan(0.95);
    expect(shadow.overall).toBeGreaterThan(0.95);
  });

  it("the fixture never overflows and never gets clamped by the SAUCE_MAX_QUANTITY cap (a capped fixture would make the derived target meaningless)", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    expect(metrics.overflowAmount).toBe(0);
    expect(metrics.quantity).toBeLessThan(1);
  });

  it("target quantity and coverage are both in a sane, non-degenerate range", () => {
    expect(MARGHERITA_REFERENCE.sauce.quantity).toBeGreaterThan(0.1);
    expect(MARGHERITA_REFERENCE.sauce.quantity).toBeLessThan(1);
    expect(MARGHERITA_REFERENCE.sauce.coverage).toBeGreaterThan(0.1);
    expect(MARGHERITA_REFERENCE.sauce.coverage).toBeLessThan(1);
  });

  it("buildIdealMargheritaSauceFixture is deterministic (same fixture every call)", () => {
    expect(buildIdealMargheritaSauceFixture()).toEqual(buildIdealMargheritaSauceFixture());
  });

  it("real values are not real grams/ml -- ingredientId is the only identity field, no unit field exists", () => {
    expect(Object.keys(MARGHERITA_REFERENCE.sauce).sort()).toEqual(
      ["coverage", "ingredientId", "quantity"].sort(),
    );
  });
});

describe("getReferencePizza (B2 PART C1: coverage is now margherita/marinara/funghi/genovese/fugazza, 5/7)", () => {
  it("returns the Margherita reference for margherita", () => {
    expect(getReferencePizza("margherita")).toBe(MARGHERITA_REFERENCE);
  });

  it("returns the Marinara reference for marinara", () => {
    expect(getReferencePizza("marinara")).toBe(MARINARA_REFERENCE);
  });

  it("returns the Funghi reference for funghi", () => {
    expect(getReferencePizza("funghi")).toBe(FUNGHI_REFERENCE);
  });

  it("returns the Genovese reference for genovese", () => {
    expect(getReferencePizza("genovese")).toBe(GENOVESE_REFERENCE);
  });

  it("returns the Fugazza reference for fugazza", () => {
    expect(getReferencePizza("fugazza")).toBe(FUGAZZA_REFERENCE);
  });

  it("returns null for a recipe with no reviewed geometry, and for an unknown id", () => {
    for (const id of ["quattro-formaggi", "bismarck-egg", "unknown-recipe"]) {
      expect(getReferencePizza(id)).toBeNull();
    }
  });

  /** B2 (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md): still pins the exact
   *  remaining-blocked coverage state for the 2 recipes PART C1 did not touch. Both have
   *  design-only candidates (section 13, NOT YET APPROVED) -- neither is registered here. */
  it("still returns null for every recipe PART C1 did not implement", () => {
    for (const id of ["quattro-formaggi", "bismarck"] satisfies RecipeId[]) {
      expect(getReferencePizza(id)).toBeNull();
    }
  });
});

/**
 * B2 PART A: pins the exact ChatGPT-approved coordinates/tolerance for marinara and funghi,
 * the same style as the existing "Phase 4A-1B piece reference" Margherita pin below -- so an
 * accidental future edit to these literals fails a test immediately, the same guarantee
 * Margherita's own geometry has had since Phase 4A-1B.
 */
describe("MARINARA_REFERENCE / FUNGHI_REFERENCE (B2 PART A: reviewed, approved geometry)", () => {
  it("marinara: garlic x3 / oregano x2 at the exact approved positions, 8/22 tolerance", () => {
    const [garlic, oregano] = MARINARA_REFERENCE.pieceGroups;
    expect(garlic.ingredientId).toBe("garlic");
    expect(garlic.positions).toEqual([
      { x: 33, y: 41 },
      { x: 69, y: 43 },
      { x: 50, y: 68 },
    ]);
    expect(oregano.ingredientId).toBe("oregano");
    expect(oregano.positions).toEqual([
      { x: 38, y: 63 },
      { x: 64, y: 60 },
    ]);
    for (const group of MARINARA_REFERENCE.pieceGroups) {
      expect(group.matching).toEqual({ fullCreditRadius: 8, zeroCreditRadius: 22 });
    }
    expect(MARINARA_REFERENCE.sauce).toEqual(computeMechanicalSauceReference("marinara"));
  });

  it("funghi: mozzarella x2 / mushroom x3 at the exact approved positions, 8/22 tolerance", () => {
    const [mozzarella, mushroom] = FUNGHI_REFERENCE.pieceGroups;
    expect(mozzarella.ingredientId).toBe("mozzarella");
    expect(mozzarella.positions).toEqual([
      { x: 36, y: 38 },
      { x: 66, y: 40 },
    ]);
    expect(mushroom.ingredientId).toBe("mushroom");
    expect(mushroom.positions).toEqual([
      { x: 50, y: 30 },
      { x: 30, y: 62 },
      { x: 70, y: 64 },
    ]);
    for (const group of FUNGHI_REFERENCE.pieceGroups) {
      expect(group.matching).toEqual({ fullCreditRadius: 8, zeroCreditRadius: 22 });
    }
    expect(FUNGHI_REFERENCE.sauce).toEqual(computeMechanicalSauceReference("funghi"));
  });
});

/**
 * B2 PART C1: pins the exact ChatGPT-approved coordinates/tolerance for genovese and fugazza,
 * the same guarantee every other implemented recipe's geometry already has.
 */
describe("GENOVESE_REFERENCE / FUGAZZA_REFERENCE (B2 PART C1: reviewed, approved geometry)", () => {
  it("genovese: mozzarella x2 / cherry-tomato x3 at the exact approved positions, 8/22 tolerance", () => {
    const [mozzarella, cherryTomato] = GENOVESE_REFERENCE.pieceGroups;
    expect(mozzarella.ingredientId).toBe("mozzarella");
    expect(mozzarella.positions).toEqual([
      { x: 33, y: 42 },
      { x: 59, y: 65 },
    ]);
    expect(cherryTomato.ingredientId).toBe("cherry-tomato");
    expect(cherryTomato.positions).toEqual([
      { x: 48, y: 32 },
      { x: 40, y: 70 },
      { x: 70, y: 47 },
    ]);
    for (const group of GENOVESE_REFERENCE.pieceGroups) {
      expect(group.matching).toEqual({ fullCreditRadius: 8, zeroCreditRadius: 22 });
    }
    expect(GENOVESE_REFERENCE.sauce).toEqual(computeMechanicalSauceReference("genovese"));
  });

  it("fugazza: onion x4 / oregano x1 at the exact approved positions, 8/22 tolerance", () => {
    const [onion, oregano] = FUGAZZA_REFERENCE.pieceGroups;
    expect(onion.ingredientId).toBe("onion");
    expect(onion.positions).toEqual([
      { x: 30, y: 36 },
      { x: 69, y: 35 },
      { x: 33, y: 67 },
      { x: 67, y: 63 },
    ]);
    expect(oregano.ingredientId).toBe("oregano");
    expect(oregano.positions).toEqual([{ x: 51, y: 46 }]);
    for (const group of FUGAZZA_REFERENCE.pieceGroups) {
      expect(group.matching).toEqual({ fullCreditRadius: 8, zeroCreditRadius: 22 });
    }
    expect(FUGAZZA_REFERENCE.sauce).toEqual(computeMechanicalSauceReference("fugazza"));
  });
});

/**
 * B2: `computeMechanicalSauceReference` reuses the exact same ideal-fixture-derivation
 * Margherita's own sauce target already relies on, generalized to read each recipe's sauce
 * ingredient from `recipeSauceProfiles.ts` -- proving a real, reachable target is already
 * mechanically available for every recipe's sauce, independent of the still-open piece-
 * geometry question (see the B2 report for the full per-recipe authoring template).
 */
describe("computeMechanicalSauceReference (B2 mechanical infra)", () => {
  it("the general fixture builder is geometry-identical to the (now-aliased) Margherita one", () => {
    expect(buildIdealSauceFixture()).toEqual(buildIdealMargheritaSauceFixture());
    expect(buildIdealSauceFixture()).toEqual(IDEAL_MARGHERITA_SAUCE_FIXTURE);
  });

  it("reproduces Margherita's own already-accepted sauce target exactly", () => {
    expect(computeMechanicalSauceReference("margherita")).toEqual(MARGHERITA_REFERENCE.sauce);
  });

  it.each(RECIPES.map((r) => r.id))(
    "produces a reachable, sane, correctly-identified sauce target for %s",
    (recipeId) => {
      const target = computeMechanicalSauceReference(recipeId);
      const profile = getRecipeSauceProfile(recipeId);

      expect(target.ingredientId).toBe(profile.ingredientId);
      expect(target.quantity).toBeGreaterThan(0.1);
      expect(target.quantity).toBeLessThan(1);
      expect(target.coverage).toBeGreaterThan(0.1);
      expect(target.coverage).toBeLessThan(1);

      // Reachability, same standard as the Margherita-specific test above: the fixture that
      // produced this exact target scores near-perfectly against its own derived target,
      // regardless of which sauce ingredient the recipe actually uses (the geometry, not the
      // ingredient identity, is what similarity is computed from).
      const metrics = computeSauceMetrics(buildIdealSauceFixture());
      const shadow = scoreSauceAgainstReference(metrics, target);
      expect(shadow.overall).toBeGreaterThan(0.95);
    },
  );

  it("every recipe's mechanical target uses that recipe's own real sauce ingredient (never a fabricated stand-in)", () => {
    const ids = new Set(RECIPES.map((r) => computeMechanicalSauceReference(r.id).ingredientId));
    expect(ids).toEqual(new Set(["tomato-sauce", "pesto", "olive-oil"]));
  });
});

describe("Phase 4A-1B piece reference", () => {
  it("defines game-authored 3/2 TAP_PLACE groups using DRAG_FROM_TRAY", () => {
    const [mozzarella, basil] = MARGHERITA_REFERENCE.pieceGroups;
    expect(mozzarella.ingredientId).toBe("mozzarella");
    expect(mozzarella.positions).toHaveLength(3);
    expect(basil.ingredientId).toBe("basil");
    expect(basil.positions).toHaveLength(2);
    for (const group of MARGHERITA_REFERENCE.pieceGroups) {
      expect(group.interaction.family).toBe("TAP_PLACE");
      expect(group.interaction.primaryInput).toBe("DRAG_FROM_TRAY");
      expect(group.interaction.fallbackInput).toBe("TAP_ON_PIZZA");
      expect(group.matching).toEqual({ fullCreditRadius: 8, zeroCreditRadius: 22 });
    }
  });

  /** Issue #32 Phase 1 (Reference/Player Visual Consistency) touched only rendering -- this
   *  pins that the underlying Scoring 2.0 fixture coordinates and counts are byte-for-byte
   *  unchanged from before that phase. */
  it("pins exact target coordinates and piece counts (Issue #32 Phase 1 visual-only change)", () => {
    const [mozzarella, basil] = MARGHERITA_REFERENCE.pieceGroups;
    expect(mozzarella.positions).toEqual([
      { x: 35, y: 35 },
      { x: 65, y: 36 },
      { x: 50, y: 66 },
    ]);
    expect(basil.positions).toEqual([
      { x: 31, y: 62 },
      { x: 69, y: 62 },
    ]);
  });
});
