import { describe, expect, it } from "vitest";
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS } from "../data/ingredients";
import { applyTrayFamily, resolveTrayFamily, trayFamilyChoices } from "./trayFamilyFilter";

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
});
