import { describe, expect, it } from "vitest";
import {
  buildIdealMargheritaSauceFixture,
  getReferencePizza,
  IDEAL_MARGHERITA_SAUCE_FIXTURE,
  MARGHERITA_REFERENCE,
} from "./referencePizza";
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

describe("getReferencePizza (Scope Guard)", () => {
  it("returns the Margherita reference for margherita", () => {
    expect(getReferencePizza("margherita")).toBe(MARGHERITA_REFERENCE);
  });

  it("returns null for every other recipe", () => {
    for (const id of ["marinara", "quattro-formaggi", "pesto-genovese", "unknown-recipe"]) {
      expect(getReferencePizza(id)).toBeNull();
    }
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
});
