import { describe, expect, it } from "vitest";
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS } from "../data/ingredients";
import { applyTrayFamily, familyFirstPageIds, resolveTrayFamily, trayFamilyChoices } from "./trayFamilyFilter";

const TOPPINGS = ingredientsByCategory("topping");

describe("trayFamilyFilter (Issue #396)", () => {
  it("offers nothing for a list that fits one page", () => {
    expect(trayFamilyChoices(TOPPINGS.slice(0, MAX_INGREDIENT_PALETTE_SLOTS))).toEqual([]);
  });
  it("offers the families present, in authority order, for a paged list", () => {
    const choices = trayFamilyChoices(TOPPINGS);
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices[0]).toBe("meat");
  });
  it("reads an absent family as all, and filters without mutating the input", () => {
    const choices = trayFamilyChoices(TOPPINGS);
    expect(resolveTrayFamily("meat", choices)).toBe("meat");
    expect(resolveTrayFamily("meat", [])).toBe("all");
    const copy = [...TOPPINGS];
    const meat = applyTrayFamily(TOPPINGS, "meat");
    expect(meat.length).toBeGreaterThan(0);
    expect(meat.length).toBeLessThan(TOPPINGS.length);
    expect(TOPPINGS).toEqual(copy);
  });

  it("familyFirstPageIds: the filtered first page, never later than the unfiltered position", () => {
    const ids = TOPPINGS.map((t) => t.id);
    expect(familyFirstPageIds(ids, "all")).toEqual(ids.slice(0, MAX_INGREDIENT_PALETTE_SLOTS));
    const meat = familyFirstPageIds(ids, "meat");
    expect(meat).toEqual(applyTrayFamily(TOPPINGS, "meat").slice(0, MAX_INGREDIENT_PALETTE_SLOTS).map((t) => t.id));
    // a family the list does not offer reads as すべて
    expect(familyFirstPageIds(ids.slice(0, MAX_INGREDIENT_PALETTE_SLOTS), "meat")).toEqual(ids.slice(0, MAX_INGREDIENT_PALETTE_SLOTS));
  });
});
