import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { ingredientShelf } from "./ingredientShelf";
import { RECIPES, type Recipe } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { TOPPING_SIZE_CLASS_BY_ID } from "./toppingSizeClass";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { LATE_ENTITLEMENT_FLOORS } from "./lateCatalog";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { researchCohortLetters, researchEntryLabel } from "../logic/discovery/researchEntry";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex } from "../state/dex";
import matrix from "../../docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json";

/**
 * Expansion Batch 13 (Issue #708): potato-mayo-pizza (one new material, `mayo`; NO_SAUCE for this ONE row by the Owner exception of 2026-10-30).
 * PROVISIONAL SPEC: the original pizzadb.jp page was NOT confirmed (the 172 matrix row's sauce field is 'ホワイトソース -> unspecified', BASE_SAUCE_UNSPECIFIED), so NO_SAUCE, the counts, the bake window, the colour, the
 * emoji and the SVG shape are GAMEPLAY ASSUMPTIONS / CALIBRATION. (Ported from the duplicate PR #717 by the Owner's decision of 2026-10-31; the material offer, the late-step shift and the catalog counts are already pinned by
 * materialShop.test.ts / expansionBatch11.s1.test.ts / catalogLedger.test.ts, so they are not repeated here.) The structure is pinned strictly (credit, key recipe of the step, lunchRush false, no CUT, NO_SAUCE, the dedicated SVG, the spice family); the numbers are
 * pinned as the current provisional value.
 */
const ID = "potato-mayo-pizza";
const recipe = RECIPES.find((r) => r.id === ID)! as Recipe;
const COUNTS = { mozzarella: 2, potato: 2, bacon: 1, corn: 1, mayo: 2 };

describe("mayo, the one new material (provisional spec)", () => {
  it("is a scattered topping (NOT a sauce, NOT post-bake) drawn by the mayo-drop teardrop, size s, family spice", () => {
    expect(getIngredient("mayo")).toMatchObject({ id: "mayo", nameJa: "マヨネーズ", category: "topping", placement: "scatter", pieceVisual: "mayo-drop", color: "#fff6dc" });
    expect(TOPPING_SIZE_CLASS_BY_ID.mayo).toBe("s");
    expect(ingredientAttributeFamily("mayo")).toBe("spice");
    expect(ingredientShelf("mayo")).toBe("spice");
  });
  it("has an emoji no other ingredient uses (G18)", () => {
    const emoji = getIngredient("mayo")!.emoji;
    expect(INGREDIENTS.filter((i) => i.emoji === emoji).map((i) => i.id)).toEqual(["mayo"]);
  });
  it("is an ordinary finite material (not late, no star gate); its offer (step 65, T4, k=2) is pinned in materialShop.test.ts", () => {
    expect("mayo" in LATE_ENTITLEMENT_FLOORS).toBe(false);
  });
  it("replaces nothing: the neighbouring white cheeses keep their own visuals", () => {
    expect(getIngredient("ricotta-salata")!.pieceVisual).toBe("ricotta-salata-shavings");
    expect(getIngredient("cream-cheese")!.pieceVisual).toBe("cream-cheese-block");
  });
});

describe(ID, () => {
  it("has exactly the matrix ingredient set (bacon / corn / mayo / mozzarella / potato) with the provisional 8-piece counts and no sauce", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(COUNTS);
    expect(recipe.requiredIngredients.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(recipe.requiredIngredients.some((q) => getIngredient(q.ingredientId)?.category === "sauce")).toBe(false);
  });

  it("is a credited, Lunch Rush opt-out, key-free, no-CUT ordinary recipe with the generic bake window and every requirement placed before the bake", () => {
    expect(recipe.ladderCredit).toBeUndefined(); // credited (the default)
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(ID)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(RECIPE_HINT_ROLES[ID]).toEqual({ keyFree: true });
  });

  it("is NO_SAUCE (the existing `null` mapping) for this ONE row, and its Reference has no sauce", () => {
    expect(getRecipeSauceProfile(ID)).toBeNull();
    expect(noSauceRecipeIds().includes(ID)).toBe(true);
    expect(getReferencePizza(ID)!.sauce).toBeNull();
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(recipe.requiredIngredients.map((q) => q.ingredientId));
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(COUNTS[g.ingredientId as keyof typeof COUNTS]);
  });

  it("is the only recipe with this ingredient set, and no other recipe is a subset or superset of it", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = recipe.requiredIngredients.map((q) => q.ingredientId as string);
    expect(RECIPES.filter((r) => key(r.requiredIngredients.map((q) => q.ingredientId)) === key(mine)).map((r) => r.id)).toEqual([ID]);
    const mineSet = new Set(mine);
    for (const other of RECIPES) {
      if (other.id === ID) continue;
      const theirs = new Set(other.requiredIngredients.map((q) => q.ingredientId as string));
      const subset = [...theirs].every((i) => mineSet.has(i));
      const superset = mine.every((i) => theirs.has(i));
      expect(subset || superset, `${ID} vs ${other.id}`).toBe(false);
    }
  });
});

describe("the ordinary step 65", () => {
  it("is appended after step 64 (steps 1-64 frozen): mayo alone, no star gate, keyed to potato-mayo-pizza", () => {
    const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
    expect(steps).toHaveLength(65);
    expect(steps[63]).toMatchObject({ step: 64, ingredientIds: ["ricotta-salata"], keyRecipeId: "pizza-alla-norma" });
    expect(steps[64]).toMatchObject({ step: 65, kind: "MATERIAL", ingredientIds: ["mayo"], keyRecipeId: ID });
    expect(steps[64].starGates).toBeUndefined();
  });
  it("every other ingredient of the recipe is owned before step 65 (mayo is the last unlock), so the key recipe is exactly this one", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...ordinaryLadderSteps(DISCOVERY_LADDER.steps).slice(0, 64).flatMap((s) => s.ingredientIds)]);
    for (const q of recipe.requiredIngredients) if (q.ingredientId !== "mayo") expect(before.has(q.ingredientId), q.ingredientId).toBe(true);
    expect(before.has("mayo")).toBe(false);
  });
});

describe("the discovery target is the 172 matrix row's PIZZA DB composition (Owner exception for this ONE row: BASE_SAUCE_UNSPECIFIED adopted as NO_SAUCE)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; ingredients: { canonicalIngredientIds: string[]; incompleteReasons: string[] }; sauceBase: { status: string; baseIngredientId: string | null } }[] }).rows;
  const row = rows.find((r) => r.evidenceId === "potato-mayo-pizza-pizzadb-p3")!;

  it("the target's items equal the matrix's canonical ingredient ids, the matrix row is unchanged (still BLOCKED_PRODUCT_DECISION), and the target is ELIGIBLE", () => {
    expect(row.productDecisionStatus).toBe("BLOCKED_PRODUCT_DECISION");
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("potato-mayo-pizza-pizzadb-p3");
    expect([...target.items].sort()).toEqual([...row.ingredients.canonicalIngredientIds].sort());
    expect(target.eligibility).toEqual({ status: "ELIGIBLE" });
  });

  it("the matrix's sauce base is unspecified (the reason for the Owner exception); the runtime target carries NO sauce base, so any sauce on the pizza is a different set", () => {
    expect(row.ingredients.incompleteReasons).toContain("unspecified_sauce_base");
    expect(row.sauceBase).toMatchObject({ status: "unspecified", baseIngredientId: null });
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.sauceBase ?? []).toEqual([]);
    expect(target.items.some((i) => getIngredient(i)?.category === "sauce")).toBe(false);
  });
});

/** A pizza that physically recreates the Reference (no sauce, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(bakeResult = 66): PizzaState {
  const reference = getReferencePizza(ID)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${ID}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe(`${ID}: Free Cooking / Research round (Completion Gate, discovery)`, () => {
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(recipe, referenceLikePizza())).toEqual({ status: "PASS" });
  });

  it("cooked with exactly its ingredients it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
    const sig = signatureOfPizza(referenceLikePizza());
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: ID } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
    const dex = registerScoreToDex(EMPTY_DEX, ID, { total: 70, stars: 3, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 }).dex;
    expect(discoveredRecipeIds(dex)).toEqual([ID]);
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [ID])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });

  it("resolveFreeCookPizza (the CONFIRM_BAKE entry) discovers it from exactly the five ids, with any positive counts", () => {
    const r = resolveFreeCookPizza(referenceLikePizza(), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
  });

  it("any sauce, a missing ingredient or an extra ingredient makes it an ORIGINAL pizza (identity is the exact ingredient set; a sauce changes the set)", () => {
    const base = referenceLikePizza();
    const variants: Record<string, PizzaState> = {
      "white sauce added": { ...base, sauceIds: ["fresh-cream-sauce"] } as PizzaState,
      "tomato sauce added": { ...base, sauceIds: ["tomato-sauce"] } as PizzaState,
      "no mayo": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "mayo") } as PizzaState,
      "no mozzarella": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "mozzarella") } as PizzaState,
      "extra corn-free anchovy": { ...base, toppings: [...base.toppings, { id: "x", ingredientId: "anchovy", x: 50, y: 50 }] } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) {
      const r = resolveFreeCookPizza(pizza, EMPTY_DEX);
      expect(r.kind, label).toBe("ORIGINAL");
    }
  });

  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("unlock and Research label (Dex / Shop)", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);

  it("is makeable only once mayo is owned (step 65), and its Research label names only that material (no letter: a single-member cohort)", () => {
    const without = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...ladderMaterials.filter((m) => m !== "mayo")], RECIPES.filter((r) => r.id !== ID));
    expect(without.has(ID)).toBe(false);
    const letters = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...ladderMaterials], RECIPES);
    expect(letters.has(ID)).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "mayo", cohortLetter: null })).toBe("？？？ピザ（マヨネーズ）");
  });

  it("changes NO existing recipe's Research letter (mayo is the sole material of its step: no accepted shift)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const now = researchCohortLetters(owned, RECIPES);
    const before = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== ID));
    expect([...now].sort()).toEqual([...before].sort());
  });
});
