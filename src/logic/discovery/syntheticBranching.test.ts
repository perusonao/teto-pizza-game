import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, countsTowardLadder } from "../../data/recipes";
import { countRecipeDiscoveryStates, recipeDiscoveryState } from "../../state/recipeDiscoveryState";
import { recipeKeyStep } from "../../state/recipeChapters";
import { discoverIds, enumerateDiscoveryOrders, ladderCountOf, walkInputs } from "../testSupport/discoveryWalk";
import {
  SYNTH_BRANCH_A_ID,
  SYNTH_BRANCH_B,
  SYNTH_BRANCH_B_ID,
  withSyntheticBranch,
} from "../testSupport/syntheticPopulation";
import { discoverableHintCandidates, selectHintTarget } from "./hintTarget";

/**
 * Discovery 3.0 PR-4a: "exactly one discoverable unknown recipe at a time" is a property of the 25
 * production recipes, not of the discovery system. This suite pins what the system does when a second
 * recipe shares a ladder step, using a SYNTHETIC non-credit recipe (no production data is added):
 * A = pizza-portuguesa (real W1 recipe, key step 12), B = `synthetic-branch-b` (key step 12,
 * `ladderCredit: false`).
 */

const POP = withSyntheticBranch(RECIPES);
const LADDER_ORDER = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];
/** The 12 recipes whose discovery brings the ladder to step 12 (A's and B's key step). */
const FIRST_12 = LADDER_ORDER.slice(0, 12);
const credit = (id: string) => countsTowardLadder(id, POP);

describe("fixture premises (the synthetic recipe really branches at A's step)", () => {
  it("A and B share key step 12; B is non-credit; B is not a production id", () => {
    const a = POP.find((r) => r.id === SYNTH_BRANCH_A_ID)!;
    expect(recipeKeyStep(a)).toBe(12);
    expect(recipeKeyStep(SYNTH_BRANCH_B)).toBe(12);
    expect(credit(SYNTH_BRANCH_B_ID)).toBe(false);
    expect(credit(SYNTH_BRANCH_A_ID)).toBe(true);
    expect(RECIPES.some((r) => (r.id as string) === SYNTH_BRANCH_B_ID)).toBe(false);
  });
});

describe("pool 0 / 1 / 2+ at the branching step", () => {
  const dex12 = discoverIds([], FIRST_12);

  it("pool = 2: both A and B are DISCOVERABLE; remaining unknown shrinks accordingly", () => {
    const inputs = walkInputs(dex12, POP);
    expect(discoverableHintCandidates(inputs, POP).map((r) => r.id).sort()).toEqual([SYNTH_BRANCH_A_ID, SYNTH_BRANCH_B_ID].sort());
    expect(ladderCountOf(dex12, POP)).toBe(12);
    // Everything beyond step 12 is still UNKNOWN: 25 production + B = 26, minus 12 discovered, minus the pool of 2.
    expect(countRecipeDiscoveryStates(POP, inputs)).toEqual({ DISCOVERED: 12, DISCOVERABLE: 2, KNOWN_BUT_MISSING_MATERIAL: 0, UNKNOWN: 12 });
  });

  it("pool = 1 after B (B does not advance the ladder: same count, same entitlement, A is the only target)", () => {
    const before = walkInputs(dex12, POP);
    const dex = discoverIds(dex12, [SYNTH_BRANCH_B_ID]);
    const after = walkInputs(dex, POP);
    expect(ladderCountOf(dex, POP)).toBe(12); // non-credit
    expect(after.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds);
    expect(discoverableHintCandidates(after, POP).map((r) => r.id)).toEqual([SYNTH_BRANCH_A_ID]);
    expect(selectHintTarget(after, { recipes: POP })).toEqual({ kind: "TARGET", recipeId: SYNTH_BRANCH_A_ID, source: "auto" });
  });

  it("pool = 1 after A (A advances the ladder: step 13 unlocks, B stays discoverable alongside the next key recipe)", () => {
    const before = walkInputs(dex12, POP);
    const dex = discoverIds(dex12, [SYNTH_BRANCH_A_ID]);
    const after = walkInputs(dex, POP);
    expect(ladderCountOf(dex, POP)).toBe(13);
    expect(after.unlockedForShopIngredientIds.filter((id) => !before.unlockedForShopIngredientIds.includes(id))).toEqual(["olive-oil"]);
    // B (non-credit, materials already owned) and step 13's key recipe (fugazza) are both discoverable.
    expect(discoverableHintCandidates(after, POP).map((r) => r.id).sort()).toEqual([SYNTH_BRANCH_B_ID, "fugazza"].sort());
  });

  it("pool = 0: entitled but not bought -> only a Shop state (KNOWN_BUT_MISSING_MATERIAL), never a softlock", () => {
    const full = walkInputs(dex12, POP);
    const unbought = { ...full, ownedIngredientIds: STARTER_INGREDIENT_IDS, inventory: {} };
    expect(discoverableHintCandidates(unbought, POP)).toEqual([]);
    expect(recipeDiscoveryState(SYNTH_BRANCH_B, unbought)).toBe("KNOWN_BUT_MISSING_MATERIAL");
    expect(selectHintTarget(unbought, { recipes: POP })).toEqual({ kind: "SHOP_NEW" });
  });

  it("B is UNKNOWN while its materials are not yet entitled (one step earlier)", () => {
    const dex11 = discoverIds([], LADDER_ORDER.slice(0, 11));
    const inputs = walkInputs(dex11, POP);
    expect(inputs.unlockedForShopIngredientIds).not.toContain("onion");
    expect(recipeDiscoveryState(SYNTH_BRANCH_B, inputs)).toBe("UNKNOWN");
    expect(discoverableHintCandidates(inputs, POP).map((r) => r.id)).toEqual(["capricciosa"]);
  });
});

describe("A -> B and B -> A both run to a complete Dex (no softlock, terminates)", () => {
  const result = enumerateDiscoveryOrders(POP);

  it("has no softlock and every order discovers all 26 recipes exactly once", () => {
    expect(result.softlocks).toEqual([]);
    expect(result.orders.length).toBeGreaterThan(1);
    for (const order of result.orders) {
      expect(order).toHaveLength(26);
      expect(new Set(order.map((s) => s.discovered)).size).toBe(26);
    }
  });

  it("contains both A-then-B and B-then-A", () => {
    const positions = result.orders.map((o) => o.map((s) => s.discovered));
    expect(positions.some((ids) => ids.indexOf(SYNTH_BRANCH_A_ID) < ids.indexOf(SYNTH_BRANCH_B_ID))).toBe(true);
    expect(positions.some((ids) => ids.indexOf(SYNTH_BRANCH_B_ID) < ids.indexOf(SYNTH_BRANCH_A_ID))).toBe(true);
  });

  it("the ladder count ends at 25 in every order (B never counts) and the Shop ends fully entitled", () => {
    for (const order of result.orders) {
      expect(order[order.length - 1].ladderCount).toBe(25);
      expect(order[order.length - 1].unknownAfter).toBe(0);
      expect(order[order.length - 1].entitledAfter).toEqual(order.map((s) => s.entitledAfter).reduce((a, b) => (b.length > a.length ? b : a)));
    }
  });

  it("the ladder count is monotonic and only an order's credit recipes advance it", () => {
    for (const order of result.orders) {
      let prev = 0;
      for (const step of order) {
        const expected = prev + (credit(step.discovered) ? 1 : 0);
        expect(step.ladderCount, step.discovered).toBe(expected);
        prev = step.ladderCount;
      }
    }
  });

  it("production alone is a single path with a pool of exactly 1 at every step (existing-25 parity)", () => {
    const prod = enumerateDiscoveryOrders(RECIPES);
    expect(prod.softlocks).toEqual([]);
    expect(prod.orders).toHaveLength(1);
    expect(prod.orders[0].map((s) => s.discovered)).toEqual(LADDER_ORDER);
    expect(prod.orders[0].map((s) => s.pool.length)).toEqual(Array(25).fill(1));
    expect(prod.orders[0].map((s) => s.ladderCount)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});
