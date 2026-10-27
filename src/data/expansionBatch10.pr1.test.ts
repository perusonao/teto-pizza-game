import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { RECIPES, type Recipe, type RecipeId } from "./recipes";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { TOPPING_SIZE_CLASS_BY_ID } from "./toppingSizeClass";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";

/**
 * Expansion Batch 10 PR-1 (docs/decisions/TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md): currywurst, curry-pizza-japan, rendang-pizza, tandoori-paneer-pizza, cuban-pizza.
 * The Owner-approved facts (the new sauces / families, lunchRush false, no CUT) are pinned strictly; the counts, bake window, colours and glyphs are PROVISIONAL (the original
 * PIZZA DB pages were not confirmed), so those tests pin the structure that must hold whichever values the Owner finally chooses.
 */
interface Row {
  id: RecipeId;
  sauce: "curry-ketchup" | "mustard";
  step: readonly string[];
  ingredients: readonly string[]; // the 172 matrix set, sauce first
}
const ROWS: readonly Row[] = [
  { id: "curry-pizza-japan", sauce: "curry-ketchup", step: ["curry-ketchup"], ingredients: ["curry-ketchup", "mozzarella", "chicken", "onion"] },
  { id: "rendang-pizza", sauce: "curry-ketchup", step: ["beef"], ingredients: ["curry-ketchup", "mozzarella", "beef", "onion"] },
  { id: "tandoori-paneer-pizza", sauce: "curry-ketchup", step: ["paneer"], ingredients: ["curry-ketchup", "mozzarella", "paneer", "green-pepper", "onion"] },
  { id: "currywurst", sauce: "curry-ketchup", step: ["paprika-powder", "wurstel"], ingredients: ["curry-ketchup", "mozzarella", "wurstel", "paprika-powder"] },
  { id: "cuban-pizza", sauce: "mustard", step: ["mustard", "pickles", "swiss-cheese"], ingredients: ["mustard", "swiss-cheese", "pork", "ham", "pickles"] },
];

describe("new sauces (Owner-approved)", () => {
  it("curry-ketchup is a spread sauce named カレーケチャップ with the provisional colour #d9892b", () => {
    const i = getIngredient("curry-ketchup")!;
    expect(i.category).toBe("sauce");
    expect(i.placement).toBe("spread");
    expect(i.nameJa).toBe("カレーケチャップ");
    expect(i.color).toBe("#d9892b");
    expect(i.unlockCondition).toEqual({ minTotalStars: 0 });
  });
  it("mustard is a spread sauce", () => {
    const i = getIngredient("mustard")!;
    expect(i.category).toBe("sauce");
    expect(i.placement).toBe("spread");
  });
  it("sauces and cheeses carry no topping family; pickles is vegetable, beef / wurstel meat, paprika-powder spice", () => {
    for (const id of ["curry-ketchup", "mustard", "paneer", "swiss-cheese"]) expect(ingredientAttributeFamily(id), id).toBeNull();
    expect(ingredientAttributeFamily("pickles")).toBe("vegetable");
    expect(ingredientAttributeFamily("beef")).toBe("meat");
    expect(ingredientAttributeFamily("wurstel")).toBe("meat");
    expect(ingredientAttributeFamily("paprika-powder")).toBe("spice");
  });
  it("nori is NOT part of PR-1 (PR-2)", () => {
    expect(getIngredient("nori")).toBeUndefined();
  });
  it("curry-ketchup stays clearly apart from the other sauce colours (dE76 > 20 against every existing sauce)", () => {
    const lab = (hex: string) => {
      const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      const [r, g, b] = c;
      const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
      const f = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
      return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
    };
    const de = (a: string, b: string) => Math.hypot(...lab(a).map((v, k) => v - lab(b)[k]));
    const others = ["tomato-sauce", "pesto", "fromage-blanc-sauce", "doubanjiang", "miso-sauce"].map((id) => getIngredient(id)).filter((x) => x && x.category === "sauce" && x.color.startsWith("#"));
    for (const o of others) expect(de("#d9892b", o!.color), o!.id).toBeGreaterThan(20);
  });
});

describe.each(ROWS)("$id", (row) => {
  const recipe = RECIPES.find((r) => r.id === row.id)! as Recipe;
  const stepIndex = DISCOVERY_LADDER.steps.findIndex((s) => s.keyRecipeId === row.id);

  it("is made from exactly the 172 matrix ingredient set, the sauce first", () => {
    expect(recipe).toBeDefined();
    expect(recipe.requiredIngredients.map((q) => q.ingredientId).sort()).toEqual([...row.ingredients].sort());
    expect(recipe.requiredIngredients[0].ingredientId).toBe(row.sauce);
    expect(recipe.requiredIngredients[0].minCount).toBe(1);
  });

  it("is an ordinary recipe: lunchRush false, no CUT, generic bake window, every requirement placed before the bake", () => {
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(row.id)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(recipe.requiredIngredients.length).toBeLessThanOrEqual(6);
  });

  it("is painted with the existing PAINT gesture; its Reference has 8 pieces matching the required counts", () => {
    expect(getRecipeSauceProfile(row.id)).toEqual({ recipeId: row.id, ingredientId: row.sauce, interaction: "PAINT" });
    const ref = getReferencePizza(row.id)!;
    expect(ref.sauce?.ingredientId).toBe(row.sauce);
    const pieces = ref.pieceGroups.reduce((n, g) => n + g.positions.length, 0);
    expect(pieces).toBe(8);
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(recipe.requiredIngredients.find((q) => q.ingredientId === g.ingredientId)!.minCount);
  });

  it("is unlocked by ONE ordinary appended ladder step with no star gate", () => {
    const step = DISCOVERY_LADDER.steps[stepIndex];
    expect(step.kind).toBe("MATERIAL");
    expect(step.ingredientIds).toEqual(row.step);
    expect(step.starGates).toBeUndefined();
    expect(step.step).toBe(stepIndex + 1);
    expect(ordinaryLadderSteps(DISCOVERY_LADDER.steps)).toContain(step);
  });

  it("is the only recipe with this ingredient set, and no other recipe is a subset or superset of it", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = recipe.requiredIngredients.map((q) => q.ingredientId as string);
    expect(RECIPES.filter((r) => key(r.requiredIngredients.map((q) => q.ingredientId)) === key(mine)).map((r) => r.id)).toEqual([row.id]);
    for (const r of RECIPES) {
      if (r.id === row.id) continue;
      const theirs = r.requiredIngredients.map((q) => q.ingredientId as string);
      expect(theirs.every((i) => mine.includes(i)), `${r.id} is a subset`).toBe(false);
      expect(mine.every((i) => theirs.includes(i)), `${r.id} is a superset`).toBe(false);
    }
  });
});

describe("the five steps", () => {
  it("are consecutive, appended after sichuan-eggplant-pizza (steps 1-56 frozen), in dependency order", () => {
    const keys = DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId);
    const at = keys.indexOf("sichuan-eggplant-pizza");
    expect(keys.slice(at + 1, at + 6)).toEqual(ROWS.map((r) => r.id));
  });
  it("sell every new material by the T4 rule (first pack 120 Pitz, refill 60) at its own step", () => {
    for (const row of ROWS) {
      const stepNo = DISCOVERY_LADDER.steps.findIndex((s) => s.keyRecipeId === row.id) + 1;
      for (const id of row.step) {
        const offer = materialOffer(getIngredient(id)!)!;
        expect(offer.step, id).toBe(stepNo);
        expect(offer.tier, id).toBe("T4");
        expect(offer.packPrice, id).toBe(120);
        expect(offer.refillPrice, id).toBe(60);
      }
    }
  });
  it("give every new topping a size class", () => {
    for (const id of ["beef", "wurstel", "paprika-powder", "pickles", "paneer", "swiss-cheese"]) expect(TOPPING_SIZE_CLASS_BY_ID[id], id).toBeDefined();
  });
});
