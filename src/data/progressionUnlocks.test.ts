import { describe, expect, it } from "vitest";
import authority from "../../docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json";
import { getProgressionIngredientUnlock, PROGRESSION_INGREDIENT_UNLOCKS } from "./progressionUnlocks";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { phase2Targets } from "../logic/discovery/testSupport/phase2Matrix";
import { progressionStars } from "../logic/progressionStars";
import {
  PROGRESSION_PURCHASE_GRANT_USES,
  PROGRESSION_REFILL_PRICE_FACTOR,
  PROGRESSION_REFILL_USES,
  progressionIngredientState,
  progressionRefillPricePitz,
} from "../logic/progressionEconomy";

/**
 * Phase 3-4A parity: the unwired rule table and rules against the Phase 3-4 authority JSON (the
 * input the Phase 3-4 Pre-Implementation Audit, PR #204, re-verified). The counts below were
 * re-checked against that JSON and the audit's Progression-Graph `authorityCounts` before being
 * pinned here.
 */

interface AuthorityRow {
  sequence: number;
  nodeId: string;
  ingredientId?: string;
  kind: string;
  tier: string;
  conditionType: string;
  unlockCondition: { type: string; all: { type: string; minimum?: number; nodeId?: string }[] };
  pricePitz: number;
  stockPolicy: string;
  prerequisite: string | null;
}

const rows = authority.rows as unknown as AuthorityRow[];
const ingredientRows = rows.filter((r) => r.kind === "ingredient");
const targets = phase2Targets("SHIPPED_KEEP");

describe("Phase 3-4 authority counts (re-verified against the audit)", () => {
  it("105 materials, 3 initial OWNED, 102 purchasable", () => {
    expect(authority.summary.ingredientCount).toBe(105);
    expect(authority.summary.initialOwnedIngredientCount).toBe(3);
    expect(authority.summary.unlockableIngredientCount).toBe(102);
    expect(ingredientRows).toHaveLength(105);
    expect(ingredientRows.filter((r) => r.conditionType === "INITIAL_OWNED")).toHaveLength(3);
    expect(ingredientRows.filter((r) => r.conditionType === "CUMULATIVE_STARS")).toHaveLength(102);
  });

  it("128 unlock targets (105 ingredient + 10 dough + 3 pan + 10 capability)", () => {
    expect(authority.summary.allNodeCount).toBe(128);
    expect(rows).toHaveLength(128);
    const kinds: Record<string, number> = {};
    for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
    expect(kinds).toEqual({ ingredient: 105, dough: 10, pan: 3, capability: 10 });
  });

  it("101 target recipes (SHIPPED_KEEP)", () => {
    expect(targets).toHaveLength(101);
    expect(new Set(targets.map((t) => t.targetId)).size).toBe(101);
  });

  it("stock policy is S10_R10: +10 on purchase, +10 on refill at 0.5x", () => {
    expect(authority.policy.stockPolicy).toBe("S10_R10");
    expect(authority.policy.purchaseGrantPortions).toBe(PROGRESSION_PURCHASE_GRANT_USES);
    expect(authority.policy.refillPortions).toBe(PROGRESSION_REFILL_USES);
    expect(authority.policy.refillPriceFactor).toBe(PROGRESSION_REFILL_PRICE_FACTOR);
  });
});

describe("PROGRESSION_INGREDIENT_UNLOCKS", () => {
  it("matches every authority ingredient row, in sequence order", () => {
    expect(PROGRESSION_INGREDIENT_UNLOCKS).toHaveLength(ingredientRows.length);
    PROGRESSION_INGREDIENT_UNLOCKS.forEach((u, i) => {
      const row = ingredientRows[i];
      expect(u.ingredientId, `row ${i}`).toBe(row.ingredientId);
      expect(u.ingredientId).toBe(row.nodeId);
      expect(u.sequence).toBe(row.sequence);
      expect(u.tier).toBe(row.tier);
      expect(u.purchasePricePitz).toBe(row.pricePitz);
      expect(row.prerequisite).toBeNull();
      if (row.conditionType === "INITIAL_OWNED") {
        expect(u.initialOwned).toBe(true);
        expect(u.minProgressionStars).toBe(0);
        expect(row.stockPolicy).toBe("UNLIMITED");
      } else {
        expect(u.initialOwned).toBe(false);
        expect(row.unlockCondition.all).toEqual([
          expect.objectContaining({ type: "CUMULATIVE_STARS", minimum: u.minProgressionStars }),
        ]);
        expect(row.stockPolicy).toBe("PURCHASE_GRANT_10_REFILL_10_AT_HALF_PRICE");
      }
    });
  });

  it("ids are unique and lookup works", () => {
    expect(new Set(PROGRESSION_INGREDIENT_UNLOCKS.map((u) => u.ingredientId)).size).toBe(105);
    expect(getProgressionIngredientUnlock("egg")?.minProgressionStars).toBe(2);
    expect(getProgressionIngredientUnlock("not-an-ingredient")).toBeUndefined();
  });

  it("the initial-owned trio is exactly the shipped unlimited starter set", () => {
    const initial = PROGRESSION_INGREDIENT_UNLOCKS.filter((u) => u.initialOwned).map((u) => u.ingredientId);
    expect([...initial].sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
    expect([...initial].sort()).toEqual(["basil", "mozzarella", "tomato-sauce"]);
  });

  it("every purchasable price is its tier price, and every refill price is exactly half", () => {
    const tierPrice = authority.policy.pricesByTier as Record<string, number>;
    for (const u of PROGRESSION_INGREDIENT_UNLOCKS.filter((x) => !x.initialOwned)) {
      expect(u.purchasePricePitz, u.ingredientId).toBe(tierPrice[u.tier]);
      expect(progressionRefillPricePitz(u.purchasePricePitz)).toBe(u.purchasePricePitz * 0.5);
    }
    expect([...new Set(PROGRESSION_INGREDIENT_UNLOCKS.map((u) => progressionRefillPricePitz(u.purchasePricePitz)))])
      .toEqual(expect.arrayContaining([null, 30, 50, 70, 90]));
  });

  it("gates never decrease in sequence order", () => {
    for (let i = 1; i < PROGRESSION_INGREDIENT_UNLOCKS.length; i++) {
      expect(PROGRESSION_INGREDIENT_UNLOCKS[i].minProgressionStars).toBeGreaterThanOrEqual(
        PROGRESSION_INGREDIENT_UNLOCKS[i - 1].minProgressionStars,
      );
    }
  });
});

describe("no star deadlock at the guaranteed minimum (2⭐ per discovery)", () => {
  const sequenceOf = new Map(rows.map((r) => [r.nodeId, r.sequence]));
  const targetReadyAt = targets.map((t) => {
    const needed = [...t.items, ...t.capabilities];
    for (const n of needed) expect(sequenceOf.has(n), `${t.targetId} needs ${n}`).toBe(true);
    return { targetId: t.targetId, readyAt: Math.max(...needed.map((n) => sequenceOf.get(n)!)) };
  });

  /** A Dex where every target reachable before `sequence` is discovered at the worst BEST (★1). */
  function worstCaseDexBefore(sequence: number) {
    return targetReadyAt
      .filter((t) => t.readyAt < sequence)
      .map((t) => ({ recipeId: t.targetId, discovered: true, bestStars: 1 }));
  }

  it("every purchasable ingredient becomes AVAILABLE_TO_BUY in authority order", () => {
    for (const u of PROGRESSION_INGREDIENT_UNLOCKS.filter((x) => !x.initialOwned)) {
      const stars = progressionStars(worstCaseDexBefore(u.sequence));
      expect(progressionIngredientState(u, [], stars), u.ingredientId).toBe("AVAILABLE_TO_BUY");
    }
  });

  it("matches the audit's starSupplyChecks spot values", () => {
    // docs/reports/data/PROGRESSION-2.0_PHASE-3-4_Progression-Graph.json#starSupplyChecks
    const spot = [
      { id: "egg", discoverableBefore: 1, gate: 2 },
      { id: "bacon", discoverableBefore: 2, gate: 2 },
      { id: "onion", discoverableBefore: 3, gate: 2 },
      { id: "swiss-cheese", discoverableBefore: 100, gate: 120 },
    ];
    for (const s of spot) {
      const u = getProgressionIngredientUnlock(s.id)!;
      expect(u.minProgressionStars).toBe(s.gate);
      const dex = worstCaseDexBefore(u.sequence);
      expect(dex).toHaveLength(s.discoverableBefore);
      expect(progressionStars(dex)).toBe(2 * s.discoverableBefore);
    }
  });

  it("only Margherita is reachable from the starter trio alone", () => {
    expect(targetReadyAt.filter((t) => t.readyAt <= 3).map((t) => t.targetId)).toEqual(["shipped:margherita"]);
  });
});
