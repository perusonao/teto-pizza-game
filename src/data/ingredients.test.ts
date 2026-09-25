import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "./ingredients";

/**
 * Economy Tuning 1 (docs/reports/TETO_ECONOMY-TUNING-1_Implementation-Result.md), section 1's
 * own TARGET price table -- pinned here as one fixed-value map so any future accidental price
 * drift on these 11 ingredients fails a test immediately, rather than only showing up in a
 * Human Feel playtest. `restockQuantity` is asserted unchanged from its pre-Tuning-1 value in
 * the same table -- this task never touches restock batch sizes.
 */
const TARGET_PRICE_PITZ: Record<string, number> = {
  mushroom: 150,
  garlic: 90,
  oregano: 55,
  egg: 105,
  pesto: 90,
  "cherry-tomato": 55,
  "olive-oil": 65,
  gorgonzola: 90,
  parmigiano: 90,
  fontina: 90,
  onion: 170,
  // Recipe Expansion Batch 1A (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md):
  // 4 new starterGrantOnly toppings -- see that report's pricing-rationale section.
  sausage: 140,
  pepperoni: 130,
  anchovy: 110,
  tuna: 120,
  // Recipe Expansion Batch 1B-A (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-A_Result.md): 2
  // new starterGrantOnly toppings -- see that report's pricing-rationale section.
  rosemary: 55,
  bacon: 140,
  // Recipe Expansion Batch 1B-B (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-B_Result.md): 2
  // new starterGrantOnly toppings -- see that report's pricing-rationale section.
  ham: 140,
  "black-olive": 90,
};

const UNCHANGED_RESTOCK_QUANTITY: Record<string, number> = {
  mushroom: 9,
  garlic: 9,
  oregano: 6,
  egg: 3,
  pesto: 3,
  "cherry-tomato": 9,
  "olive-oil": 3,
  gorgonzola: 6,
  parmigiano: 6,
  fontina: 6,
  onion: 12,
  sausage: 9,
  pepperoni: 12,
  anchovy: 9,
  tuna: 9,
  rosemary: 9,
  bacon: 9,
  ham: 3,
  "black-olive": 6,
};

describe("Economy Tuning 1: TARGET Shop prices", () => {
  for (const [id, targetPrice] of Object.entries(TARGET_PRICE_PITZ)) {
    it(`${id}.pricePitz is fixed at the TARGET price (${targetPrice})`, () => {
      expect(getIngredient(id)?.pricePitz).toBe(targetPrice);
    });
  }

  it("covers every starterGrantOnly ingredient in production data -- no row silently unpinned", () => {
    const starterGrantOnlyIds = INGREDIENTS.filter((i) => i.starterGrantOnly).map((i) => i.id);
    expect(starterGrantOnlyIds.slice().sort()).toEqual(Object.keys(TARGET_PRICE_PITZ).slice().sort());
  });

  for (const [id, quantity] of Object.entries(UNCHANGED_RESTOCK_QUANTITY)) {
    it(`${id}.restockQuantity is unchanged by this task (${quantity})`, () => {
      expect(getIngredient(id)?.restockQuantity).toBe(quantity);
    });
  }

  it("every TARGET price is still a valid (positive integer) Shop price", () => {
    for (const id of Object.keys(TARGET_PRICE_PITZ)) {
      const ingredient = getIngredient(id)!;
      expect(Number.isInteger(ingredient.pricePitz)).toBe(true);
      expect(ingredient.pricePitz).toBeGreaterThan(0);
    }
  });
});

describe("onion (Phase 3C-6)", () => {
  const onion = getIngredient("onion");

  it("exists in production data", () => {
    expect(onion).toBeDefined();
  });

  it("is not a Starter ingredient", () => {
    expect(STARTER_INGREDIENT_IDS).not.toContain("onion");
    expect(onion?.unlockCondition).toBeDefined();
  });

  it("has a positive minTotalStars unlock condition", () => {
    expect(onion?.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    expect(Number.isInteger(onion?.unlockCondition?.minTotalStars)).toBe(true);
  });

  it("has a valid (positive integer) pricePitz", () => {
    expect(onion?.pricePitz).toBeGreaterThan(0);
    expect(Number.isInteger(onion?.pricePitz)).toBe(true);
  });

  it("is a topping-category, scatter-placed ingredient (no new placement mechanics)", () => {
    expect(onion?.category).toBe("topping");
    expect(onion?.placement).toBe("scatter");
  });

  // Economy & Progression 1.0 EP4 (finalized product decision, EP4 Result report §7): onion's
  // old Phase 3C-6 manual-purchase path is retired -- exactly like every other EP4 Starter
  // Grant ingredient, its first unit is only ever obtained via its governing recipe's Starter
  // Grant, never a manual Shop purchase.
  it("is starterGrantOnly (its old manual-purchase path is retired)", () => {
    expect(onion?.starterGrantOnly).toBe(true);
  });
});

describe("ham / black-olive (Recipe Expansion Batch 1B-B)", () => {
  it.each(["ham", "black-olive"])("%s exists in production data", (id) => {
    expect(getIngredient(id)).toBeDefined();
  });

  it.each(["ham", "black-olive"])("%s is a topping-category, scatter-placed ingredient (no new placement mechanics)", (id) => {
    const ingredient = getIngredient(id)!;
    expect(ingredient.category).toBe("topping");
    expect(ingredient.placement).toBe("scatter");
  });

  it.each(["ham", "black-olive"])("%s is starterGrantOnly (first unit is only ever free via capricciosa's Starter Grant)", (id) => {
    expect(getIngredient(id)?.starterGrantOnly).toBe(true);
  });

  it.each(["ham", "black-olive"])("%s is not a Starter ingredient", (id) => {
    expect(STARTER_INGREDIENT_IDS).not.toContain(id);
    expect(getIngredient(id)?.unlockCondition).toBeDefined();
  });
});

describe("Starter Set (EP4: shrunk to Margherita's own 3 permanently-unlimited ingredients)", () => {
  it("has exactly 3 Starter ingredients (tomato-sauce/mozzarella/basil)", () => {
    expect(STARTER_INGREDIENT_IDS.slice().sort()).toEqual(
      ["tomato-sauce", "mozzarella", "basil"].sort(),
    );
  });

  it("total production ingredient count is now 29 (3 Starter + 10 EP4 Starter-Grant + onion + Batch 1A's 4 + Batch 1B-A's 2 + Batch 1B-B's 2 + W1's 7)", () => {
    expect(INGREDIENTS).toHaveLength(29);
  });
});

/**
 * Progression 2.0 W1 Integration I5a: the 7 W1 materials, registered in the catalog only (no
 * recipe, no Discovery Ladder step yet). Visuals are the W1 Human Visual Gate authority.
 */
const W1_MATERIALS: readonly {
  id: string;
  nameJa: string;
  emoji: string;
  pieceVisual?: string;
}[] = [
  { id: "capers", nameJa: "ケッパー", emoji: "\u{1F7E2}", pieceVisual: "caper-cluster" },
  { id: "clam", nameJa: "あさり", emoji: "\u{1F9AA}", pieceVisual: "clam-valve" },
  { id: "corn", nameJa: "コーン", emoji: "\u{1F33D}" },
  { id: "eggplant", nameJa: "ナス", emoji: "\u{1F346}" },
  { id: "fresh-tomato", nameJa: "トマト", emoji: "\u{1F345}", pieceVisual: "tomato-slice" },
  { id: "pineapple", nameJa: "パイナップル", emoji: "\u{1F34D}" },
  { id: "potato", nameJa: "じゃがいも", emoji: "\u{1F954}" },
];

describe("W1 materials (Progression 2.0 I5a)", () => {
  it("are the last 7 catalog rows, in this order (existing tray order untouched)", () => {
    expect(INGREDIENTS.slice(-7).map((i) => i.id)).toEqual(W1_MATERIALS.map((m) => m.id));
  });

  it.each(W1_MATERIALS)("$id: $nameJa, finite scatter topping with the approved visual", (m) => {
    const ingredient = getIngredient(m.id)!;
    expect(ingredient).toBeDefined();
    expect(ingredient.nameJa).toBe(m.nameJa);
    expect(ingredient.category).toBe("topping");
    expect(ingredient.placement).toBe("scatter");
    expect(ingredient.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ingredient.emoji).toBe(m.emoji);
    expect(ingredient.pieceVisual).toBe(m.pieceVisual);
    expect(STARTER_INGREDIENT_IDS).not.toContain(m.id);
  });

  it.each(W1_MATERIALS)("$id carries none of the legacy EP3/EP4 Shop fields", (m) => {
    const ingredient = getIngredient(m.id)!;
    expect(ingredient.pricePitz).toBeUndefined();
    expect(ingredient.restockQuantity).toBeUndefined();
    expect(ingredient.starterGrantOnly).toBeUndefined();
  });

  it("ids and display names stay unique across the whole catalog", () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
    expect(new Set(INGREDIENTS.map((i) => i.nameJa)).size).toBe(INGREDIENTS.length);
  });
});
