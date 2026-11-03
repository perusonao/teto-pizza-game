import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { canSteamIngredient, STEAM_TARGET_INGREDIENT_IDS } from "./steamIngredients";
import { canSearIngredient, SEAR_TARGET_INGREDIENT_IDS } from "./searIngredients";
import { canPrepIngredient, PREP_TARGET_INGREDIENT_IDS } from "./prepIngredients";

describe("canSteamIngredient", () => {
  it("Phase 1 targets clam and mussel only", () => {
    expect(STEAM_TARGET_INGREDIENT_IDS).toEqual(["clam", "mussel"]);
    expect(canSteamIngredient("clam")).toBe(true);
    expect(canSteamIngredient("mussel")).toBe(true);
  });
  it("everything else is refused (other seafood, the prep / sear targets, eggplant, unknown ids, junk)", () => {
    for (const id of ["shrimp", "salmon", "beef", "sausage", "eggplant", "potato", "fresh-tomato", "nope", "", "CLAM", " clam", "clam "]) expect(canSteamIngredient(id)).toBe(false);
    for (const junk of [undefined, null, 42, {}, []]) expect(canSteamIngredient(junk as never)).toBe(false);
  });
  it("the dormancy guard: both targets still have their dedicated drawing", () => {
    expect(getIngredient("clam")?.pieceVisual).toBe("clam-valve");
    expect(getIngredient("mussel")?.pieceVisual).toBe("mussel-shell");
  });
  it("never overlaps the 炒める prep or the 炙り sear (an ingredient gets at most one of the three)", () => {
    for (const id of STEAM_TARGET_INGREDIENT_IDS) {
      expect(PREP_TARGET_INGREDIENT_IDS).not.toContain(id);
      expect(SEAR_TARGET_INGREDIENT_IDS).not.toContain(id);
      expect(canPrepIngredient(id)).toBe(false);
      expect(canSearIngredient(id)).toBe(false);
    }
    for (const id of [...PREP_TARGET_INGREDIENT_IDS, ...SEAR_TARGET_INGREDIENT_IDS]) expect(canSteamIngredient(id)).toBe(false);
  });
});
