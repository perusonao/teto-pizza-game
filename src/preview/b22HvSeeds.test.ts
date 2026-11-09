import { describe, expect, it } from "vitest";
import { getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { loadSave, type StorageLike } from "../state/persistence";
import { B22_HV_SCENARIOS, B22_RECIPE_IDS, applyB22HvSeed, b22OwnedMaterials, b22TargetMaterials, buildB22HvSnapshot, findB22HvScenario, parseB22HvParam } from "./b22HvSeeds";
import { applyPreviewHvSeed } from "./hvSeeds";

/** Expansion Batch 22 Preview-only HV seeds: consistent saves, the Shop offers the target's new materials as NEW, the target recipe is undiscovered, only the Preview key is written, a reload never reseeds. */
function memory(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}
const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;

describe("B22 HV seeds", () => {
  it("parses only its own ids (one per B22 recipe)", () => {
    expect(B22_HV_SCENARIOS.map((s) => s.recipeId)).toEqual([...B22_RECIPE_IDS]);
    for (const s of B22_HV_SCENARIOS) expect(parseB22HvParam(`?hv=${s.id}`)).toBe(s.id);
    for (const bad of ["?hv=b21-taco", "?hv=b18-bbq", "?hv=normal", "", "?x=1", undefined, 7]) expect(parseB22HvParam(bad)).toBeNull();
  });

  it.each(B22_HV_SCENARIOS)("$id: a consistent save — the target's own materials are not owned, the target is not discovered, every discovered recipe's finite materials are owned, owned materials are stocked", (s) => {
    const snap = buildB22HvSnapshot(s);
    const own = b22TargetMaterials(s.recipeId);
    expect(own.length).toBeGreaterThan(0);
    for (const id of own) expect(snap.ownedIngredientIds, id).not.toContain(id);
    expect(b22OwnedMaterials(s).some((id) => own.includes(id))).toBe(false);
    const dexIds = snap.dex.map((e) => e.recipeId);
    expect(dexIds).not.toContain(s.recipeId);
    for (const r of RECIPES.filter((x) => dexIds.includes(x.id))) {
      for (const q of r.requiredIngredients) if (isFinite(q.ingredientId)) expect(snap.ownedIngredientIds, `${r.id}/${q.ingredientId}`).toContain(q.ingredientId);
    }
    for (const id of snap.ownedIngredientIds.filter(isFinite)) expect(snap.inventory[id], id).toBeGreaterThan(0);
  });

  it.each(B22_HV_SCENARIOS)("$id: the load-time entitlement grants the target's new materials (the Shop offers them as NEW)", (s) => {
    const snap = buildB22HvSnapshot(s);
    const ent = resolveShopEntitlement(snap.dex, snap.ownedIngredientIds, snap.unlockedForShopIngredientIds ?? []);
    for (const id of b22TargetMaterials(s.recipeId)) expect(ent.unlockedForShopIngredientIds, id).toContain(id);
  });

  it("applying the seed writes a loadable save with the target undiscovered; a reload does not reseed", () => {
    const storage = memory();
    expect(applyPreviewHvSeed("?hv=b22-truffle", storage, "navigate")).toBe("b22-truffle");
    const stored = loadSave(storage);
    expect(stored.dex.some((e) => e.recipeId === "black-truffle-pizza")).toBe(false);
    expect(stored.pitzBalance).toBe(findB22HvScenario("b22-truffle")!.pitz);
    const before = [...storage.map.entries()].join("|");
    expect(applyPreviewHvSeed("?hv=b22-truffle", storage, "reload")).toBeNull();
    expect([...storage.map.entries()].join("|")).toBe(before);
    for (const s of B22_HV_SCENARIOS) expect(applyB22HvSeed(s.id, memory()), s.id).toBe(true);
  });
});
