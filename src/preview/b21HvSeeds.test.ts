import { describe, expect, it } from "vitest";
import { getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { loadSave, type StorageLike } from "../state/persistence";
import {
  B21_HV_SCENARIOS,
  B21_MATERIAL_IDS,
  B21_NEW_RECIPE_IDS,
  applyB21HvSeed,
  b21LadderPrefixMaterials,
  buildB21HvSnapshot,
  findB21HvScenario,
  parseB21HvParam,
} from "./b21HvSeeds";
import { applyPreviewHvSeed } from "./hvSeeds";

/** Expansion Batch 21 Preview-only HV seeds: consistent saves, the Shop offers the six materials as NEW, the new recipes are undiscovered, only the Preview key is written, a reload never reseeds. */
function memory(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}
const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;

describe("B21 HV seeds", () => {
  it("parses only its own ids", () => {
    expect(parseB21HvParam("?hv=b21-taco")).toBe("b21-taco");
    expect(parseB21HvParam("?hv=b21-okonomiyaki")).toBe("b21-okonomiyaki");
    for (const bad of ["?hv=b18-bbq", "?hv=normal", "", "?x=1", undefined, 7]) expect(parseB21HvParam(bad)).toBeNull();
  });

  it.each(B21_HV_SCENARIOS)("$id: a consistent save — no B21 material owned, no B21 recipe discovered, every discovered recipe's finite materials owned, owned materials stocked", (s) => {
    const snap = buildB21HvSnapshot(s);
    for (const id of B21_MATERIAL_IDS) expect(snap.ownedIngredientIds).not.toContain(id);
    expect(b21LadderPrefixMaterials().some((id) => B21_MATERIAL_IDS.includes(id))).toBe(false);
    const dexIds = snap.dex.map((e) => e.recipeId);
    for (const id of B21_NEW_RECIPE_IDS) expect(dexIds).not.toContain(id);
    for (const r of RECIPES.filter((x) => dexIds.includes(x.id))) {
      for (const q of r.requiredIngredients) if (isFinite(q.ingredientId)) expect(snap.ownedIngredientIds, `${r.id}/${q.ingredientId}`).toContain(q.ingredientId);
    }
    for (const id of snap.ownedIngredientIds.filter(isFinite)) expect(snap.inventory[id], id).toBeGreaterThan(0);
    expect(dexIds.length).toBe(RECIPES.length - B21_NEW_RECIPE_IDS.length);
  });

  it("the load-time entitlement grants all six materials (the Shop offers them as NEW)", () => {
    const snap = buildB21HvSnapshot(B21_HV_SCENARIOS[0]);
    const ent = resolveShopEntitlement(snap.dex, snap.ownedIngredientIds, snap.unlockedForShopIngredientIds ?? []);
    for (const id of B21_MATERIAL_IDS) expect(ent.unlockedForShopIngredientIds, id).toContain(id);
  });

  it("applying the seed writes a loadable save with the target undiscovered; a reload does not reseed", () => {
    const storage = memory();
    expect(applyPreviewHvSeed("?hv=b21-taco", storage, "navigate")).toBe("b21-taco");
    const stored = loadSave(storage);
    expect(stored.dex.some((e) => e.recipeId === "taco-pizza")).toBe(false);
    expect(stored.pitzBalance).toBe(findB21HvScenario("b21-taco")!.pitz);
    const before = [...storage.map.entries()].join("|");
    expect(applyPreviewHvSeed("?hv=b21-taco", storage, "reload")).toBeNull();
    expect([...storage.map.entries()].join("|")).toBe(before);
    expect(applyB21HvSeed("b21-okonomiyaki", memory())).toBe(true);
  });
});
