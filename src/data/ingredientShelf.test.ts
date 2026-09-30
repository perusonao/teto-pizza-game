import { describe, expect, it } from "vitest";
import catalog62 from "../../data/recipes/ingredient_master_catalog.json";
import shelfSource from "./ingredientShelf.ts?raw";
import { HINT_CLASS_DISPLAY } from "./hintClassDisplay";
import {
  auditShelfAuthority,
  filterByShelf,
  INGREDIENT_SHELF_ORDER,
  INGREDIENT_SHELVES,
  ingredientShelf,
  ingredientShelfLabel,
  isIngredientShelfId,
  shelvesPresent,
} from "./ingredientShelf";
import { CATEGORY_LABEL, INGREDIENTS } from "./ingredients";
import { ATTRIBUTE_FAMILIES, ingredientAttributeFamily, TAXONOMY_INGREDIENT_IDS } from "./ingredientTaxonomy";

/**
 * Ingredient Category Tabs 1.0 Phase 1 gates (OD-CT-1..7). The module is pure and unwired; these
 * tests pin the shelf authority so the Shop / Ingredients / Builder phases can rely on it.
 */
describe("gate 1: production catalog coverage 100%", () => {
  it("every production ingredient has a shelf and the audit is clean", () => {
    expect(INGREDIENTS.length).toBeGreaterThan(0);
    for (const i of INGREDIENTS) expect(ingredientShelf(i.id), i.id).not.toBeNull();
    expect(auditShelfAuthority()).toEqual({
      ok: true,
      unclassified: [],
      duplicateRows: [],
      orphanRows: [],
      nonToppingRows: [],
      unknownCategory: [],
    });
  });

  it("every shelf id in use is a declared shelf", () => {
    for (const i of INGREDIENTS) expect(isIngredientShelfId(ingredientShelf(i.id))).toBe(true);
  });
});

describe("gate 2: duplicate taxonomy rows fail", () => {
  it("production table has none", () => {
    expect(new Set(TAXONOMY_INGREDIENT_IDS).size).toBe(TAXONOMY_INGREDIENT_IDS.length);
  });
  it("the audit detects a duplicate row (a Map would silently keep the last)", () => {
    const r = auditShelfAuthority({
      ingredients: [{ id: "a", category: "topping" }],
      familyRowIds: ["a", "a"],
      familyOf: () => "meat",
    });
    expect(r.ok).toBe(false);
    expect(r.duplicateRows).toEqual(["a"]);
  });
});

describe("gate 3: unknown ingredient is fail-closed", () => {
  it.each([
    "no-such-ingredient",
    "",
    "__proto__",
    "constructor",
    "toString",
    " meat ",
    null,
    undefined,
    42,
    {},
    { id: 7 },
    [],
    { id: "no-such-ingredient", category: "sauce" },
  ])("%j has no shelf", (value) => {
    expect(ingredientShelf(value)).toBeNull();
  });

  it("the caller's own category is never trusted", () => {
    expect(ingredientShelf({ id: "sausage", category: "sauce" })).toBe("meat");
    expect(ingredientShelf({ id: "ghost", category: "cheese" })).toBeNull();
  });

  it("an unclassified topping / orphan / non-topping row / unknown category fails the audit", () => {
    const r = auditShelfAuthority({
      ingredients: [
        { id: "new-topping", category: "topping" },
        { id: "bad-family", category: "topping" },
        { id: "cheesy", category: "cheese" },
        { id: "weird", category: "dessert" },
      ],
      familyRowIds: ["cheesy", "ghost"],
      familyOf: (id) => (id === "bad-family" ? "invented" : null),
    });
    expect(r.ok).toBe(false);
    expect(r.unclassified).toEqual(["new-topping", "bad-family"]);
    expect(r.nonToppingRows).toEqual(["cheesy"]);
    expect(r.orphanRows).toEqual(["ghost"]);
    expect(r.unknownCategory).toEqual(["weird"]);
  });
});

describe("gate 4: topping family parity (Hint 5.0 / DH4-1)", () => {
  it("every topping's shelf is exactly its DH4-1 family", () => {
    for (const i of INGREDIENTS.filter((x) => x.category === "topping")) {
      expect(ingredientShelf(i.id), i.id).toBe(ingredientAttributeFamily(i.id));
    }
  });

  it("family shelf ids equal the Hint 5.0 class ids and the DH4-1 family ids, in the same order", () => {
    const familyShelves = INGREDIENT_SHELVES.filter((s) => s.kind === "family").map((s) => s.id);
    expect(familyShelves).toEqual(ATTRIBUTE_FAMILIES.map((f) => f.id));
    expect([...familyShelves].sort()).toEqual(Object.keys(HINT_CLASS_DISPLAY).sort());
  });

  it("labels stay context-separate: shelf 「その他」 vs Hint 「ちょっと変わった材料」", () => {
    expect(ingredientShelfLabel("other")).toBe("その他");
    expect(HINT_CLASS_DISPLAY.other.labelJa).toBe("ちょっと変わった材料");
  });

  it("drift alarm: a Hint label for every other family still reads as its shelf label + 系", () => {
    for (const s of INGREDIENT_SHELVES.filter((x) => x.kind === "family" && x.id !== "other")) {
      const hint = HINT_CLASS_DISPLAY[s.id as keyof typeof HINT_CLASS_DISPLAY].labelJa;
      expect(hint, s.id).toBe(`${s.labelJa}系`);
    }
  });

  it("ingredientShelf.ts never imports the Hint display module (labels are not moved or copied)", () => {
    const src = shelfSource;
    expect(src).not.toMatch(/from\s+["'][^"']*hintClassDisplay["']/);
    expect(src).not.toContain("ちょっと変わった材料\"");
  });
});

describe("gates 5-7: sauce / cheese / olive-oil", () => {
  it("every sauce is on the sauce shelf and every cheese on the cheese shelf", () => {
    for (const i of INGREDIENTS.filter((x) => x.category === "sauce")) expect(ingredientShelf(i.id)).toBe("sauce");
    for (const i of INGREDIENTS.filter((x) => x.category === "cheese")) expect(ingredientShelf(i.id)).toBe("cheese");
  });
  it("olive-oil is on the sauce shelf, never a topping family", () => {
    expect(ingredientShelf("olive-oil")).toBe("sauce");
    expect(ingredientAttributeFamily("olive-oil")).toBeNull();
  });
  it("sauce / cheese have no family row (their category is their shelf)", () => {
    for (const i of INGREDIENTS.filter((x) => x.category !== "topping"))
      expect(TAXONOMY_INGREDIENT_IDS).not.toContain(i.id);
  });
});

describe("gate 8: one ingredient = one shelf", () => {
  it("the shelves partition the catalog: every id is in exactly one shelf filter", () => {
    for (const i of INGREDIENTS) {
      const hits = INGREDIENT_SHELF_ORDER.filter((s) => filterByShelf([i], s).length === 1);
      expect(hits, i.id).toHaveLength(1);
    }
    const total = INGREDIENT_SHELF_ORDER.reduce((n, s) => n + filterByShelf(INGREDIENTS, s).length, 0);
    expect(total).toBe(INGREDIENTS.length);
  });
});

describe("gate 9: deterministic order", () => {
  it("shelf order and labels are pinned", () => {
    expect(INGREDIENT_SHELF_ORDER).toEqual([
      "sauce",
      "cheese",
      "meat",
      "seafood",
      "vegetable",
      "fruit",
      "herb",
      "spice",
      "other",
    ]);
    expect(INGREDIENT_SHELVES.map((s) => s.labelJa)).toEqual([
      "ソース",
      "チーズ",
      "肉",
      "魚介",
      "野菜・きのこ",
      "果物",
      "ハーブ・香味",
      "スパイス・薬味",
      "その他",
    ]);
    expect(ingredientShelfLabel("all")).toBe("すべて");
    expect(ingredientShelfLabel("sauce")).toBe(CATEGORY_LABEL.sauce);
  });
  it("authority tables are frozen, including every shelf record (deep freeze)", () => {
    expect(Object.isFrozen(INGREDIENT_SHELVES)).toBe(true);
    expect(Object.isFrozen(INGREDIENT_SHELF_ORDER)).toBe(true);
    for (const shelf of INGREDIENT_SHELVES) expect(Object.isFrozen(shelf), shelf.id).toBe(true);
  });
  it("mutation attempts on a shelf record cannot change the authority (id / label / kind)", () => {
    const snapshot = JSON.stringify(INGREDIENT_SHELVES);
    const order = [...INGREDIENT_SHELF_ORDER];
    const first = INGREDIENT_SHELVES[0] as { id: string; labelJa: string; kind: string };
    // ES modules are strict: writing to a frozen record throws instead of silently succeeding.
    expect(() => {
      first.id = "meat";
    }).toThrow(TypeError);
    expect(() => {
      first.labelJa = "変更";
    }).toThrow(TypeError);
    expect(() => {
      first.kind = "family";
    }).toThrow(TypeError);
    expect(() => {
      (INGREDIENT_SHELVES as unknown as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (INGREDIENT_SHELF_ORDER as unknown as string[])[0] = "meat";
    }).toThrow(TypeError);
    // Nothing moved: records, order, and every lookup still agree.
    expect(JSON.stringify(INGREDIENT_SHELVES)).toBe(snapshot);
    expect([...INGREDIENT_SHELF_ORDER]).toEqual(order);
    expect(INGREDIENT_SHELVES.map((s) => s.id)).toEqual(order);
    expect(ingredientShelfLabel("sauce")).toBe("ソース");
    expect(ingredientShelfLabel("meat")).toBe("肉");
    expect(ingredientShelf("olive-oil")).toBe("sauce");
    for (const s of INGREDIENT_SHELVES) {
      expect(isIngredientShelfId(s.id)).toBe(true);
      expect(ingredientShelfLabel(s.id)).toBe(s.labelJa);
    }
    for (const i of INGREDIENTS) expect(order).toContain(ingredientShelf(i.id));
  });
  it("filtering keeps input order and is independent of call history", () => {
    const shuffled = [...INGREDIENTS].reverse();
    const a = filterByShelf(shuffled, "vegetable").map((i) => i.id);
    expect(a).toEqual(shuffled.filter((i) => ingredientShelf(i.id) === "vegetable").map((i) => i.id));
    expect(filterByShelf(shuffled, "vegetable").map((i) => i.id)).toEqual(a);
  });
  it("shelvesPresent follows the shelf order regardless of input order", () => {
    const ids = ["egg", "ham", "pesto", "mozzarella"].map((id) => ({ id }));
    expect(shelvesPresent(ids)).toEqual(["sauce", "cheese", "meat", "other"]);
    expect(shelvesPresent([...ids].reverse())).toEqual(["sauce", "cheese", "meat", "other"]);
    expect(shelvesPresent([{ id: "ghost" }])).toEqual([]);
  });
});

describe("gate 10: filtering is a pure display filter", () => {
  it("does not mutate the input array, its items or a selection held by the caller", () => {
    const items = INGREDIENTS.map((i) => Object.freeze({ ...i }));
    const frozen = Object.freeze([...items]);
    const before = JSON.stringify(frozen);
    const selection = { selectedIngredientId: "ham", placed: ["ham", "egg"] };
    const selectionBefore = JSON.stringify(selection);
    for (const f of ["all", ...INGREDIENT_SHELF_ORDER, "bogus"]) filterByShelf(frozen, f);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(JSON.stringify(selection)).toBe(selectionBefore);
  });
  it("always returns a new array; 'all' keeps unclassified items, a shelf does not", () => {
    const list = [{ id: "ham" }, { id: "ghost" }];
    expect(filterByShelf(list, "all")).toEqual(list);
    expect(filterByShelf(list, "all")).not.toBe(list);
    expect(filterByShelf(list, "meat")).toEqual([{ id: "ham" }]);
    expect(filterByShelf(list, "seafood")).toEqual([]);
  });
  it("an unknown or hostile filter yields nothing (fail-closed)", () => {
    for (const f of ["", "topping", "__proto__", "constructor", null, undefined, 3, {}])
      expect(filterByShelf(INGREDIENTS, f)).toEqual([]);
  });
});

describe("62-catalog expansion detection (no guessing)", () => {
  const rows = catalog62.ingredients as { id: string; category: string }[];
  it("auditing the 62 catalog against the production taxonomy reports exactly the toppings without a row", () => {
    const expected = rows
      .filter((r) => r.category === "topping" && !TAXONOMY_INGREDIENT_IDS.includes(r.id))
      .map((r) => r.id);
    const r = auditShelfAuthority({
      ingredients: rows,
      familyRowIds: TAXONOMY_INGREDIENT_IDS.filter((id) => rows.some((x) => x.id === id)),
      familyOf: ingredientAttributeFamily,
    });
    expect(r.unclassified).toEqual(expected);
    // Fresh Audit: the 62 catalog is not shippable until HCG; the gate must see that, not hide it.
    expect(r.ok).toBe(expected.length === 0);
  });
  it("shelf lookup never classifies a catalog id that is not in production", () => {
    for (const r of rows) {
      if (!INGREDIENTS.some((i) => i.id === r.id)) expect(ingredientShelf(r.id), r.id).toBeNull();
    }
  });
});

describe("purity boundary", () => {
  it("imports only ./ingredients and ./ingredientTaxonomy (no state, save, progression, scoring, React, hint display)", () => {
    const src = shelfSource;
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./ingredientTaxonomy", "./ingredients"]);
  });
});
