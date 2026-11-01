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
 * Expansion Batch 14: moussaka-style-pizza (one new material, `cinnamon`). PROVISIONAL SPEC: the original pizzadb.jp page was NOT confirmed. The 172 matrix row's sauce field is 'ホワイトソース', which the canonicalizer leaves
 * ambiguous (its only related id is fromage-blanc-sauce). OWNER DECISION (this recipe only; NOT a NO_SAUCE exception): the existing fromage-blanc-sauce stands in for it. The counts, the bake window, the colour, the emoji, the SVG
 * shape and when the cinnamon is added are GAMEPLAY ASSUMPTIONS / CALIBRATION. The structure is pinned strictly (credit, key recipe of the step, lunchRush false, no CUT, the PAINT sauce, the dedicated SVG, the spice family);
 * the numbers are pinned as the current provisional values.
 */
const ID = "moussaka-style-pizza";
const recipe = RECIPES.find((r) => r.id === ID)! as Recipe;
const COUNTS = { "fromage-blanc-sauce": 1, eggplant: 2, lamb: 2, feta: 2, cinnamon: 2 };
const PIECE_COUNTS = { eggplant: 2, lamb: 2, feta: 2, cinnamon: 2 };

describe("cinnamon, the one new material (provisional spec)", () => {
  it("is a scattered topping (NOT a sauce, NOT post-bake) drawn by the cinnamon-powder-pile, size s, family spice", () => {
    expect(getIngredient("cinnamon")).toMatchObject({ id: "cinnamon", nameJa: "シナモン", category: "topping", placement: "scatter", pieceVisual: "cinnamon-powder-pile", color: "#b9733a" });
    expect(TOPPING_SIZE_CLASS_BY_ID.cinnamon).toBe("s");
    expect(ingredientAttributeFamily("cinnamon")).toBe("spice");
    expect(ingredientShelf("cinnamon")).toBe("spice");
  });
  it("has an emoji no other ingredient uses (G18) and that is not the spice family symbol", () => {
    const emoji = getIngredient("cinnamon")!.emoji;
    expect(emoji).toBe("\u{1F36A}");
    expect(INGREDIENTS.filter((i) => i.emoji === emoji).map((i) => i.id)).toEqual(["cinnamon"]);
    expect(emoji).not.toBe("\u{1F9C2}");
  });
  it("is an ordinary finite material (not late, no star gate); its offer (step 66, T4, k=2) is pinned in materialShop.test.ts", () => {
    expect("cinnamon" in LATE_ENTITLEMENT_FLOORS).toBe(false);
  });
  it("replaces nothing: the other powder keeps its own visual and a different colour", () => {
    expect(getIngredient("paprika-powder")!.pieceVisual).toBe("paprika-powder-pile");
    expect(getIngredient("paprika-powder")!.color).not.toBe(getIngredient("cinnamon")!.color);
  });
});

describe(ID, () => {
  it("has the matrix ingredient set (cinnamon / eggplant / feta / lamb) plus the stand-in sauce, with the provisional counts (8 non-sauce pieces)", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual(COUNTS);
    const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    expect(pieces.reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category === "sauce").map((q) => q.ingredientId)).toEqual(["fromage-blanc-sauce"]);
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

  it("uses the existing fromage-blanc-sauce PAINT (NOT a NO_SAUCE exception), and its Reference carries that sauce", () => {
    expect(getRecipeSauceProfile(ID)).toEqual({ recipeId: ID, ingredientId: "fromage-blanc-sauce", interaction: "PAINT" });
    expect((noSauceRecipeIds() as readonly string[]).includes(ID)).toBe(false);
    expect(getReferencePizza(ID)!.sauce).not.toBeNull();
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(recipe.requiredIngredients.filter((q) => q.ingredientId !== "fromage-blanc-sauce").map((q) => q.ingredientId));
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(PIECE_COUNTS[g.ingredientId as keyof typeof PIECE_COUNTS]);
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

describe("the ordinary step 66", () => {
  it("is appended after step 65 (steps 1-65 frozen): cinnamon alone, no star gate, keyed to moussaka-style-pizza", () => {
    const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
    expect(steps).toHaveLength(66);
    expect(steps[64]).toMatchObject({ step: 65, ingredientIds: ["mayo"], keyRecipeId: "potato-mayo-pizza" });
    expect(steps[65]).toMatchObject({ step: 66, kind: "MATERIAL", ingredientIds: ["cinnamon"], keyRecipeId: ID });
    expect(steps[65].starGates).toBeUndefined();
  });
  it("every other ingredient of the recipe is owned before step 66 (cinnamon is the last unlock), so the key recipe is exactly this one", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...ordinaryLadderSteps(DISCOVERY_LADDER.steps).slice(0, 65).flatMap((s) => s.ingredientIds)]);
    for (const q of recipe.requiredIngredients) if (q.ingredientId !== "cinnamon") expect(before.has(q.ingredientId), q.ingredientId).toBe(true);
    expect(before.has("cinnamon")).toBe(false);
  });
});

describe("the discovery target composes the matrix row's ingredients with the stand-in sauce (Owner exception for this ONE recipe: 'ホワイトソース' read as fromage-blanc-sauce)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; ingredients: { canonicalIngredientIds: string[]; complete: boolean; unresolvedTokens: { token: string; relatedIds: string[] }[] }; sauceBase: { status: string; baseIngredientId: string | null } }[] }).rows;
  const row = rows.find((r) => r.evidenceId === "moussaka-style-pizza-pizzadb-p13")!;

  it("the matrix row is unchanged (still BLOCKED_PRODUCT_DECISION, the white sauce unresolved with fromage-blanc-sauce as its only related id)", () => {
    expect(row.productDecisionStatus).toBe("BLOCKED_PRODUCT_DECISION");
    expect(row.ingredients.complete).toBe(false);
    expect(row.ingredients.unresolvedTokens).toEqual([{ token: "ホワイトソース", disposition: "ambiguous", relatedIds: ["fromage-blanc-sauce"] }]);
    expect([...row.ingredients.canonicalIngredientIds].sort()).toEqual(["cinnamon", "eggplant", "feta", "lamb"]);
  });

  it("the runtime target is the four matrix ids plus the stand-in sauce", () => {
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("moussaka-style-pizza-pizzadb-p13");
    expect([...target.items].sort()).toEqual(["cinnamon", "eggplant", "feta", "fromage-blanc-sauce", "lamb"]);
  });
});

/** A pizza that physically recreates the Reference (the stand-in sauce, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(bakeResult = 66): PizzaState {
  const reference = getReferencePizza(ID)!;
  return {
    ...createEmptyPizza(),
    sauceIds: ["fromage-blanc-sauce"],
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

  it("no sauce, another sauce, a missing ingredient or an extra ingredient makes it an ORIGINAL pizza (identity is the exact ingredient set; the sauce is part of it)", () => {
    const base = referenceLikePizza();
    const variants: Record<string, PizzaState> = {
      "no sauce": { ...base, sauceIds: [] } as PizzaState,
      "tomato sauce instead": { ...base, sauceIds: ["tomato-sauce"] } as PizzaState,
      "cream sauce instead": { ...base, sauceIds: ["fresh-cream-sauce"] } as PizzaState,
      "no cinnamon": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "cinnamon") } as PizzaState,
      "no feta": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "feta") } as PizzaState,
      "extra anchovy": { ...base, toppings: [...base.toppings, { id: "x", ingredientId: "anchovy", x: 50, y: 50 }] } as PizzaState,
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

  it("is makeable only once cinnamon is owned (step 66), and its Research label names only that material (no letter: a single-member cohort)", () => {
    const without = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...ladderMaterials.filter((m) => m !== "cinnamon")], RECIPES.filter((r) => r.id !== ID));
    expect(without.has(ID)).toBe(false);
    const letters = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...ladderMaterials], RECIPES);
    expect(letters.has(ID)).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "cinnamon", cohortLetter: null })).toBe("？？？ピザ（シナモン）");
  });

  it("changes NO existing recipe's Research letter (cinnamon is the sole material of its step: no accepted shift)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const now = researchCohortLetters(owned, RECIPES);
    const before = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== ID));
    expect([...now].sort()).toEqual([...before].sort());
  });
});
