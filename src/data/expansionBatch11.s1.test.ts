import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { RECIPES, type Recipe, type RecipeId } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { TOPPING_SIZE_CLASS_BY_ID } from "./toppingSizeClass";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { LATE_ENTITLEMENT_FLOORS } from "./lateCatalog";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";

/**
 * B11 S1 (boscaiola / porcini-pizza / pescatore). PROVISIONAL SPEC: the original pizzadb.jp pages were NOT confirmed, so the counts, bake window, colours, glyphs, names and the SVG shapes are GAMEPLAY ASSUMPTIONS / CALIBRATION.
 * The Owner-approved structure is pinned strictly (credit, NO_SAUCE, key recipe of each step, lunchRush false, no CUT, the single-sauce pescatore, the dedicated SVG per new material); the numbers are pinned as the current provisional values.
 */
interface Row {
  id: RecipeId;
  sauce: { ingredientId: string; interaction: "PAINT" | "PAINT_TEMPORARY" } | null;
  credited: boolean;
  counts: Record<string, number>;
}
const ROWS: readonly Row[] = [
  { id: "boscaiola", sauce: { ingredientId: "olive-oil", interaction: "PAINT_TEMPORARY" }, credited: true, counts: { "olive-oil": 1, mozzarella: 2, porcini: 3, sausage: 3 } },
  { id: "porcini-pizza", sauce: null, credited: false, counts: { mozzarella: 3, porcini: 3, garlic: 1, parsley: 1 } },
  { id: "pescatore", sauce: { ingredientId: "tomato-sauce", interaction: "PAINT" }, credited: true, counts: { "tomato-sauce": 1, mozzarella: 2, shrimp: 2, clam: 1, mussel: 1, garlic: 1, parsley: 1 } },
];

describe("the two new materials (provisional spec)", () => {
  it("porcini: a vegetable topping drawn by porcini-slice, size m; mussel: a seafood topping drawn by mussel-shell, size s", () => {
    expect(getIngredient("porcini")).toMatchObject({ category: "topping", placement: "scatter", pieceVisual: "porcini-slice", nameJa: "ポルチーニ" });
    expect(getIngredient("mussel")).toMatchObject({ category: "topping", placement: "scatter", pieceVisual: "mussel-shell", nameJa: "ムール貝" });
    expect(ingredientAttributeFamily("porcini")).toBe("vegetable");
    expect(ingredientAttributeFamily("mussel")).toBe("seafood");
    expect(TOPPING_SIZE_CLASS_BY_ID.porcini).toBe("m");
    expect(TOPPING_SIZE_CLASS_BY_ID.mussel).toBe("s");
  });
  it("both are ordinary finite materials (not late, no star gate), sold at the T4 price at their own step (first pack 120 Pitz, refill 60): porcini step 62 (k=3 -> 30), mussel step 63 (k=1 -> 10)", () => {
    expect(materialOffer(getIngredient("porcini")!)).toEqual({ ingredientId: "porcini", step: 62, tier: "T4", k: 3, packQuantity: 30, packPrice: 120, refillPrice: 60 });
    expect(materialOffer(getIngredient("mussel")!)).toEqual({ ingredientId: "mussel", step: 63, tier: "T4", k: 1, packQuantity: 10, packPrice: 120, refillPrice: 60 });
    for (const id of ["porcini", "mussel"]) expect(id in LATE_ENTITLEMENT_FLOORS, id).toBe(false);
  });
  it("the plain mushroom, clam and shrimp keep their own rows (porcini / mussel replace nothing)", () => {
    expect(INGREDIENTS.filter((i) => ["mushroom", "clam", "shrimp"].includes(i.id)).map((i) => i.id).sort()).toEqual(["clam", "mushroom", "shrimp"]);
    expect(getIngredient("clam")!.pieceVisual).toBe("clam-valve");
    expect(getIngredient("shrimp")!.pieceVisual).toBe("shrimp-curl");
  });
});

describe.each(ROWS)("$id", (row) => {
  const recipe = RECIPES.find((r) => r.id === row.id)! as Recipe;

  it("has exactly the provisional ingredient counts, the sauce first when it has one", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(row.counts);
    if (row.sauce) expect(recipe.requiredIngredients[0].ingredientId).toBe(row.sauce.ingredientId);
  });

  it("is an ordinary recipe: lunchRush false, no CUT, generic bake window, every requirement placed before the bake, key-free Hint, base reward 100", () => {
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(row.id)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(RECIPE_HINT_ROLES[row.id]).toEqual({ keyFree: true });
  });

  it("credit: " + (row.credited ? "credited (the key recipe of its own step)" : "non-credit (ladderCredit false)"), () => {
    expect((recipe as { ladderCredit?: boolean }).ladderCredit).toBe(row.credited ? undefined : false);
  });

  it("its sauce profile is the declared one (NO_SAUCE is the existing `null` mapping)", () => {
    expect(getRecipeSauceProfile(row.id)).toEqual(row.sauce ? { recipeId: row.id, ...row.sauce } : null);
    expect(noSauceRecipeIds().includes(row.id as never)).toBe(row.sauce === null);
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts; parsley lands as a light leaf", () => {
    const ref = getReferencePizza(row.id)!;
    expect(ref.sauce === null).toBe(row.sauce === null);
    const pieces = ref.pieceGroups.flatMap((g) => g.positions);
    expect(pieces).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    for (const g of ref.pieceGroups) {
      expect(g.positions.length).toBe(row.counts[g.ingredientId]);
      expect(g.interaction.landingStyle, g.ingredientId).toBe(g.ingredientId === "parsley" ? "LIGHT_LEAF" : "HEAVY_SQUASH");
    }
  });

  it("is the only recipe with this ingredient set, and no other recipe is a subset or superset of it", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = recipe.requiredIngredients.map((q) => q.ingredientId as string);
    expect(RECIPES.filter((r) => key(r.requiredIngredients.map((q) => q.ingredientId)) === key(mine)).map((r) => r.id)).toEqual([row.id]);
  });
});

describe("the two ordinary steps (62 and 63), derived by the REC-04 rule", () => {
  it("are appended after cuban-pizza's step 61 (steps 1-61 frozen), one material each, no star gate, keyed to boscaiola (not porcini-pizza: REC-04 ties break by recipe id) and pescatore", () => {
    const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps).slice(0, 63); // (Expansion Batch 12 appends step 64 after these)
    expect(steps).toHaveLength(63);
    expect(steps[60]).toMatchObject({ step: 61, keyRecipeId: "cuban-pizza" });
    expect(steps[61]).toMatchObject({ step: 62, kind: "MATERIAL", ingredientIds: ["porcini"], keyRecipeId: "boscaiola" });
    expect(steps[62]).toMatchObject({ step: 63, kind: "MATERIAL", ingredientIds: ["mussel"], keyRecipeId: "pescatore" });
    expect(steps[61].starGates).toBeUndefined();
    expect(steps[62].starGates).toBeUndefined();
    expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === "porcini-pizza")).toBe(false);
  });
  it("the late steps follow them at 66-72 (derived; Expansion Batch 12 inserted the ordinary step 64, Expansion Batch 13 the ordinary step 65), and the fixed floors are unchanged", () => {
    const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;
    expect(["salmon-roe", "yuzu-kosho", "miso-sauce", "tahini", "bbq-sauce", "wasabi", "nori"].map(stepOf)).toEqual([66, 67, 68, 69, 70, 71, 72]);
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68 });
  });
});

describe("pescatore's single sauce (Owner decision 2026-10-28, option A; GAMEPLAY ASSUMPTION, original NOT confirmed)", () => {
  it("omits the olive-oil of the source ingredient set: tomato-sauce is its only sauce, and seven distinct ingredients make it the second Hint price-cap exception", () => {
    const recipe = RECIPES.find((r) => r.id === "pescatore")!;
    const ids = recipe.requiredIngredients.map((q) => q.ingredientId as string);
    expect(ids).not.toContain("olive-oil");
    expect(ids.filter((i) => getIngredient(i)?.category === "sauce")).toEqual(["tomato-sauce"]);
    expect(new Set(ids).size).toBe(7);
  });
});
