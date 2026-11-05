import { afterEach, describe, expect, it, vi } from "vitest";
import { getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries, researchEntryLabel } from "../logic/discovery/researchEntry";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import type { StorageLike } from "../state/persistence";
import {
  B18_HV_SCENARIOS,
  B18_MATERIAL_ID,
  B18_NEW_RECIPE_IDS,
  b18LadderPrefixMaterials,
  buildB18HvSnapshot,
  findB18HvScenario,
  parseB18HvParam,
  type B18HvScenarioId,
} from "./b18HvSeeds";
import { HV_SCENARIOS, buildHvSnapshot } from "./hvSeeds";

/**
 * Expansion Batch 18 (#748) Preview-only HV seeds (Owner approach A, Issue #748 comment 6656496881).
 * Checks: the three scenarios are internally consistent saves, the Shop offers cilantro as NEW, the new recipes are
 * undiscovered, the Research labels are the Owner-approved ones (and leak no identity), the seed writes only the
 * Preview key, a reload never reseeds, and the Hint 5.0 seeds are untouched. The production-bundle exclusion is
 * ./previewIsolation.gate.test.ts; the behaviour on real builds is e2e/b18-hv-preview.spec.ts.
 */

function memory(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const scenario = (id: B18HvScenarioId) => findB18HvScenario(id)!;
const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;
const discoveredIds = (id: B18HvScenarioId) => buildB18HvSnapshot(scenario(id)).dex.map((e) => e.recipeId);
const labelsOf = (owned: readonly string[], dexIds: readonly string[]) =>
  Object.fromEntries(
    deriveResearchEntries({ dex: dexIds.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 })), ownedIngredientIds: owned }).entries.map((e) => [
      e.recipeId,
      researchEntryLabel(e),
    ]),
  );

describe("B18 HV scenarios", () => {
  it("are exactly the three documented ids, distinct from every Hint 5.0 id", () => {
    expect(B18_HV_SCENARIOS.map((s) => s.id)).toEqual(["b18-baingan", "b18-reina", "b18-bbq"]);
    for (const s of B18_HV_SCENARIOS) expect(HV_SCENARIOS.some((h) => (h.id as string) === s.id)).toBe(false);
    expect(B18_HV_SCENARIOS.map((s) => s.recipeId)).toEqual(["baingan-bharta-pizza", "reina-pepiada-pizza", "bbq-chicken-pizza"]);
    for (const s of B18_HV_SCENARIOS) expect(RECIPES.some((r) => r.id === s.recipeId), s.recipeId).toBe(true);
  });

  it("parse only `?hv=<b18 id>`; anything else is ignored", () => {
    expect(parseB18HvParam("?hv=b18-baingan")).toBe("b18-baingan");
    expect(parseB18HvParam("?x=1&hv=b18-bbq")).toBe("b18-bbq");
    for (const search of ["?hv=normal", "?hv=b18", "?hv=B18-BAINGAN", "?b18=baingan", "", null, undefined, 1, {}]) expect(parseB18HvParam(search)).toBeNull();
  });

  it("every save is internally consistent: each discovered recipe is makeable with owned materials, owned materials are stocked, no hint facts", () => {
    for (const s of B18_HV_SCENARIOS) {
      const snap = buildB18HvSnapshot(s);
      const owned = new Set(snap.ownedIngredientIds);
      expect(snap.ownedIngredientIds.length, s.id).toBe(owned.size);
      for (const entry of snap.dex) {
        const recipe = RECIPES.find((r) => r.id === entry.recipeId)!;
        for (const { ingredientId } of recipe.requiredIngredients) expect(!isFinite(ingredientId) || owned.has(ingredientId), `${s.id}: ${recipe.id} needs ${ingredientId}`).toBe(true);
      }
      for (const id of snap.ownedIngredientIds.filter(isFinite)) expect(snap.inventory[id], `${s.id}: ${id}`).toBeGreaterThan(0);
      expect(snap.discoveryHintFacts, s.id).toEqual({});
      expect(snap.pitzBalance, s.id).toBeGreaterThanOrEqual(120); // enough to buy cilantro (T4, 120 Pitz) and more
      expect(snap.dex.some((e) => e.recipeId === s.recipeId), s.id).toBe(false);
    }
  });

  it("baingan / reina: cilantro is not owned, both new recipes are undiscovered, and the Shop entitlement offers cilantro", () => {
    for (const id of ["b18-baingan", "b18-reina"] as const) {
      const snap = buildB18HvSnapshot(scenario(id));
      expect(snap.ownedIngredientIds, id).not.toContain(B18_MATERIAL_ID);
      for (const r of B18_NEW_RECIPE_IDS) expect(snap.dex.some((e) => e.recipeId === r), `${id}: ${r}`).toBe(false);
      expect(snap.ownedIngredientIds.filter(isFinite), id).toEqual(b18LadderPrefixMaterials());
      const shop = resolveShopEntitlement(snap.dex, snap.ownedIngredientIds, snap.unlockedForShopIngredientIds ?? []);
      expect(shop.unlockedForShopIngredientIds, id).toContain(B18_MATERIAL_ID);
      // Before the purchase neither new recipe is a Research Entry.
      const before = labelsOf(snap.ownedIngredientIds, discoveredIds(id));
      for (const r of B18_NEW_RECIPE_IDS) expect(before[r], `${id}: ${r}`).toBeUndefined();
    }
    expect(buildB18HvSnapshot(scenario("b18-baingan"))).toEqual({ ...buildB18HvSnapshot(scenario("b18-reina")) });
  });

  it("baingan / reina: after buying cilantro, both are Research Entries with the ordinary cohort labels (B / A), and no identity leaks", () => {
    const snap = buildB18HvSnapshot(scenario("b18-baingan"));
    const labels = labelsOf([...snap.ownedIngredientIds, B18_MATERIAL_ID], discoveredIds("b18-baingan"));
    expect(labels["baingan-bharta-pizza"]).toBe("？？？ピザ B（パクチー）");
    expect(labels["reina-pepiada-pizza"]).toBe("？？？ピザ A（パクチー）");
    // Only the two new recipes are opened by cilantro in this save.
    expect(Object.keys(labels).sort()).toEqual(expect.arrayContaining([...B18_NEW_RECIPE_IDS].sort()));
    const cilantroEntries = Object.entries(labels).filter(([, label]) => label.includes("パクチー")).map(([id]) => id).sort();
    expect(cilantroEntries).toEqual([...B18_NEW_RECIPE_IDS].sort());
    for (const label of Object.values(labels)) for (const r of RECIPES) expect(label.includes(r.nameJa), `${label} leaks ${r.nameJa}`).toBe(false);
  });

  it("bbq: bbq-sauce THEN cilantro owned, bbq-chicken-pizza undiscovered -> the Owner-approved 「？？？ピザ B（パクチー）」; the other order is named by the sauce", () => {
    const snap = buildB18HvSnapshot(scenario("b18-bbq"));
    const owned = snap.ownedIngredientIds;
    expect(owned.slice(-2)).toEqual(["bbq-sauce", B18_MATERIAL_ID]);
    const dexIds = discoveredIds("b18-bbq");
    // Both new recipes are makeable here (cilantro owned), so they are discovered: the BBQ entry is the label under check.
    for (const r of B18_NEW_RECIPE_IDS) expect(dexIds, r).toContain(r);
    const labels = labelsOf(owned, dexIds);
    expect(labels["bbq-chicken-pizza"]).toBe("？？？ピザ B（パクチー）");
    // The canonical ladder order (cilantro first, bbq-sauce last): no letter, named by the sauce (OD-B18-1).
    const ladderOrder = [...owned.slice(0, -2), B18_MATERIAL_ID, "bbq-sauce"];
    expect(labelsOf(ladderOrder, dexIds)["bbq-chicken-pizza"]).toBe("？？？ピザ（バーベキューソース）");
    for (const label of Object.values(labels)) for (const r of RECIPES) expect(label.includes(r.nameJa), `${label} leaks ${r.nameJa}`).toBe(false);
  });

  it("the Hint 5.0 seeds are untouched (their builder output does not depend on the B18 module)", () => {
    for (const s of HV_SCENARIOS) {
      const snap = buildHvSnapshot(s);
      expect(snap.ownedIngredientIds, s.id).not.toContain(B18_MATERIAL_ID);
      for (const r of B18_NEW_RECIPE_IDS) expect(snap.dex.some((e) => e.recipeId === r), `${s.id}: ${r}`).toBe(false);
    }
  });
});

describe("B18 HV seed application (Preview save key only)", () => {
  async function previewModules() {
    vi.resetModules();
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    const persistence = await import("../state/persistence");
    const seeds = await import("./hvSeeds");
    const b18 = await import("./b18HvSeeds");
    return { persistence, seeds, b18 };
  }

  it("writes only the Preview key and never reads or writes the production save", async () => {
    const { persistence, seeds } = await previewModules();
    expect(persistence.SAVE_STORAGE_KEY).toBe("teto-pizza-preview-save-v1");
    const production = JSON.stringify({ sentinel: "PRODUCTION-SAVE", pitzBalance: 999 });
    const storage = memory({ "teto-pizza-save-v1": production });
    const reads: string[] = [];
    const spy: StorageLike = { getItem: (k) => (reads.push(k), storage.getItem(k)), setItem: (k, v) => storage.setItem(k, v), removeItem: (k) => storage.removeItem(k) };
    for (const s of B18_HV_SCENARIOS) {
      expect(seeds.applyPreviewHvSeed(`?hv=${s.id}`, spy, "navigate"), s.id).toBe(s.id);
      expect(storage.map.get("teto-pizza-save-v1"), s.id).toBe(production);
      expect(reads.every((k) => k === persistence.SAVE_STORAGE_KEY), `${s.id}: ${reads.join(",")}`).toBe(true);
      const stored = persistence.loadSave(spy);
      expect(stored.pitzBalance, s.id).toBe(s.pitz);
      expect(stored.dex.some((e) => e.recipeId === s.recipeId), s.id).toBe(false);
      expect(stored.ownedIngredientIds, s.id).toEqual(buildB18HvSnapshot(s).ownedIngredientIds);
      expect(stored.dex.map((e) => e.recipeId).sort(), s.id).toEqual(buildB18HvSnapshot(s).dex.map((e) => e.recipeId).sort());
    }
    expect([...storage.map.keys()].sort()).toEqual(["teto-pizza-preview-save-v1", "teto-pizza-save-v1"]);
  });

  it("a reload / history step never reseeds; an unknown id and a missing storage do nothing", async () => {
    const { persistence, seeds } = await previewModules();
    const storage = memory();
    expect(seeds.applyPreviewHvSeed("?hv=b18-baingan", storage, "navigate")).toBe("b18-baingan");
    persistence.persistProgress({ ...buildB18HvSnapshot(scenario("b18-baingan")), pitzBalance: 111 }, storage);
    for (const type of ["reload", "back_forward"]) expect(seeds.applyPreviewHvSeed("?hv=b18-baingan", storage, type), type).toBeNull();
    expect(seeds.applyPreviewHvSeed("?hv=b18-unknown", storage, "navigate")).toBeNull();
    expect(seeds.applyPreviewHvSeed("?hv=b18-bbq", null, "navigate")).toBeNull();
    expect(persistence.loadSave(storage).pitzBalance).toBe(111);
  });

  it("legacy `?hv=` ids still resolve to their own Hint 5.0 seed with exactly the same stored save as before", async () => {
    const { persistence, seeds } = await previewModules();
    for (const s of seeds.HV_SCENARIOS) {
      const viaRouter = memory();
      const direct = memory();
      expect(seeds.applyPreviewHvSeed(`?hint5=1&hv=${s.id}`, viaRouter, "navigate"), s.id).toBe(s.id);
      expect(seeds.applyHvSeed(s.id, direct), s.id).toBe(true);
      const a = persistence.loadSave(viaRouter);
      const b = persistence.loadSave(direct);
      expect(a, s.id).toEqual(b);
      expect(a.ownedIngredientIds, s.id).not.toContain(B18_MATERIAL_ID);
    }
  });

  it("the seeded save loads with the ordinary entitlement: cilantro becomes a Shop entry (NEW) and is not owned", async () => {
    const { persistence, seeds } = await previewModules();
    const storage = memory();
    seeds.applyPreviewHvSeed("?hv=b18-reina", storage, "navigate");
    const stored = persistence.loadSave(storage);
    expect(stored.ownedIngredientIds).not.toContain(B18_MATERIAL_ID);
    const shop = resolveShopEntitlement(stored.dex, stored.ownedIngredientIds, stored.unlockedForShopIngredientIds);
    expect(shop.unlockedForShopIngredientIds).toContain(B18_MATERIAL_ID);
    expect(shop.newlyUnlockedMaterialIds).toContain(B18_MATERIAL_ID);
  });
});

describe("B18 HV seed boundaries (static)", () => {
  it("imports no Firebase / network module and no reducer: it only builds and writes a save through persistence", async () => {
    const source = (await import("./b18HvSeeds.ts?raw")).default as string;
    const imports = [...source.matchAll(/^import[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../data/discoveryLadder", "../data/ingredients", "../data/recipes", "../state/dex", "../state/persistence", "./hint5PreviewOptIn"].sort());
    expect(/firebase|firestore|fetch\(|XMLHttpRequest/i.test(source.replace(/\/\*[\s\S]*?\*\//g, ""))).toBe(false);
  });
});
