import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import type { DexState } from "../../state/dex";
import { recipeDiscoveryState } from "../../state/recipeDiscoveryState";
import { summarizeChapter, summarizeChapters, type EntitlementView } from "./dexActionSummary";
import { largeCatalogFixture, LARGE_CATALOG_FIXTURE_IDS, mulberry32 } from "./testSupport/largeCatalogFixtures";

const STARTERS = INGREDIENTS.filter((i) => !i.unlockCondition).map((i) => i.id);
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const toSummary = (discovered: Set<string>) =>
  RECIPES.map((r) => ({ discovered: discovered.has(r.id), requiredIngredientIds: r.requiredIngredients.map((x) => x.ingredientId) }));

describe("summarizeChapter (LC-OD-8b: ownership basis)", () => {
  it("counts discovered / explore / shop", () => {
    const s = summarizeChapter(
      [
        { discovered: true, requiredIngredientIds: ["a"] },
        { discovered: false, requiredIngredientIds: ["s", "a"] },
        { discovered: false, requiredIngredientIds: ["a", "b"] },
        { discovered: false, requiredIngredientIds: ["c"] },
      ],
      { ownedIds: ["a"], shopEntitledIds: ["b"], starterIds: ["s"] },
    );
    expect(s).toEqual({ discovered: 1, total: 4, explore: 1, shop: 1 });
  });

  it("equals today's recipeDiscoveryState whenever every owned stock is >= 1", () => {
    const rand = mulberry32(8);
    for (let k = 0; k < 50; k++) {
      const owned = [...STARTERS, ...FINITE.filter(() => rand() < 0.5)];
      const entitled = FINITE.filter(() => rand() < 0.6);
      const discovered = new Set(RECIPES.filter(() => rand() < 0.3).map((r) => r.id));
      const dex: DexState = [...discovered].map((recipeId) => ({ recipeId, discovered: true, bestScore: 1, bestStars: 1, timesMade: 1 }));
      const inventory = Object.fromEntries(FINITE.map((id) => [id, 5]));
      const inputs = { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: entitled, inventory };
      const expected = { discovered: 0, total: RECIPES.length, explore: 0, shop: 0 };
      for (const r of RECIPES) {
        const st = recipeDiscoveryState(r, inputs);
        if (st === "DISCOVERED") expected.discovered++;
        if (st === "DISCOVERABLE") expected.explore++;
        if (st === "KNOWN_BUT_MISSING_MATERIAL") expected.shop++;
      }
      const e: EntitlementView = { ownedIds: owned, shopEntitledIds: entitled, starterIds: STARTERS };
      expect(summarizeChapter(toSummary(discovered), e)).toEqual(expected);
    }
  });

  it("P-1: emptying inventory changes today's per-recipe state (PV-1) but never the summary", () => {
    const owned = [...STARTERS, ...FINITE];
    const e: EntitlementView = { ownedIds: owned, shopEntitledIds: [], starterIds: STARTERS };
    const summary = summarizeChapter(toSummary(new Set(["margherita"])), e);
    const dex: DexState = [{ recipeId: "margherita", discovered: true, bestScore: 1, bestStars: 1, timesMade: 1 }];
    const full = Object.fromEntries(FINITE.map((id) => [id, 5]));
    const empty = Object.fromEntries(FINITE.map((id) => [id, 0]));
    const stateOf = (inventory: Record<string, number>) =>
      RECIPES.map((r) => recipeDiscoveryState(r, { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: [], inventory }));
    expect(stateOf(full)).not.toEqual(stateOf(empty)); // the existing oracle, left in production until LC-5
    // The summary has no stock input at all: the same entitlement always yields the same counts,
    // even when stock data is smuggled in alongside it (adversarial).
    expect(summarizeChapter(toSummary(new Set(["margherita"])), e)).toEqual(summary);
    for (const smuggled of [{ inventory: empty }, { inventory: full }, { stock: () => 0 }]) {
      expect(summarizeChapter(toSummary(new Set(["margherita"])), { ...e, ...smuggled } as EntitlementView)).toEqual(summary);
    }
    expect(summary.explore).toBe(RECIPES.length - 1);
  });

  it("runs on every fixture and totals the recipes", () => {
    for (const id of LARGE_CATALOG_FIXTURE_IDS) {
      const f = largeCatalogFixture(id);
      const chapters = f.chapterSizes.map((_, c) => ({
        key: c + 1,
        recipes: f.recipes.filter((r) => r.chapter === c + 1).map((r) => ({ discovered: false, requiredIngredientIds: r.requiredIngredientIds })),
      }));
      const out = summarizeChapters(chapters, { ownedIds: f.catalog.map((i) => i.id), shopEntitledIds: [], starterIds: f.starterIds });
      expect(out.reduce((s, c) => s + c.summary.total, 0)).toBe(f.recipes.length);
      expect(out.reduce((s, c) => s + c.summary.explore, 0)).toBe(f.recipes.length);
    }
  });
});
