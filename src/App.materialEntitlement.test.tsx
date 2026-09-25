import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import App from "./App";
import { SAVE_STORAGE_KEY, createDefaultSave, type PersistentSaveV2 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { LUNCH_RUSH_MISSION_ID } from "./mission/lunchRush";

/**
 * Progression 2.0 W1 Integration I4b-3: App.tsx's load path resolves the Discovery Ladder
 * (`resolveShopEntitlement`) instead of EP4's Starter Grant catch-up, and persists the Shop
 * entitlement ledger. This is the existing-save migration (docs/reports/
 * TETO_PROGRESS2_W1_I4B_Fresh-Audit.md §3 K): owned materials and their stock are kept, ladder
 * materials the player lacks become NEW at stock 0, nothing is granted.
 */

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY) ?? "null");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("load-time migration of an existing EP4 save", () => {
  it("keeps owned materials, stock, Pitz and the claimed ledger; adds the ladder reach at stock 0", () => {
    const legacy = {
      schemaVersion: 2,
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 88, bestStars: 4, timesMade: 5 },
        { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
        { recipeId: "marinara", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
      ],
      pitzBalance: 321,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom", "garlic", "oregano"],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 900 },
      inventory: { mushroom: 17, garlic: 3, oregano: 0 },
      starterGrantClaimedRecipeIds: ["funghi", "marinara"],
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacy));
    render(<App />);

    const save = stored() as unknown as PersistentSaveV2;
    // Dex 3 -> ladder steps 1-3 (egg, bacon, mushroom); mushroom was already owned.
    expect(save.unlockedForShopIngredientIds).toEqual(["mushroom", "garlic", "oregano", "egg", "bacon"]);
    // EP4 retired: bismarck is EP1-unlocked by marinara, but no Starter Grant lands for it.
    expect(save.starterGrantClaimedRecipeIds).toEqual(["funghi", "marinara"]);
    expect(save.ownedIngredientIds).toEqual(legacy.ownedIngredientIds);
    expect(save.inventory).toEqual(legacy.inventory);
    expect(save.pitzBalance).toBe(321);
    expect(save.dex).toEqual(legacy.dex);
    expect(save.missionBest).toEqual(legacy.missionBest);
  });

  it("a brand-new player writes nothing on mount (empty Dex -> nothing unlocked)", () => {
    render(<App />);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  it("reloading an already-migrated save is a no-op", () => {
    const current = {
      ...createDefaultSave(),
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }],
      unlockedForShopIngredientIds: ["egg"],
    };
    const raw = JSON.stringify(current);
    window.localStorage.setItem(SAVE_STORAGE_KEY, raw);
    render(<App />);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it("unknown ingredient ids in the ledger survive the load + write", () => {
    const current = {
      ...createDefaultSave(),
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 },
        { recipeId: "bismarck", discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 },
      ],
      unlockedForShopIngredientIds: ["egg", "future-ingredient"],
      inventory: { "future-ingredient": 9 },
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(current));
    render(<App />);
    const save = stored();
    // Dex 2 -> bacon newly entitled; the unknown id and its stock are kept.
    expect(save.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "future-ingredient"]);
    expect(save.inventory).toEqual({ "future-ingredient": 9 });
  });
});
