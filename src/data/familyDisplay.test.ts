import { describe, expect, it } from "vitest";
import source from "./familyDisplay.ts?raw";
import hintSource from "./hintClassDisplay.ts?raw";
import { FAMILY_DISPLAY, ingredientFamilyDisplay } from "./familyDisplay";
import { HINT_CLASS_DISPLAY } from "./hintClassDisplay";
import { INGREDIENTS } from "./ingredients";
import { ATTRIBUTE_FAMILIES, ingredientAttributeFamily } from "./ingredientTaxonomy";

describe("familyDisplay: the single player-facing family display authority", () => {
  it("covers exactly the 7 DH4-1 families, with the Owner-approved labels (OD-2) and symbols (OD-3)", () => {
    expect(Object.keys(FAMILY_DISPLAY).sort()).toEqual(ATTRIBUTE_FAMILIES.map((f) => f.id).sort());
    expect(Object.entries(FAMILY_DISPLAY).map(([id, d]) => [id, d.symbol, d.labelJa])).toEqual([
      ["meat", "🥩", "肉系"],
      ["seafood", "🌊", "魚介系"],
      ["vegetable", "🥬", "野菜・きのこ系"],
      ["herb", "🪴", "ハーブ・香味系"],
      ["spice", "🧂", "スパイス・薬味系"],
      ["fruit", "🍇", "果物系"],
      ["other", "✨", "ちょっと変わった材料"],
    ]);
  });

  it("OD-A: Hint 5.0 re-publishes the very same record (no copy), and no label is duplicated in the Hint file", () => {
    expect(HINT_CLASS_DISPLAY).toBe(FAMILY_DISPLAY);
    expect(hintSource).not.toMatch(/肉系|魚介系|野菜・きのこ系|ハーブ・香味系|スパイス・薬味系|果物系|ちょっと変わった材料/);
  });

  it("G18 still holds for the shared record: no symbol equals an ingredient glyph, no label contains an ingredient name", () => {
    for (const d of Object.values(FAMILY_DISPLAY)) {
      for (const i of INGREDIENTS) {
        expect(d.symbol, i.id).not.toBe(i.emoji);
        expect(d.labelJa, i.id).not.toContain(i.nameJa);
      }
    }
  });

  it("ingredientFamilyDisplay: a topping with a family gets its tag; sauce / cheese / unknown / hostile ids get none", () => {
    expect(ingredientFamilyDisplay("bacon")).toEqual({ id: "meat", symbol: "🥩", labelJa: "肉系" });
    expect(ingredientFamilyDisplay("shrimp")).toEqual({ id: "seafood", symbol: "🌊", labelJa: "魚介系" });
    for (const i of INGREDIENTS.filter((x) => x.category !== "topping")) expect(ingredientFamilyDisplay(i.id), i.id).toBeNull();
    for (const bad of ["ghost", "", null, undefined, 3, {}, "__proto__"]) expect(ingredientFamilyDisplay(bad)).toBeNull();
    for (const i of INGREDIENTS.filter((x) => x.category === "topping")) {
      expect(ingredientFamilyDisplay(i.id)?.id, i.id).toBe(ingredientAttributeFamily(i.id));
    }
  });

  it("is a leaf: it imports only the taxonomy (no Hint 5.0, shelf, catalog or component)", () => {
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports).toEqual(["./ingredientTaxonomy"]);
  });
});
