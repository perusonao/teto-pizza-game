import { describe, expect, it } from "vitest";
import {
  CHAPTER_SIZES,
  FIXTURE_INGREDIENT_SPLITS,
  LARGE_CATALOG_FIXTURE_IDS,
  largeCatalogFixture,
  syntheticCatalog,
  syntheticRecipes,
} from "./testSupport/largeCatalogFixtures";

const MODEL_RAW = import.meta.glob<string>("../../../docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const MODEL = JSON.parse(Object.values(MODEL_RAW)[0]);

describe("LC-1b scale fixtures", () => {
  it("match the committed scale model (tools/large_catalog_ux_scale_model.py)", () => {
    const matrix = MODEL.gate.fixtureTrayMatrix as Record<string, Record<string, { owned: number }>>;
    for (const [key, split] of Object.entries(FIXTURE_INGREDIENT_SPLITS)) {
      expect({ sauce: matrix[key].sauce.owned, cheese: matrix[key].cheese.owned, topping: matrix[key].topping.owned }).toEqual(split);
    }
    const rows = MODEL.gate.dexAggregation["390x844"].rows as Record<string, { chapters: number[] }>;
    expect(rows.catalog25_discovered0.chapters).toEqual(CHAPTER_SIZES[25]);
    expect(rows.catalog172_discovered0.chapters).toEqual(CHAPTER_SIZES[172]);
  });

  it("reproduce every Owner-requested population", () => {
    const sizes = Object.fromEntries(
      LARGE_CATALOG_FIXTURE_IDS.map((id) => {
        const f = largeCatalogFixture(id);
        return [id, [f.catalog.length, f.recipes.length]];
      }),
    );
    expect(sizes).toEqual({
      "runtime-29x25": [29, 25],
      "w2a-37x34": [37, 34],
      "w2a-mixed-37x34": [37, 34],
      "mid-40x34": [40, 34],
      "catalog-62x101": [62, 101],
      "progression-105x101": [105, 101],
      "full-105x172": [105, 172],
      "stress-179x172": [179, 172],
    });
  });

  it("runtime fixture is the real catalog: 3 / 4 / 22 and chapters 6 / 9 / 10", () => {
    const f = largeCatalogFixture("runtime-29x25");
    expect(f.split).toEqual({ sauce: 3, cheese: 4, topping: 22 });
    expect(f.chapterSizes).toEqual([6, 9, 10]);
    expect(f.starterIds).toEqual(["tomato-sauce", "mozzarella", "basil"]);
  });

  it("uses the PR #255 PROPOSED family shelves at 105 / 179 for synthetic toppings", () => {
    const count = (id: "full-105x172" | "stress-179x172") => {
      const out: Record<string, number> = {};
      for (const i of largeCatalogFixture(id).catalog) if (i.category === "topping" && i.shelf) out[i.shelf] = (out[i.shelf] ?? 0) + 1;
      return out;
    };
    expect(count("full-105x172")).toEqual({ vegetable: 24, meat: 13, seafood: 11, herb: 8, other: 7, spice: 5, fruit: 3 });
    expect(count("stress-179x172")).toEqual({ vegetable: 40, meat: 20, other: 17, seafood: 15, spice: 12, fruit: 11, herb: 8 });
    // Sauce / cheese synthetic ids sit on their category shelf; no synthetic id is unclassified.
    for (const i of largeCatalogFixture("full-105x172").catalog) {
      expect(i.shelf).not.toBeNull();
      if (i.category !== "topping") expect(i.shelf).toBe(i.category);
    }
  });

  it("is deterministic and never uses a real recipe or ingredient name", () => {
    const a = syntheticRecipes(syntheticCatalog(FIXTURE_INGREDIENT_SPLITS["105"], 1), CHAPTER_SIZES[172], 2);
    const b = syntheticRecipes(syntheticCatalog(FIXTURE_INGREDIENT_SPLITS["105"], 1), CHAPTER_SIZES[172], 2);
    expect(a).toEqual(b);
    for (const r of a) {
      expect(r.id.startsWith("fx-recipe-")).toBe(true);
      expect(r.requiredIngredientIds.every((id) => id.startsWith("fx-"))).toBe(true);
      expect(new Set(r.requiredIngredientIds).size).toBe(r.requiredIngredientIds.length);
    }
  });

  it("reproduces the 172-matrix topping-count distribution", () => {
    const f = largeCatalogFixture("full-105x172");
    const toppingIds = new Set(f.catalog.filter((i) => i.category === "topping").map((i) => i.id));
    const dist: Record<number, number> = {};
    for (const r of f.recipes) {
      const t = r.requiredIngredientIds.filter((id) => toppingIds.has(id)).length;
      dist[t] = (dist[t] ?? 0) + 1;
    }
    // 0-topping rows get one topping (every fixture recipe is placeable on the TOPPING step).
    expect(dist).toEqual({ 1: 35, 2: 50, 3: 62, 4: 19, 5: 5, 6: 1 });
  });
});
