import { describe, expect, it } from "vitest";
import { SAVE_STORAGE_KEY, loadSave, type StorageLike } from "./persistence";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";

/**
 * All-Owned Cooking Tray (食材庫廃止): the pantry / HAND pins were never part of the save (session-only, App state), so
 * removing the 食材庫 needs NO schema migration. A save that somehow carries pantry / tray-selection fields (an old
 * experiment, a hand-edited file) must still load, and the runtime must ignore them: the same save without them loads to
 * the identical game data, and the schema version is unchanged.
 */
function storageWith(save: Record<string, unknown>): StorageLike {
  const store = new Map([[SAVE_STORAGE_KEY, JSON.stringify(save)]]);
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
}

const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const base = {
  schemaVersion: 2,
  dex: [],
  pitzBalance: 0,
  ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...TOPPINGS.slice(0, 4)],
  missionBest: {},
  inventory: {},
  starterGrantClaimedRecipeIds: [],
};

describe("legacy pantry / tray-selection fields in a save", () => {
  it("the schema version is unchanged by the 食材庫 removal", () => {
    expect(loadSave(storageWith(base)).schemaVersion).toBe(2);
  });

  it("loads, and loads to exactly the same game data as the save without them", () => {
    const legacy = {
      ...base,
      handSession: { sauce: ["tomato-sauce"], cheese: [], topping: [TOPPINGS[0], "ghost"] },
      pantryPins: [TOPPINGS[1]],
      pantry: { open: true, shelf: "meat", search: "に" },
      traySelection: { topping: [TOPPINGS[2]] },
    };
    expect(loadSave(storageWith(legacy))).toEqual(loadSave(storageWith(base)));
  });

  it("ownership is untouched: nothing the legacy fields name can hide or add an ingredient", () => {
    const plain = loadSave(storageWith(base));
    const loaded = loadSave(storageWith({ ...base, handSession: { topping: ["not-an-ingredient"] }, pantryPins: [TOPPINGS[9]] }));
    expect(loaded.ownedIngredientIds).toEqual(plain.ownedIngredientIds);
    expect(loaded.schemaVersion).toBe(2);
  });
});
