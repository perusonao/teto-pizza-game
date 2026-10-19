import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { countsTowardLadder, RECIPES } from "../data/recipes";
import type { ScoreBreakdown } from "../logic/scoring";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { creditedDiscoveredCount, resolveShopEntitlement } from "./materialEntitlement";

/**
 * Issue #561: `frango-catupiry` moved from `ladderCredit: false` to credited (the only Batch 8a change). The credited count is derived
 * from the Dex on every call (nothing is persisted for it), so an existing save is re-evaluated retroactively: a save that already
 * discovered frango-catupiry gains +1, a save that has not is unchanged. Production data only; no save field or schema is involved.
 */
const FRANGO = "frango-catupiry";
const SCORE: ScoreBreakdown = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 };
const discover = (...ids: string[]): DexState => ids.reduce((dex, id) => registerScoreToDex(dex, id, SCORE).dex, EMPTY_DEX);
/** The rule before #561: frango-catupiry did not count. */
const beforeRule = (id: string) => id !== FRANGO && countsTowardLadder(id);
const credited = RECIPES.filter((r) => r.id !== FRANGO && countsTowardLadder(r.id)).map((r) => r.id);

describe("frango-catupiry credit -- existing saves (Issue #561)", () => {
  it("is credited with no ladder step of its own", () => {
    expect(countsTowardLadder(FRANGO)).toBe(true);
    expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === FRANGO)).toBe(false);
  });

  it("a save that already discovered it gains exactly +1 credited; one that has not is unchanged", () => {
    const withIt = discover(...credited.slice(0, 20), FRANGO);
    const without = discover(...credited.slice(0, 20));
    expect(creditedDiscoveredCount(withIt)).toBe(creditedDiscoveredCount(withIt, beforeRule) + 1);
    expect(creditedDiscoveredCount(without)).toBe(creditedDiscoveredCount(without, beforeRule));
    expect(creditedDiscoveredCount(without)).toBe(20);
  });

  it("retroactively opens the next ladder step for a save at the edge; never re-locks what was unlocked", () => {
    const edge = credited.slice(0, 51); // 51 credited discoveries, every one ★3 (stars clear the #420 gates)
    const mint = DISCOVERY_LADDER.steps.find((s) => s.step === 52)!.ingredientIds;
    const noIt = resolveShopEntitlement(discover(...edge), [], [], DISCOVERY_LADDER, beforeRule);
    const noItNow = resolveShopEntitlement(discover(...edge), [], []);
    const withIt = resolveShopEntitlement(discover(...edge, FRANGO), [], [], DISCOVERY_LADDER, beforeRule);
    const withItNow = resolveShopEntitlement(discover(...edge, FRANGO), [], []);
    for (const id of mint) {
      expect(noIt.unlockedForShopIngredientIds, "before").not.toContain(id);
      expect(noItNow.unlockedForShopIngredientIds, "no frango: unchanged").not.toContain(id);
      expect(withIt.unlockedForShopIngredientIds, "frango, old rule").not.toContain(id);
      expect(withItNow.unlockedForShopIngredientIds, "frango, new rule").toContain(id);
    }
    // Union / no re-lock: whatever the old rule had unlocked is still unlocked.
    for (const id of withIt.unlockedForShopIngredientIds) expect(withItNow.unlockedForShopIngredientIds).toContain(id);
    expect(noItNow.unlockedForShopIngredientIds).toEqual(noIt.unlockedForShopIngredientIds);
  });
});
