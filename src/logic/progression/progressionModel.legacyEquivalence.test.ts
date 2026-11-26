import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { INGREDIENTS } from "../../data/ingredients";
import { LATE_ENTITLEMENT_FLOORS } from "../../data/lateCatalog";
import { RECIPES, countsTowardLadder } from "../../data/recipes";
import { TECHNIQUES } from "../../data/techniques";
import { discoveredRecipeIds, type DexEntry, type DexState } from "../../state/dex";
import {
  creditedDiscoveredCount,
  ingredientUnlockStep,
  resolveShopEntitlement,
} from "../../state/materialEntitlement";
import {
  buildRecipeChapters,
  legacyRecipeChapter,
  recipeChapter,
  recipeChapterSlot,
} from "../../state/recipeChapters";
import { totalStars } from "../mastery";
import { isTechniqueAffordanceOpen, techniqueAffordanceStep } from "../techniques/registration";
import { isTechniqueAffordanceOpenFor, productionTechniqueContext, type TechniqueRuntimeContext } from "../techniques/runtime";
import {
  LEGACY_PROGRESSION,
  SHOP_PROGRESSION,
  activeProgressionModel,
  progressionModelFor,
  type ProgressionInputs,
} from "./progressionModel";
import { EMPTY_SHOP_PROGRESS } from "./shopProgress";

/**
 * B案 Phase 1a (Issue #901), design §3.4 `progressionModel.legacyEquivalence`: on a set of representative saves, every
 * output of `LEGACY_PROGRESSION` (and of the rewired callers that now read it) equals the current function it wraps.
 *
 * Saves: empty, before the first discovery (starters owned, nothing discovered), early / mid ladder, the star gates
 * (goat-cheese 120★ / spinach 130★) on both sides, every late-floor boundary on both sides, and everything discovered.
 */

const CREDITED = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id);
const NON_CREDITED = RECIPES.filter((r) => !countsTowardLadder(r.id)).map((r) => r.id);
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);

function dexOf(ids: readonly string[], stars: DexEntry["bestStars"] = 1): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: stars, timesMade: 1 }));
}

/** `count` credited recipes at `stars`, with a total of exactly `starTotal` stars when given. */
function dexWithStars(count: number, starTotal: number): DexState {
  let left = starTotal;
  return CREDITED.slice(0, count).map((recipeId, i): DexEntry => {
    const remaining = count - i;
    const stars = Math.max(1, Math.min(5, left - (remaining - 1)));
    left -= stars;
    return { recipeId, discovered: true, bestScore: 60, bestStars: stars as DexEntry["bestStars"], timesMade: 1 };
  });
}

interface Save {
  name: string;
  inputs: ProgressionInputs;
}

function save(name: string, dex: DexState, owned: readonly string[] = [], unlocked: readonly string[] = []): Save {
  return { name, inputs: { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: unlocked, inventory: {}, shop: EMPTY_SHOP_PROGRESS } };
}

const lateFloorCounts = [...new Set(Object.values(LATE_ENTITLEMENT_FLOORS))].flatMap((f) => [f - 1, f]).filter((n) => n >= 0 && n <= CREDITED.length);

const SAVES: Save[] = [
  save("empty", []),
  save("pre-first-discovery (starters owned)", [], ["tomato-sauce", "mozzarella", "basil"]),
  save("first discovery", dexOf(["margherita"])),
  save("early (5)", dexOf(CREDITED.slice(0, 5))),
  save("mid (20) + owned finite material + stale ledger", dexOf(CREDITED.slice(0, 20)), [FINITE[FINITE.length - 1]!], [FINITE[0]!]),
  save("mid (49) + non-credited discoveries", dexOf([...CREDITED.slice(0, 49), ...NON_CREDITED])),
  save("star gate: 119★", dexWithStars(50, 119)),
  save("star gate: 120★", dexWithStars(50, 120)),
  save("star gate: 129★", dexWithStars(52, 129)),
  save("star gate: 130★", dexWithStars(52, 130)),
  ...lateFloorCounts.map((n) => save(`late floor boundary (${n})`, dexOf(CREDITED.slice(0, n)))),
  save("all discovered (3★)", dexOf(RECIPES.map((r) => r.id), 3)),
];

describe("LEGACY_PROGRESSION = the current functions (representative saves)", () => {
  it("the fixtures reach what they claim (star totals, late floors)", () => {
    expect(totalStars(SAVES.find((s) => s.name === "star gate: 119★")!.inputs.dex)).toBe(119);
    expect(totalStars(SAVES.find((s) => s.name === "star gate: 120★")!.inputs.dex)).toBe(120);
    expect(totalStars(SAVES.find((s) => s.name === "star gate: 130★")!.inputs.dex)).toBe(130);
    expect(lateFloorCounts.length).toBeGreaterThan(0);
  });

  it.each(SAVES)("resolveEntitlement: $name", ({ inputs }) => {
    const expected = resolveShopEntitlement(inputs.dex, inputs.ownedIngredientIds, inputs.unlockedForShopIngredientIds);
    const actual = LEGACY_PROGRESSION.resolveEntitlement(inputs);
    expect(actual).toEqual(expected);
    // A no-op keeps returning the input ledger by reference (the reducer relies on this to skip a write).
    const settled = { ...inputs, unlockedForShopIngredientIds: expected.unlockedForShopIngredientIds };
    expect(LEGACY_PROGRESSION.resolveEntitlement(settled).unlockedForShopIngredientIds).toBe(settled.unlockedForShopIngredientIds);
  });

  it.each(SAVES)("menuRecipeIds = the discovered ids, in Dex order: $name", ({ inputs }) => {
    expect(LEGACY_PROGRESSION.menuRecipeIds(inputs)).toEqual(discoveredRecipeIds(inputs.dex));
  });

  it.each(SAVES)("isMaterialReached = ladder step <= credited discovered count, for every ingredient: $name", ({ inputs }) => {
    const credited = creditedDiscoveredCount(inputs.dex);
    for (const i of INGREDIENTS) {
      const step = ingredientUnlockStep(i.id);
      expect(LEGACY_PROGRESSION.isMaterialReached(i.id, inputs), i.id).toBe(step !== null && credited >= step);
    }
    expect(LEGACY_PROGRESSION.isMaterialReached("no-such-ingredient", inputs)).toBe(false);
  });

  it.each(SAVES)("isChapterOpen is always true (chapters are display only): $name", ({ inputs }) => {
    for (const chapter of [1, 2, 3, 4, 5, 99]) expect(LEGACY_PROGRESSION.isChapterOpen(chapter, inputs)).toBe(true);
  });

  it("chapterOf = the legacy chapter rule on DISCOVERY_LADDER, for every recipe", () => {
    for (const r of RECIPES) expect(LEGACY_PROGRESSION.chapterOf(r), r.id).toBe(legacyRecipeChapter(r, DISCOVERY_LADDER));
  });
});

describe("rewired chapter callers (recipeChapters.ts) give the same chapters as the explicit legacy ladder", () => {
  it("recipeChapter / recipeChapterSlot without a ladder = with DISCOVERY_LADDER", () => {
    for (const r of RECIPES) {
      expect(recipeChapter(r), r.id).toBe(recipeChapter(r, DISCOVERY_LADDER));
      expect(recipeChapterSlot(r), r.id).toBe(recipeChapterSlot(r, RECIPES, DISCOVERY_LADDER));
    }
  });

  it("buildRecipeChapters() = buildRecipeChapters(RECIPES, DISCOVERY_LADDER)", () => {
    expect(buildRecipeChapters()).toEqual(buildRecipeChapters(RECIPES, DISCOVERY_LADDER));
  });
});

describe("rewired technique affordance = the pre-1a formula", () => {
  const before = (id: (typeof TECHNIQUES)[number]["id"], dex: DexState, context: TechniqueRuntimeContext) =>
    isTechniqueAffordanceOpen(techniqueAffordanceStep(id, context.catalog, context.materialStep), creditedDiscoveredCount(dex, context.countsTowardLadder));

  const contexts: [string, TechniqueRuntimeContext][] = [
    ["production", productionTechniqueContext()],
    // A catalog-only override keeps the production reach rule, so it also goes through the port.
    ["production reach + reversed catalog", { ...productionTechniqueContext(), catalog: [...productionTechniqueContext().catalog].reverse() }],
    // An own reach rule keeps that rule (not the port).
    ["custom materialStep", { ...productionTechniqueContext(), materialStep: () => 3 }],
    ["custom countsTowardLadder", { ...productionTechniqueContext(), countsTowardLadder: () => false }],
  ];

  it.each(SAVES)("every technique, every context: $name", ({ inputs }) => {
    for (const [label, context] of contexts) {
      for (const t of TECHNIQUES) {
        expect(isTechniqueAffordanceOpenFor(t.id, inputs.dex, context), `${label} / ${t.id}`).toBe(before(t.id, inputs.dex, context));
      }
    }
  });
});

describe("the flag picks the model", () => {
  it("this build (no Preview / DEV instruction) runs LEGACY_PROGRESSION", () => {
    expect(activeProgressionModel()).toBe(LEGACY_PROGRESSION);
    expect(activeProgressionModel().id).toBe("legacy");
  });

  it("progressionModelFor maps each id to its model", () => {
    expect(progressionModelFor("legacy")).toBe(LEGACY_PROGRESSION);
    expect(progressionModelFor("shop")).toBe(SHOP_PROGRESSION);
    expect(SHOP_PROGRESSION.id).toBe("shop");
  });
});
