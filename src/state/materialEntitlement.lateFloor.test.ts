import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENTS } from "../data/ingredients";
import { LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, lateCatalogEnabled } from "../data/lateCatalog";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { appendLadderSteps } from "../logic/discoveryLadder";
import { ladderSave } from "../logic/catalog/testSupport/catalogDerived";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

const ROE = "salmon-roe";
const YUZU_KOSHO = "yuzu-kosho";
const LATE_MATERIALS = [ROE, YUZU_KOSHO];
const dexOf = (ids: readonly string[]): DexEntry[] => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
/** A save as an E5-era player holds it before ever launching the E5 build: the ledger has no late material yet. */
const staleSave = (count: number) => {
  const raw = ladderSave(count);
  return {
    dex: dexOf(raw.dex.map((e) => e.recipeId)),
    owned: raw.ownedIngredientIds.filter((i) => !LATE_MATERIALS.includes(i)),
    ledger: raw.unlockedForShopIngredientIds.filter((i) => !LATE_MATERIALS.includes(i)),
  };
};
/** The production ladder with `k` more ordinary steps before the late one (the shape a later ordinary batch gives it). */
const withOrdinary = (k: number) => {
  const ordinary = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
  const extra = Array.from({ length: k }, (_, i) => ({ ingredientIds: [`future-material-${i}`], keyRecipeId: `future-recipe-${i}` }));
  return appendLadderSteps({ ...DISCOVERY_LADDER, steps: ordinary }, [...extra, ...LATE_LADDER_STEPS]);
};

describe("late material compatibility floor (E5 follow-up)", () => {
  it("the floor table names only late materials the catalog sells, and never later than the step number the ladder derives today", () => {
    expect(lateCatalogEnabled()).toBe(true);
    for (const [id, floor] of Object.entries(LATE_ENTITLEMENT_FLOORS)) {
      expect(INGREDIENTS.some((i) => i.id === id)).toBe(true);
      expect(LATE_LADDER_STEPS.some((s) => s.ingredientIds.includes(id))).toBe(true);
      const derived = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;
      expect(floor).toBeLessThanOrEqual(derived);
    }
  });

  it.each([0, 1, 2, 3])("a never-launched save at the E5-era step gets the late material with %i ordinary steps added after E5", (k) => {
    const s = staleSave(57);
    const ladder = withOrdinary(k);
    expect(ladder.steps.find((x) => x.ingredientIds.includes(ROE))!.step).toBe(57 + k);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, ladder);
    expect(r.unlockedForShopIngredientIds).toContain(ROE);
    expect(r.newlyUnlockedMaterialIds).toContain(ROE); // announced once, like any ladder unlock
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger); // existing ledger order untouched
  });

  it("below the floor nothing is granted early", () => {
    const s = staleSave(56);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, withOrdinary(2));
    expect(r.unlockedForShopIngredientIds).not.toContain(ROE);
  });

  it("a second resolve announces nothing and returns the ledger by reference (idempotent, never re-locks)", () => {
    const s = staleSave(57);
    const first = resolveShopEntitlement(s.dex, s.owned, s.ledger, withOrdinary(1));
    const second = resolveShopEntitlement(s.dex, s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(second.newlyUnlockedMaterialIds).toEqual([]);
    expect(second.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
    // a smaller Dex later does not take it back
    const fewer = resolveShopEntitlement(dexOf([]), s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(fewer.unlockedForShopIngredientIds).toContain(ROE);
  });

  it("a save that already holds the material (ledger, or owned) is unchanged", () => {
    const raw = ladderSave(57);
    const dex = dexOf(raw.dex.map((e) => e.recipeId));
    const held = resolveShopEntitlement(dex, raw.ownedIngredientIds, raw.unlockedForShopIngredientIds, withOrdinary(1));
    expect(held.unlockedForShopIngredientIds.filter((i) => i === ROE)).toHaveLength(1);
    const s = staleSave(57);
    const owned = resolveShopEntitlement(s.dex, [...s.owned, ROE], s.ledger, withOrdinary(1));
    expect(owned.unlockedForShopIngredientIds.filter((i) => i === ROE)).toHaveLength(1);
  });

  it("a ladder that does not sell the material (late catalog OFF shape) is untouched", () => {
    const off = { ...DISCOVERY_LADDER, steps: DISCOVERY_LADDER.steps.filter((s) => !s.ingredientIds.includes(ROE)) };
    const s = staleSave(57);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, off);
    expect(r.unlockedForShopIngredientIds).not.toContain(ROE);
  });

  it("an id this build does not know stays in the ledger", () => {
    const s = staleSave(57);
    const r = resolveShopEntitlement(s.dex, s.owned, [...s.ledger, "material-from-a-newer-build"], withOrdinary(1));
    expect(r.unlockedForShopIngredientIds).toContain("material-from-a-newer-build");
    expect(r.unlockedForShopIngredientIds).toContain(ROE);
  });
});

describe("late material compatibility floor: yuzu-kosho (New Sauces Phase B U1)", () => {
  it.each([0, 1, 2, 3])("a never-launched save at the step it shipped at gets yuzu-kosho (and the roe) with %i ordinary steps added later", (k) => {
    const s = staleSave(58);
    const ladder = withOrdinary(k);
    expect(ladder.steps.find((x) => x.ingredientIds.includes(YUZU_KOSHO))!.step).toBe(58 + k);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, ladder);
    expect(r.unlockedForShopIngredientIds).toEqual(expect.arrayContaining([ROE, YUZU_KOSHO]));
    expect(r.newlyUnlockedMaterialIds).toEqual(expect.arrayContaining([ROE, YUZU_KOSHO]));
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger);
  });

  it("each material has its own floor: count 57 gets the roe only, count 56 neither", () => {
    const at57 = staleSave(57);
    const r57 = resolveShopEntitlement(at57.dex, at57.owned, at57.ledger, withOrdinary(2));
    expect(r57.unlockedForShopIngredientIds).toContain(ROE);
    expect(r57.unlockedForShopIngredientIds).not.toContain(YUZU_KOSHO);
    const at56 = staleSave(56);
    const r56 = resolveShopEntitlement(at56.dex, at56.owned, at56.ledger, withOrdinary(2));
    expect(r56.unlockedForShopIngredientIds).not.toEqual(expect.arrayContaining([ROE]));
    expect(r56.unlockedForShopIngredientIds).not.toContain(YUZU_KOSHO);
  });

  it("a save that already holds the sauce (ledger or owned) is unchanged, and a second resolve announces nothing", () => {
    const raw = ladderSave(58);
    const dex = dexOf(raw.dex.map((e) => e.recipeId));
    const held = resolveShopEntitlement(dex, raw.ownedIngredientIds, raw.unlockedForShopIngredientIds, withOrdinary(1));
    expect(held.unlockedForShopIngredientIds.filter((i) => i === YUZU_KOSHO)).toHaveLength(1);
    const s = staleSave(58);
    const first = resolveShopEntitlement(s.dex, [...s.owned, YUZU_KOSHO], s.ledger, withOrdinary(1));
    expect(first.unlockedForShopIngredientIds.filter((i) => i === YUZU_KOSHO)).toHaveLength(1);
    const second = resolveShopEntitlement(s.dex, s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(second.newlyUnlockedMaterialIds).toEqual([]);
    expect(second.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
  });
});

