import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { canFryIngredient, fryTargetStatus, FRY_TARGET_INGREDIENT_IDS } from "./fryIngredients";
import { canSteamIngredient, STEAM_TARGET_INGREDIENT_IDS } from "./steamIngredients";
import { canSearIngredient, SEAR_TARGET_INGREDIENT_IDS } from "./searIngredients";
import { canPrepIngredient, PREP_TARGET_INGREDIENT_IDS } from "./prepIngredients";

describe("canFryIngredient", () => {
  it("Phase 1 targets eggplant only (Owner 2026-11-04)", () => {
    expect(FRY_TARGET_INGREDIENT_IDS).toEqual(["eggplant"]);
  });
  it("is DORMANT today: eggplant has no dedicated drawing yet, so the rule refuses it", () => {
    expect(getIngredient("eggplant")?.pieceVisual).toBeUndefined();
    expect(canFryIngredient("eggplant")).toBe(false);
  });
  it("turns on for eggplant the moment a dedicated drawing exists (the catalog lookup is injectable)", () => {
    expect(canFryIngredient("eggplant", () => "eggplant-slice")).toBe(true);
    expect(canFryIngredient("eggplant", () => undefined)).toBe(false);
  });
  it("everything else is refused even with a drawing (shrimp / hot-dog are out of scope; the other treatments' targets; unknown ids; junk)", () => {
    const withArt = () => "any-drawing";
    for (const id of ["shrimp", "hot-dog", "potato", "clam", "mussel", "beef", "sausage", "fresh-tomato", "nope", "", "EGGPLANT", " eggplant", "eggplant "]) expect(canFryIngredient(id, withArt)).toBe(false);
    for (const junk of [undefined, null, 42, {}, []]) expect(canFryIngredient(junk as never, withArt)).toBe(false);
  });
  it("never overlaps the 炒める prep, the 炙り sear or the 蒸す steam (an ingredient gets at most one of the four)", () => {
    for (const id of FRY_TARGET_INGREDIENT_IDS) {
      expect(PREP_TARGET_INGREDIENT_IDS).not.toContain(id);
      expect(SEAR_TARGET_INGREDIENT_IDS).not.toContain(id);
      expect(STEAM_TARGET_INGREDIENT_IDS).not.toContain(id);
      expect(canPrepIngredient(id) || canSearIngredient(id) || canSteamIngredient(id)).toBe(false);
    }
    for (const id of [...PREP_TARGET_INGREDIENT_IDS, ...SEAR_TARGET_INGREDIENT_IDS, ...STEAM_TARGET_INGREDIENT_IDS]) expect(canFryIngredient(id, () => "x")).toBe(false);
  });
});

describe("fry registration integrity", () => {
  it("every target is a real, unique, exact-case topping of the catalog (a typo or a retired id fails here, not silently as 'dormant')", () => {
    expect(new Set(FRY_TARGET_INGREDIENT_IDS).size).toBe(FRY_TARGET_INGREDIENT_IDS.length);
    for (const id of FRY_TARGET_INGREDIENT_IDS) {
      expect(getIngredient(id), id).toBeDefined();
      expect(getIngredient(id)?.category, id).toBe("topping");
    }
  });
  it("names the reason: not-target / dormant / active (same rule as canFryIngredient, never an unknown state)", () => {
    expect(fryTargetStatus("eggplant")).toBe("dormant");
    expect(fryTargetStatus("eggplant", () => "eggplant-slice")).toBe("active");
    expect(fryTargetStatus("shrimp", () => "x")).toBe("not-target");
    for (const id of ["eggplant", "shrimp", "nope", ""]) for (const visual of [undefined, "x"]) {
      expect(canFryIngredient(id, () => visual)).toBe(fryTargetStatus(id, () => visual) === "active");
    }
  });
});
