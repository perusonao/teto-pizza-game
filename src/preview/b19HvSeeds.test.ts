import { afterEach, describe, expect, it, vi } from "vitest";
import { getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries, researchEntryLabel } from "../logic/discovery/researchEntry";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import type { StorageLike } from "../state/persistence";
import { B18_HV_SCENARIOS } from "./b18HvSeeds";
import {
  B19_HV_SCENARIOS,
  B19_MATERIAL_ID,
  B19_NEW_RECIPE_IDS,
  b19LadderPrefixMaterials,
  buildB19HvSnapshot,
  findB19HvScenario,
  parseB19HvParam,
  type B19HvScenarioId,
} from "./b19HvSeeds";
import { HV_SCENARIOS } from "./hvSeeds";

/** Batch 19 (#774 / PR #783) Preview-only HV seeds: same checks as ./b18HvSeeds.test.ts. Bundle exclusion: ./previewIsolation.gate.test.ts. */

function memory(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const scenario = (id: B19HvScenarioId) => findB19HvScenario(id)!;
const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;
const discoveredIds = (id: B19HvScenarioId) => buildB19HvSnapshot(scenario(id)).dex.map((e) => e.recipeId);
const labelsOf = (owned: readonly string[], dexIds: readonly string[]) =>
  Object.fromEntries(
    deriveResearchEntries({ dex: dexIds.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 })), ownedIngredientIds: owned }).entries.map((e) => [
      e.recipeId,
      researchEntryLabel(e),
    ]),
  );

describe("B19 HV scenarios", () => {
  it("are exactly the two documented ids, distinct from every Hint 5.0 / B18 id", () => {
    expect(B19_HV_SCENARIOS.map((s) => s.id)).toEqual(["b19-pesto-burrata", "b19-crudaiola"]);
    for (const s of B19_HV_SCENARIOS) {
      expect(HV_SCENARIOS.some((h) => (h.id as string) === s.id)).toBe(false);
      expect(B18_HV_SCENARIOS.some((h) => (h.id as string) === s.id)).toBe(false);
      expect(RECIPES.some((r) => r.id === s.recipeId), s.recipeId).toBe(true);
    }
    expect(B19_HV_SCENARIOS.map((s) => s.recipeId)).toEqual([...B19_NEW_RECIPE_IDS]);
  });

  it("parse only `?hv=<b19 id>`; anything else is ignored", () => {
    expect(parseB19HvParam("?hv=b19-crudaiola")).toBe("b19-crudaiola");
    expect(parseB19HvParam("?x=1&hv=b19-pesto-burrata")).toBe("b19-pesto-burrata");
    for (const search of ["?hv=normal", "?hv=b19", "?hv=B19-CRUDAIOLA", "?b19=1", "?hv=b18-bbq", "", null, undefined, 1, {}]) expect(parseB19HvParam(search)).toBeNull();
  });

  it("the save is internally consistent, both new recipes are undiscovered, burrata is not owned", () => {
    for (const s of B19_HV_SCENARIOS) {
      const snap = buildB19HvSnapshot(s);
      const owned = new Set(snap.ownedIngredientIds);
      expect(snap.ownedIngredientIds.length, s.id).toBe(owned.size);
      expect(snap.ownedIngredientIds, s.id).not.toContain(B19_MATERIAL_ID);
      expect(snap.ownedIngredientIds.filter(isFinite), s.id).toEqual(b19LadderPrefixMaterials());
      for (const entry of snap.dex) {
        const recipe = RECIPES.find((r) => r.id === entry.recipeId)!;
        for (const { ingredientId } of recipe.requiredIngredients) expect(!isFinite(ingredientId) || owned.has(ingredientId), `${s.id}: ${recipe.id} needs ${ingredientId}`).toBe(true);
      }
      for (const r of B19_NEW_RECIPE_IDS) expect(snap.dex.some((e) => e.recipeId === r), `${s.id}: ${r}`).toBe(false);
      for (const id of snap.ownedIngredientIds.filter(isFinite)) expect(snap.inventory[id], `${s.id}: ${id}`).toBeGreaterThan(0);
      expect(snap.discoveryHintFacts, s.id).toEqual({});
      expect(snap.pitzBalance, s.id).toBeGreaterThanOrEqual(120);
    }
    expect(buildB19HvSnapshot(scenario("b19-pesto-burrata"))).toEqual(buildB19HvSnapshot(scenario("b19-crudaiola")));
  });

  it("the Shop entitlement offers burrata; after buying it both new recipes are Research Entries named only by the ingredient", () => {
    const snap = buildB19HvSnapshot(scenario("b19-crudaiola"));
    const shop = resolveShopEntitlement(snap.dex, snap.ownedIngredientIds, snap.unlockedForShopIngredientIds ?? []);
    expect(shop.unlockedForShopIngredientIds).toContain(B19_MATERIAL_ID);
    const before = labelsOf(snap.ownedIngredientIds, discoveredIds("b19-crudaiola"));
    for (const r of B19_NEW_RECIPE_IDS) expect(before[r], r).toBeUndefined();
    const labels = labelsOf([...snap.ownedIngredientIds, B19_MATERIAL_ID], discoveredIds("b19-crudaiola"));
    for (const r of B19_NEW_RECIPE_IDS) expect(labels[r], r).toMatch(/^？？？ピザ [AB]（ブッラータ）$/);
    for (const label of Object.values(labels)) for (const r of RECIPES) expect(label.includes(r.nameJa), `${label} leaks ${r.nameJa}`).toBe(false);
  });
});

describe("B19 HV seed application (Preview save key only)", () => {
  async function previewModules() {
    vi.resetModules();
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    const persistence = await import("../state/persistence");
    const seeds = await import("./hvSeeds");
    return { persistence, seeds };
  }

  it("writes only the Preview key and never reads or writes the production save", async () => {
    const { persistence, seeds } = await previewModules();
    expect(persistence.SAVE_STORAGE_KEY).toBe("teto-pizza-preview-save-v1");
    const production = JSON.stringify({ sentinel: "PRODUCTION-SAVE", pitzBalance: 999 });
    const storage = memory({ "teto-pizza-save-v1": production });
    const reads: string[] = [];
    const spy: StorageLike = { getItem: (k) => (reads.push(k), storage.getItem(k)), setItem: (k, v) => storage.setItem(k, v), removeItem: (k) => storage.removeItem(k) };
    for (const s of B19_HV_SCENARIOS) {
      expect(seeds.applyPreviewHvSeed(`?hv=${s.id}`, spy, "navigate"), s.id).toBe(s.id);
      expect(storage.map.get("teto-pizza-save-v1"), s.id).toBe(production);
      expect(reads.every((k) => k === persistence.SAVE_STORAGE_KEY), `${s.id}: ${reads.join(",")}`).toBe(true);
      const stored = persistence.loadSave(spy);
      expect(stored.pitzBalance, s.id).toBe(s.pitz);
      expect(stored.ownedIngredientIds, s.id).not.toContain(B19_MATERIAL_ID);
      for (const r of B19_NEW_RECIPE_IDS) expect(stored.dex.some((e) => e.recipeId === r), `${s.id}: ${r}`).toBe(false);
    }
    expect([...storage.map.keys()].sort()).toEqual(["teto-pizza-preview-save-v1", "teto-pizza-save-v1"]);
  });

  it("a reload never reseeds; an unknown id and a missing storage do nothing; B18 and Hint 5.0 ids still route to their own seeds", async () => {
    const { persistence, seeds } = await previewModules();
    const storage = memory();
    expect(seeds.applyPreviewHvSeed("?hv=b19-crudaiola", storage, "navigate")).toBe("b19-crudaiola");
    persistence.persistProgress({ ...buildB19HvSnapshot(scenario("b19-crudaiola")), pitzBalance: 111 }, storage);
    for (const type of ["reload", "back_forward"]) expect(seeds.applyPreviewHvSeed("?hv=b19-crudaiola", storage, type), type).toBeNull();
    expect(seeds.applyPreviewHvSeed("?hv=b19-unknown", storage, "navigate")).toBeNull();
    expect(seeds.applyPreviewHvSeed("?hv=b19-crudaiola", null, "navigate")).toBeNull();
    expect(persistence.loadSave(storage).pitzBalance).toBe(111);
    expect(seeds.applyPreviewHvSeed("?hv=b18-bbq", memory(), "navigate")).toBe("b18-bbq");
    for (const s of seeds.HV_SCENARIOS) expect(seeds.applyPreviewHvSeed(`?hv=${s.id}`, memory(), "navigate"), s.id).toBe(s.id);
  });

  it("the seeded save loads with the ordinary entitlement: burrata is a NEW Shop entry and not owned", async () => {
    const { persistence, seeds } = await previewModules();
    const storage = memory();
    seeds.applyPreviewHvSeed("?hv=b19-pesto-burrata", storage, "navigate");
    const stored = persistence.loadSave(storage);
    expect(stored.ownedIngredientIds).not.toContain(B19_MATERIAL_ID);
    const shop = resolveShopEntitlement(stored.dex, stored.ownedIngredientIds, stored.unlockedForShopIngredientIds);
    expect(shop.newlyUnlockedMaterialIds).toContain(B19_MATERIAL_ID);
  });
});

describe("B19 HV seed boundaries (static)", () => {
  it("imports no Firebase / network module and no reducer: it only builds and writes a save through persistence", async () => {
    const source = (await import("./b19HvSeeds.ts?raw")).default as string;
    const imports = [...source.matchAll(/^import[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../data/discoveryLadder", "../data/ingredients", "../data/recipes", "../state/dex", "../state/persistence", "./hint5PreviewOptIn"].sort());
    expect(source).not.toMatch(/firebase|fetch\(|XMLHttpRequest|teto-pizza-save-v1|gameReducer/);
  });
});
