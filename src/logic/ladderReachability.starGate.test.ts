import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { DINNER_REWARD_TABLES } from "../mission/dinner/dinnerReward";
import { estimateEconomy } from "./catalog/testSupport/ladderEconomyEstimate";
import {
  analyzeLadderReachability,
  type ReachabilityRecipe,
  type StarProfile,
} from "./catalog/testSupport/ladderReachability";

/**
 * Economy / Progression Phase 1 (#561). Reachability of the production ladder under star profiles.
 *
 * Two layers, deliberately separate:
 * 1. BASELINE -- the closure that exists today and is accepted as-is (the #420 OD-420-1 star gates, plus their
 *    propagation to steps 52-53 after Batch 7a). It is documented, not asserted away: this block only pins what is
 *    true now. When an Owner decision shrinks it, update `ACCEPTED_*` (the ratchet below then holds the new floor).
 * 2. WORSENING -- anything beyond the baseline (a new recipe or step that a low-star player cannot reach, a new
 *    collateral block, a deadlock even with enough stars) fails with a message naming what to decide.
 *
 * No production ladder, reward, price or unlock rule is read for modification here; the star gates are not removed.
 */

/** Recipes the star gates hold back by design (#420: goat-cheese 120 stars, spinach 130 stars). */
const ACCEPTED_DIRECTLY_GATED = ["california-style-pizza", "spinach-artichoke-pizza"];
/** Recipes held back only by propagation (the gated recipes eat the ladder's slack, Batch 7a steps 52-53). */
const ACCEPTED_COLLATERAL = ["eggplant-ricotta-pizza", "new-zealand-lamb-pizza"];
const ACCEPTED_BLOCKED_STEPS = [52, 53];

const uniform = (best: 1 | 2 | 3 | 4 | 5): StarProfile => ({ kind: "uniform", best });
const maxGate = Math.max(...DISCOVERY_LADDER.steps.flatMap((s) => Object.values(s.starGates ?? {})));

describe("ladder reachability -- BASELINE (accepted current closure, #561)", () => {
  it.each([1, 2] as const)("BEST ★%i everywhere: only the accepted recipes and steps are closed", (best) => {
    const r = analyzeLadderReachability({ profile: uniform(best) });
    expect(r.directlyGatedRecipeIds).toEqual(ACCEPTED_DIRECTLY_GATED);
    expect(r.collateralRecipeIds).toEqual(ACCEPTED_COLLATERAL);
    expect(r.blockedSteps).toEqual(ACCEPTED_BLOCKED_STEPS);
    expect(r.creditedTotal - r.creditedReached).toBe(ACCEPTED_DIRECTLY_GATED.length + ACCEPTED_COLLATERAL.length);
    expect(r.totalStars).toBeLessThan(maxGate);
  });

  it("BEST ★3 everywhere: every credited recipe is reachable and no step is blocked", () => {
    const r = analyzeLadderReachability({ profile: uniform(3) });
    expect(r.unreachableRecipeIds).toEqual([]);
    expect(r.blockedSteps).toEqual([]);
    expect(r.creditedReached).toBe(r.creditedTotal);
  });

  it("the star gate propagates: a recipe with no gated material is unreachable below the gates (explicit detection)", () => {
    const r = analyzeLadderReachability({ profile: uniform(1) });
    const gated = new Set(DISCOVERY_LADDER.steps.flatMap((s) => Object.keys(s.starGates ?? {})));
    for (const id of r.collateralRecipeIds) {
      expect(r.directlyGatedRecipeIds).not.toContain(id);
      expect(gated.size).toBeGreaterThan(0);
    }
    expect(r.collateralRecipeIds.length).toBeGreaterThan(0);
  });

  it("the gate boundaries release recipes in order (total stars 0 / just under / at each gate)", () => {
    const gates = DISCOVERY_LADDER.steps.flatMap((s) => Object.values(s.starGates ?? {})).sort((a, b) => a - b);
    const at = (total: number) => analyzeLadderReachability({ profile: { kind: "total", total } });
    expect(at(gates[0] - 1).unreachableRecipeIds).toHaveLength(ACCEPTED_DIRECTLY_GATED.length + ACCEPTED_COLLATERAL.length);
    // First gate met: the collateral steps open again; only the recipe of the second gate waits.
    expect(at(gates[0]).unreachableRecipeIds).toEqual(["spinach-artichoke-pizza"]);
    expect(at(gates[1] - 1).unreachableRecipeIds).toEqual(["spinach-artichoke-pizza"]);
    expect(at(gates[1]).unreachableRecipeIds).toEqual([]);
  });
});

describe("ladder reachability -- WORSENING detection (future recipe / step additions)", () => {
  const profiles: readonly [string, StarProfile][] = [
    ["★1", uniform(1)],
    ["★2", uniform(2)],
    ["★3", uniform(3)],
  ];

  it.each(profiles)("%s: no recipe or step is closed beyond the accepted baseline", (_name, profile) => {
    const r = analyzeLadderReachability({ profile });
    const extraRecipes = r.unreachableRecipeIds.filter(
      (id) => ![...ACCEPTED_DIRECTLY_GATED, ...ACCEPTED_COLLATERAL].includes(id),
    );
    const extraSteps = r.blockedSteps.filter((s) => !ACCEPTED_BLOCKED_STEPS.includes(s));
    expect(
      { extraRecipes, extraSteps },
      "A new recipe/step is unreachable for a low-star player (a star gate eats the ladder's slack). Add an alternative key recipe, move/relax the gate, or have the Owner accept it by extending ACCEPTED_* (Issue #561).",
    ).toEqual({ extraRecipes: [], extraSteps: [] });
  });

  it("with enough stars (the highest gate) nothing is unreachable and no material stays star-locked", () => {
    const r = analyzeLadderReachability({ profile: { kind: "total", total: maxGate } });
    expect(r.unreachableRecipeIds).toEqual([]);
    expect(r.blockedSteps).toEqual([]);
    expect(r.starLockedMaterialIds).toEqual([]);
  });

  it("the ladder never needs more credited discoveries than the catalog has (slack >= 0)", () => {
    const r = analyzeLadderReachability({ profile: uniform(5) });
    expect(r.creditedTotal - DISCOVERY_LADDER.steps.length).toBeGreaterThanOrEqual(0);
  });
});

describe("ladder reachability -- the detector itself (synthetic populations)", () => {
  // 3 steps; step 2 is star-gated (needs 10 stars). Recipes: R1 needs a, R2 needs b (gated), R3 needs c (step 3).
  const ladder: DiscoveryLadder = {
    populationId: "synthetic",
    steps: [
      { step: 1, kind: "MATERIAL", ingredientIds: ["egg"], keyRecipeId: "r1" },
      { step: 2, kind: "MATERIAL", ingredientIds: ["bacon"], starGates: { bacon: 10 }, keyRecipeId: "r2" },
      { step: 3, kind: "MATERIAL", ingredientIds: ["mushroom"], keyRecipeId: "r3" },
    ],
  };
  const base: ReachabilityRecipe[] = [
    { id: "m", credited: true, ingredientIds: ["tomato-sauce"] },
    { id: "r1", credited: true, ingredientIds: ["egg"] },
    { id: "r2", credited: true, ingredientIds: ["bacon"] },
    { id: "r3", credited: true, ingredientIds: ["mushroom"] },
  ];
  const run = (recipes: ReachabilityRecipe[], total: number) =>
    analyzeLadderReachability({ ladder, recipes, profile: { kind: "total", total } });

  it("reports the gated recipe as direct and the later step's recipe as collateral when slack is 0", () => {
    const r = run(base, 0);
    expect(r.directlyGatedRecipeIds).toEqual(["r2"]);
    expect(r.collateralRecipeIds).toEqual(["r3"]);
    expect(r.blockedSteps).toEqual([3]);
  });

  it("an extra credited recipe that needs no new material restores the slack: no collateral", () => {
    const r = run([...base, { id: "extra", credited: true, ingredientIds: ["egg"] }], 0);
    expect(r.collateralRecipeIds).toEqual([]);
    expect(r.blockedSteps).toEqual([]);
  });

  it("an extra NON-credited recipe does not restore the slack", () => {
    const r = run([...base, { id: "extra", credited: false, ingredientIds: ["egg"] }], 0);
    expect(r.collateralRecipeIds).toEqual(["r3"]);
  });

  it("meeting the gate releases everything", () => {
    const r = run(base, 10);
    expect(r.unreachableRecipeIds).toEqual([]);
  });
});

describe("economy estimate -- consistency (numbers are quoted in docs/reports/TETO_ECONOMY-PROGRESSION_PHASE1_Result.md)", () => {
  it("Dinner pays nothing in Production (untuned table), so the 'with Dinner' case equals 'without'", () => {
    expect(DINNER_REWARD_TABLES.every((t) => t.pitz === null)).toBe(true);
  });

  it("a lower star quality never needs fewer replays; refills only add to the packs-only figure", () => {
    const e1 = estimateEconomy(1);
    const e2 = estimateEconomy(2);
    const e3 = estimateEconomy(3);
    expect(e1.replaysWithRefillFull).toBeGreaterThanOrEqual(e2.replaysWithRefillFull);
    expect(e2.replaysWithRefillFull).toBeGreaterThanOrEqual(e3.replaysWithRefillFull);
    for (const e of [e1, e2, e3]) {
      expect(e.replaysWithRefillFull).toBeGreaterThanOrEqual(e.replaysWithRefillOne);
      expect(e.replaysWithRefillOne).toBeGreaterThanOrEqual(e.replaysPacksOnly);
    }
  });

  it("star-locked materials are not priced (only reached, unlocked steps)", () => {
    const e1 = estimateEconomy(1);
    expect(e1.reachedMaterialSteps).toBeLessThanOrEqual(DISCOVERY_LADDER.steps.length);
    expect(e1.reachedRecipes).toBe(analyzeLadderReachability({ profile: uniform(1) }).discoveredIds.length);
  });
});
