import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { RECIPES, type Recipe, type RecipeId } from "./recipes";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { TOPPING_SIZE_CLASS_BY_ID } from "./toppingSizeClass";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { LATE_ENTITLEMENT_FLOORS } from "./lateCatalog";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { buildIdealSauceFixture } from "./referencePizza";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { computeScoringV2 } from "../logic/scoringV2";
import { researchCohortLetters, researchEntryLabel } from "../logic/discovery/researchEntry";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex } from "../state/dex";
import matrix from "../../docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json";

/**
 * Expansion Batch 12 (Issue #707): supreme-pizza (existing materials only, non-credit) and pizza-alla-norma (one new material, ricotta-salata).
 * PROVISIONAL SPEC: the original pizzadb.jp pages were NOT confirmed, so the counts, bake window, colour, names and the SVG shape are GAMEPLAY ASSUMPTIONS / CALIBRATION.
 * The structure is pinned strictly (credit, key recipe of the step, lunchRush false, no CUT, tomato-sauce PAINT, the dedicated SVG); the numbers are pinned as the current provisional value.
 */
interface Row {
  id: RecipeId;
  credited: boolean;
  counts: Record<string, number>;
}
const ROWS: readonly Row[] = [
  { id: "supreme-pizza", credited: false, counts: { "tomato-sauce": 1, pepperoni: 2, sausage: 2, mushroom: 1, onion: 1, "bell-pepper": 1, "black-olive": 1 } },
  { id: "pizza-alla-norma", credited: true, counts: { "tomato-sauce": 1, eggplant: 3, "ricotta-salata": 3, basil: 2 } },
];

describe("ricotta-salata, the one new material (provisional spec)", () => {
  it("is a cheese drawn by ricotta-salata-shavings, size l, with no topping family (cheeses have none)", () => {
    expect(getIngredient("ricotta-salata")).toMatchObject({ category: "cheese", placement: "scatter", pieceVisual: "ricotta-salata-shavings", nameJa: "リコッタサラータ" });
    expect(TOPPING_SIZE_CLASS_BY_ID["ricotta-salata"]).toBe("l");
    expect(ingredientAttributeFamily("ricotta-salata")).toBeNull();
  });
  it("is an ordinary finite material (not late, no star gate) at its own step 64, T4 (k=3 from the 3 pieces -> 30 per pack, first pack 120 Pitz, refill 60)", () => {
    expect(materialOffer(getIngredient("ricotta-salata")!)).toEqual({ ingredientId: "ricotta-salata", step: 64, tier: "T4", k: 3, packQuantity: 30, packPrice: 120, refillPrice: 60 });
    expect("ricotta-salata" in LATE_ENTITLEMENT_FLOORS).toBe(false);
  });
  it("the existing ricotta and feta keep their own visuals (ricotta-salata replaces nothing)", () => {
    expect(getIngredient("ricotta")!.pieceVisual).toBe("ricotta-mound");
    expect(getIngredient("feta")!.pieceVisual).toBe("feta-cubes");
  });
});

describe.each(ROWS)("$id", (row) => {
  const recipe = RECIPES.find((r) => r.id === row.id)! as Recipe;

  it("has exactly the provisional ingredient counts, tomato-sauce first", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(row.counts);
    expect(recipe.requiredIngredients[0].ingredientId).toBe("tomato-sauce");
  });

  it("is an ordinary recipe: lunchRush false, no CUT, generic bake window, every requirement placed before the bake, key-free Hint, base reward 100", () => {
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(row.id)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(RECIPE_HINT_ROLES[row.id]).toEqual({ keyFree: true });
  });

  it("credit: " + (row.credited ? "credited (the key recipe of its own step)" : "non-credit (ladderCredit false, no step of its own)"), () => {
    expect((recipe as { ladderCredit?: boolean }).ladderCredit).toBe(row.credited ? undefined : false);
  });

  it("its sauce is the tomato-sauce PAINT", () => {
    expect(getRecipeSauceProfile(row.id)).toEqual({ recipeId: row.id, ingredientId: "tomato-sauce", interaction: "PAINT" });
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts; basil lands as a light leaf", () => {
    const ref = getReferencePizza(row.id)!;
    const pieces = ref.pieceGroups.flatMap((g) => g.positions);
    expect(pieces).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    for (const g of ref.pieceGroups) {
      expect(g.positions.length).toBe(row.counts[g.ingredientId]);
      expect(g.interaction.landingStyle, g.ingredientId).toBe(g.ingredientId === "basil" ? "LIGHT_LEAF" : "HEAVY_SQUASH");
    }
  });

  it("is the only recipe with this ingredient set, and no other recipe is a subset or superset of it", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = recipe.requiredIngredients.map((q) => q.ingredientId as string);
    expect(RECIPES.filter((r) => key(r.requiredIngredients.map((q) => q.ingredientId)) === key(mine)).map((r) => r.id)).toEqual([row.id]);
    const mineSet = new Set(mine);
    for (const other of RECIPES) {
      if (other.id === row.id) continue;
      const theirs = new Set(other.requiredIngredients.map((q) => q.ingredientId as string));
      const subset = [...theirs].every((i) => mineSet.has(i));
      const superset = mine.every((i) => theirs.has(i));
      expect(subset || superset, `${row.id} vs ${other.id}`).toBe(false);
    }
  });
});

describe("the ordinary step 64 and the supreme-pizza non-step", () => {
  it("step 64 is appended after pescatore's step 63 (steps 1-63 frozen): ricotta-salata alone, no star gate, keyed to pizza-alla-norma; supreme-pizza owns no step", () => {
    const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
    expect(steps).toHaveLength(65); // + Expansion Batch 13's step 65 (mayo), pinned in expansionBatch13.test.ts
    expect(steps[62]).toMatchObject({ step: 63, keyRecipeId: "pescatore" });
    expect(steps[63]).toMatchObject({ step: 64, kind: "MATERIAL", ingredientIds: ["ricotta-salata"], keyRecipeId: "pizza-alla-norma" });
    expect(steps[63].starGates).toBeUndefined();
    expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === "supreme-pizza")).toBe(false);
  });
  it("the late steps follow at 66-72 (derived; Expansion Batch 13 added the ordinary step 65), and the fixed floors are unchanged", () => {
    const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;
    expect(["salmon-roe", "yuzu-kosho", "miso-sauce", "tahini", "bbq-sauce", "wasabi", "nori"].map(stepOf)).toEqual([66, 67, 68, 69, 70, 71, 72]);
    expect(LATE_ENTITLEMENT_FLOORS["salmon-roe"]).toBe(57);
  });
});

describe("supreme-pizza's recorded deferral", () => {
  it("the catalog candidate id `supreme` (7 non-sauce types incl. mozzarella) is still not in RECIPES; the PIZZA DB set ships as `supreme-pizza` with 6 non-sauce types", () => {
    const ids: readonly string[] = RECIPES.map((r) => r.id);
    expect(ids.includes("supreme")).toBe(false);
    const supreme = RECIPES.find((r) => r.id === "supreme-pizza")!;
    const nonSauce = supreme.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    expect(nonSauce).toHaveLength(6);
    expect(nonSauce.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(nonSauce.some((q) => (q.ingredientId as string) === "mozzarella")).toBe(false);
  });
});

describe("the discovery targets are the 172 matrix rows' PIZZA DB compositions (Owner approval pending: both rows are BLOCKED_PRODUCT_DECISION)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; ingredients: { identityIngredientSet: string[] } }[] }).rows;
  it.each([
    ["supreme-pizza", "supreme-pizzadb"],
    ["pizza-alla-norma", "pizza-alla-norma-pizzadb-p9"],
  ])("%s <- %s: the target's items equal the matrix identity set, and the matrix row is unchanged (still BLOCKED_PRODUCT_DECISION)", (recipeId, evidenceId) => {
    const row = rows.find((r) => r.evidenceId === evidenceId)!;
    expect(row.productDecisionStatus).toBe("BLOCKED_PRODUCT_DECISION");
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === recipeId)!;
    expect(target.targetId).toBe(evidenceId);
    expect([...target.items].sort()).toEqual([...row.ingredients.identityIngredientSet].sort());
    expect(target.eligibility).toEqual({ status: "ELIGIBLE" });
  });
});

/** A pizza that physically recreates the Reference (exact sauce fixture, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(id: RecipeId, bakeResult = 66): PizzaState {
  const reference = getReferencePizza(id)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce!.ingredientId],
    sauceDeposits: buildIdealSauceFixture().map((d) => ({ ...d })),
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${id}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe.each(ROWS)("$id: Free Cooking / Research round (Completion Gate, discovery, scoring)", (row) => {
  const recipe = RECIPES.find((r) => r.id === row.id)! as Recipe;

  it("a perfect round passes the Completion Gate and Scoring 2.0 awards the top band (sauce quantity / coverage match the Reference)", () => {
    const pizza = referenceLikePizza(row.id);
    expect(evaluatePizzaCompletion(recipe, pizza)).toEqual({ status: "PASS" });
    const scored = computeScoringV2(recipe, pizza);
    const sauce = scored.components.sauce;
    expect(sauce.available).toBe(true);
    if (sauce.available) {
      expect(sauce.quantitySimilarity).toBeGreaterThan(0.95);
      expect(sauce.coverageSimilarity).toBeGreaterThan(0.95);
    }
  });

  it("cooked with exactly its ingredients it is a UNIQUE_MATCH -> NEW_DISCOVERY (FREE COOKING / Research), and a Dex that has it does not announce it again", () => {
    const sig = signatureOfPizza(referenceLikePizza(row.id));
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: row.id } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: row.id });
    const dex = registerScoreToDex(EMPTY_DEX, row.id, { total: 70, stars: 3, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 }).dex;
    expect(discoveredRecipeIds(dex)).toEqual([row.id]);
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [row.id])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });

  it("an extra or missing ingredient does not discover it (it never matches a different target by accident)", () => {
    const pizza = referenceLikePizza(row.id);
    const withExtra = { ...pizza, toppings: [...pizza.toppings, { id: "x", ingredientId: "anchovy", x: 50, y: 50 }] } as PizzaState;
    const noLast = { ...pizza, toppings: pizza.toppings.filter((t) => t.ingredientId !== pizza.toppings.at(-1)!.ingredientId) } as PizzaState;
    for (const p of [withExtra, noLast]) {
      const r = matchDiscovery(signatureOfPizza(p), RECIPE_DISCOVERY_CATALOG);
      expect(r.kind === "UNIQUE_MATCH" ? r.target.recipeId : null).not.toBe(row.id);
    }
  });
});

describe("unlock and Research label (Dex / Shop)", () => {
  const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);

  it("pizza-alla-norma becomes makeable only once ricotta-salata is owned (step 64), and its Research label names only that material (no letter: a single-member cohort)", () => {
    expect(stepOf("ricotta-salata")).toBe(64);
    const without = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...ladderMaterials.filter((m) => m !== "ricotta-salata")], RECIPES.filter((r) => r.id !== "pizza-alla-norma"));
    expect(without.has("pizza-alla-norma")).toBe(false);
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const letters = researchCohortLetters(owned, RECIPES);
    expect(letters.has("pizza-alla-norma")).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "ricotta-salata", cohortLetter: null })).toBe("？？？ピザ（リコッタサラータ）");
  });

  it("supreme-pizza's last-unlocking material is bell-pepper (ordinary step 28): it shares that cohort with spanish-chorizo-pizza, so supreme-pizza is A and spanish-chorizo-pizza gains B (the one accepted letter shift, Owner confirmation pending); no other existing recipe moves", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const now = researchCohortLetters(owned, RECIPES);
    const before = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== "supreme-pizza" && r.id !== "pizza-alla-norma"));
    expect(now.get("supreme-pizza")).toBe("A");
    expect(now.get("spanish-chorizo-pizza")).toBe("B");
    expect(before.has("spanish-chorizo-pizza")).toBe(false);
    for (const [id, letter] of before) expect(now.get(id), id).toBe(letter);
    const moved = [...now].filter(([id, letter]) => !["supreme-pizza", "pizza-alla-norma"].includes(id) && before.get(id) !== letter).map(([id]) => id);
    expect(moved).toEqual(["spanish-chorizo-pizza"]);
    expect(researchEntryLabel({ unlockIngredientId: "bell-pepper", cohortLetter: "A" })).toBe("？？？ピザ A（パプリカ）");
  });
});
