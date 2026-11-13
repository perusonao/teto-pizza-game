import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { LATE_ENTITLEMENT_FLOORS, LATE_INGREDIENTS, LATE_LADDER_STEPS, LATE_TAXONOMY_ROWS, LATE_TOPPING_SIZE_CLASS } from "./lateCatalog";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { toppingSizeClass } from "./toppingSizeClass";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B18_APPROVED_AUDITED_ALTERNATE_ORDER_LETTER_CHANGES, B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS } from "../logic/catalog/testSupport/recipeBatchManifest";
import { researchLetterChangesAcrossOrders } from "../logic/catalog/testSupport/researchLabelAudit";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { deriveResearchEntries, researchCohortLetters, researchEntryLabel } from "../logic/discovery/researchEntry";
import { materialOffer } from "../logic/materialShop";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex } from "../state/dex";
import matrix from "../../docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json";
import { COMPOSED } from "../logic/catalog/testSupport/composedForBuild";

/**
 * Expansion Batch 18 (Issue #748): baingan-bharta-pizza (credited) + reina-pepiada-pizza (NOT credited) + `cilantro` PROMOTED from the late catalog to an ordinary material (ordinary step 69). PROVISIONAL SPEC: the original pizzadb.jp pages were NOT
 * confirmed; the only evidence is the 172 matrix rows `baingan-bharta-pizza-pizzadb-p6` ('カレー') and `venezuelan-reina-pepiada-pizzadb-p12` ('ホワイトソース'), both BASE_SAUCE_UNSPECIFIED (comparison tables p6 / p12, relayed 2026-09-22, never re-fetched).
 *
 * RECIPE-SPECIFIC Owner decisions (2026-11-04), not general rules and NOT NO_SAUCE: the existing curry-ketchup stands in for the curry base (as the Batch 10 curry recipes), the existing fromage-blanc-sauce for the white sauce (as moussaka-style-pizza);
 * mayo is the existing squeeze topping; the cilantro is placed BEFORE the bake. Counts / the generic 58-78 bake window are GAMEPLAY ASSUMPTIONS. No new technique, no FINISH / prep / sear / steam step.
 */
const BAINGAN = "baingan-bharta-pizza";
const REINA = "reina-pepiada-pizza";
const BBQ = "bbq-chicken-pizza";
const baingan = RECIPES.find((r) => r.id === BAINGAN)! as Recipe;
const reina = RECIPES.find((r) => r.id === REINA)! as Recipe;
const NEW_IDS: readonly string[] = [BAINGAN, REINA];
const ORDINARY = ordinaryRecipes(RECIPES);
// Expansion Batch 21 (#780) is a LATER batch: its two late recipes are left out of the Research measurements that must keep Batch 18 meaning (the Batch 21 audit is in expansionBatch21.test.ts).
// Expansion Batch 22 (#780) is a LATER batch (like Batch 21): its six recipes and ten materials are left out of this Batch 18 before/after comparison, so it stays the sample Batch 18 was approved against.
const B22_RECIPES_LATER: readonly string[] = ["speck-e-brie", "buffalo-chicken", "pizza-finocchi-salad", "pizza-cavolo-carote", "pizza-radicchio-noci", "black-truffle-pizza", "apple-cinnamon-dessert"]; // + Expansion Batch 23 (#780), a LATER batch
const B22_MATERIALS_LATER: readonly string[] = ["brie", "buffalo-sauce", "fennel", "orange", "carrot", "red-cabbage", "sunflower-seeds", "radicchio", "truffle", "balsamic-vinegar", "apple"]; // + Expansion Batch 23 (#780)
const WITHOUT_B21 = (RECIPES as readonly Recipe[]).filter((r) => r.id !== "taco-pizza" && r.id !== "okonomiyaki-style-pizza" && !B22_RECIPES_LATER.includes(r.id));
const idsOf = (r: Recipe) => r.requiredIngredients.map((q) => q.ingredientId as string);
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};

describe("cilantro, promoted from the late catalog to an ordinary material (same id, same look)", () => {
  const ing = getIngredient("cilantro")!;
  it("keeps its identity: a finite scatter topping named パクチー, colour / emoji / sprig art unchanged, family herb, size class xs, bake-resistant leaf", () => {
    expect(ing).toMatchObject({ id: "cilantro", category: "topping", nameJa: "パクチー", color: "#6cae3e", emoji: "\u{1F33C}", pieceVisual: "cilantro-leaf", placement: "scatter", bakeRoastResistant: true });
    expect(ing.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ingredientAttributeFamily("cilantro")).toBe("herb");
    expect(toppingSizeClass("cilantro")).toBe("xs");
    expect(INGREDIENTS.filter((i) => i.emoji === ing.emoji).map((i) => i.id)).toEqual(["cilantro"]); // G18
  });
  it("is an ORDINARY ingredient now: no longer in any late table, and named by no late ladder step", () => {
    expect(LATE_INGREDIENTS.some((i) => i.id === "cilantro")).toBe(false);
    expect((LATE_TAXONOMY_ROWS as readonly (readonly [string, string])[]).some(([id]) => id === "cilantro")).toBe(false);
    expect("cilantro" in LATE_TOPPING_SIZE_CLASS).toBe(false);
    expect(LATE_LADDER_STEPS.some((s) => s.ingredientIds.includes("cilantro"))).toBe(false);
  });
  it("no new ingredient id: the catalog still has exactly one cilantro", () => {
    expect(INGREDIENTS.filter((i) => i.id === "cilantro")).toHaveLength(1);
  });
  it("its Shop offer is T4 / k = 2 (stock 20, pack 120 / refill 60), unchanged by the promotion, from ordinary step 69", () => {
    expect(materialOffer(ing)!).toMatchObject({ tier: "T4", k: 2, packPrice: 120, refillPrice: 60, step: 69 });
  });
  it("KEEPS its fixed compatibility floor (66): a floor only grants earlier and never re-locks, so no save loses or gains an entitlement it had", () => {
    expect(LATE_ENTITLEMENT_FLOORS.cilantro).toBe(66);
    expect(LATE_ENTITLEMENT_FLOORS["bbq-sauce"]).toBe(66);
  });
});

describe(BAINGAN, () => {
  it("has the matrix ingredient set (ナス / 玉ねぎ / トマト / モッツァレラ / コリアンダー = cilantro) plus the curry-ketchup stand-in sauce, 8 non-sauce pieces", () => {
    expect(Object.fromEntries(baingan.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual({ "curry-ketchup": 1, mozzarella: 2, eggplant: 2, "fresh-tomato": 1, onion: 1, cilantro: 2 });
    expect(baingan.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce").reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(idsOf(baingan)).toEqual(["curry-ketchup", "mozzarella", "eggplant", "fresh-tomato", "onion", "cilantro"]); // sauce, cheese, toppings; cilantro last (the Rule W reserved material)
  });
  it("is a credited, Lunch Rush opt-out, key-free, no-CUT recipe with the generic bake window and every requirement placed BEFORE the bake", () => {
    expect(baingan.ladderCredit).toBeUndefined();
    expect(baingan.lunchRush).toBe(false);
    expect(isCutEligible(BAINGAN)).toBe(false);
    expect(baingan.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(baingan.baseRewardPitz).toBe(100);
    expect(baingan.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(RECIPE_HINT_ROLES[BAINGAN]).toEqual({ keyFree: true });
    expect(baingan.nameJa).toBe("バインガンバルタピザ"); // the official name is kept (the UI shortens it where needed)
  });
  it("has the ordinary DOUGH / SAUCE / CHEESE / TOPPING steps (no FINISH) and is NOT a NO_SAUCE recipe: it paints curry-ketchup", () => {
    expect(getCookingProfile(BAINGAN)!.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect((noSauceRecipeIds() as readonly string[]).includes(BAINGAN)).toBe(false);
    expect(getRecipeSauceProfile(BAINGAN)).toEqual({ recipeId: BAINGAN, ingredientId: "curry-ketchup", interaction: "PAINT" });
  });
});

describe(REINA, () => {
  it("has the matrix ingredient set (チキン / アボカド / マヨネーズ / モッツァレラ / コリアンダー = cilantro) plus the fromage-blanc-sauce stand-in sauce, 8 non-sauce pieces; mayo is the existing topping", () => {
    expect(Object.fromEntries(reina.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual({ "fromage-blanc-sauce": 1, mozzarella: 2, chicken: 2, avocado: 1, mayo: 1, cilantro: 2 });
    expect(reina.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce").reduce((n, q) => n + q.minCount, 0)).toBe(8);
    expect(getIngredient("mayo")).toMatchObject({ category: "topping", placement: "scatter" });
    expect(idsOf(reina)).toEqual(["fromage-blanc-sauce", "mozzarella", "chicken", "avocado", "mayo", "cilantro"]);
  });
  it("is NOT ladder-credited (Owner decision), Lunch Rush opt-out, key-free, no CUT, generic bake window, every requirement BEFORE the bake", () => {
    expect(reina.ladderCredit).toBe(false);
    expect(reina.lunchRush).toBe(false);
    expect(isCutEligible(REINA)).toBe(false);
    expect(reina.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(reina.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(RECIPE_HINT_ROLES[REINA]).toEqual({ keyFree: true });
    expect(reina.nameJa).toBe("ベネズエラレイナペピアーダピザ");
  });
  it("paints fromage-blanc-sauce (not NO_SAUCE), DOUGH / SAUCE / CHEESE / TOPPING", () => {
    expect(getCookingProfile(REINA)!.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect((noSauceRecipeIds() as readonly string[]).includes(REINA)).toBe(false);
    expect(getRecipeSauceProfile(REINA)).toEqual({ recipeId: REINA, ingredientId: "fromage-blanc-sauce", interaction: "PAINT" });
  });
});

describe("References (scoring): 8 pieces on the RT-01 ring in requiredIngredients order; the cilantro lands LIGHT_LEAF like every bake-resistant leaf", () => {
  for (const [id, recipe] of [[BAINGAN, baingan], [REINA, reina]] as const) {
    it(`${id}: slots, order, counts`, () => {
      const ref = getReferencePizza(id)!;
      expect(ref.sauce).not.toBeNull();
      expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
      const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
      expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(pieces.map((q) => q.ingredientId));
      for (const [i, g] of ref.pieceGroups.entries()) expect(g.positions.length).toBe(pieces[i].minCount);
      expect(ref.pieceGroups.find((g) => g.ingredientId === "cilantro")!.interaction.landingStyle).toBe("LIGHT_LEAF");
    });
  }
});

describe("differentiation (the global 0.4 Jaccard guideline is NOT changed; the deviation is named)", () => {
  it("no other recipe (late catalog included) has either ingredient set, and none is a subset or a superset of it (the sauce is part of the set)", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    for (const mine of [baingan, reina]) {
      for (const other of RECIPES) {
        if (other.id === mine.id) continue;
        expect(key(idsOf(other)), `${mine.id} vs ${other.id}`).not.toBe(key(idsOf(mine)));
        const theirs = new Set(idsOf(other));
        const mineSet = new Set(idsOf(mine));
        expect([...theirs].every((i) => mineSet.has(i)) || idsOf(mine).every((i) => theirs.has(i)), `${mine.id} vs ${other.id}`).toBe(false);
      }
    }
  });
  it("Owner OD-B18-3 APPROVED exception only for baingan-bharta-pizza: 0.43 vs two curry recipes; global Jaccard 0.4 guideline and unique ingredient identity remain unchanged", () => {
    const over = (r: Recipe) => ORDINARY.filter((o) => o.id !== r.id && jaccard(idsOf(r), idsOf(o)) >= 0.4).map((o) => o.id).sort();
    expect(over(reina)).toEqual([]);
    expect(over(baingan)).toEqual(["curry-pizza-japan", "rendang-pizza"]);
    expect(jaccard(idsOf(baingan), idsOf(RECIPES.find((r) => r.id === "rendang-pizza")! as Recipe))).toBeCloseTo(3 / 7, 5);
  });
  it("the late BBQ chicken is a different pizza: it shares the cilantro, but sprinkles it AFTER the bake (the discovery identity's late axis), and neither new recipe is that pizza", () => {
    const bbq = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === BBQ)!;
    expect(bbq.identityDimensions.late).toEqual([["POST_BAKE", ["cilantro"]]]);
    for (const id of NEW_IDS) expect(RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === id)!.identityDimensions.late).toEqual([]);
  });
});

describe("ordinary step 69 and the late steps", () => {
  const steps = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
  it("steps 1-68 are frozen; step 69 is cilantro alone, no star gate, keyed to baingan-bharta-pizza (reina adds no step)", () => {
    expect(steps).toHaveLength(COMPOSED.ordinarySteps.length); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
    expect(steps[66]).toMatchObject({ step: 67, ingredientIds: ["umeboshi-paste"], keyRecipeId: "ume-shiso-pizza" });
    expect(steps[67]).toMatchObject({ step: 68, ingredientIds: ["sour-cream"], keyRecipeId: "goulash-pizza" });
    expect(steps[68]).toMatchObject({ step: 69, kind: "MATERIAL", ingredientIds: ["cilantro"], keyRecipeId: BAINGAN });
    expect(steps[68].starGates).toBeUndefined();
    expect(DISCOVERY_LADDER.steps.filter((s) => s.keyRecipeId === REINA)).toEqual([]);
  });
  it("every other ingredient of both recipes is owned before step 69 (cilantro is the last unlock)", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, 68).flatMap((s) => s.ingredientIds)]);
    for (const r of [baingan, reina]) for (const q of r.requiredIngredients) if (q.ingredientId !== "cilantro") expect(before.has(q.ingredientId), `${r.id}/${q.ingredientId}`).toBe(true);
    expect(before.has("cilantro")).toBe(false);
  });
  it("the late steps follow at 70-76 (derived; +1 again) and name no cilantro; the BBQ late step is bbq-sauce alone; the late floors are unchanged", () => {
    const late = DISCOVERY_LADDER.steps.slice(69);
    expect(late.map((s) => s.step)).toEqual(COMPOSED.steps.slice(69).map((s) => s.step)); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
    expect(late.some((s) => s.ingredientIds.includes("cilantro"))).toBe(false);
    expect(late.find((s) => s.keyRecipeId === BBQ)).toMatchObject({ step: COMPOSED.stepOfKey(BBQ), ingredientIds: ["bbq-sauce"] }); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
    expect(LATE_ENTITLEMENT_FLOORS).toEqual(COMPOSED.floors); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
  });
});

describe("the discovery targets compose the matrix rows' ingredients with the stand-in sauces (recipe-specific Owner decisions; the matrix rows are unchanged)", () => {
  const rows = (matrix as { rows: { evidenceId: string; productDecisionStatus: string; sauceBase: { status: string }; blockers: { type: string }[]; ingredients: { canonicalIngredientIds: string[] } }[] }).rows;
  it("both matrix rows are still BLOCKED_PRODUCT_DECISION (BASE_SAUCE_UNSPECIFIED): the shipped sauce is an Owner decision, not a source fact", () => {
    for (const id of ["baingan-bharta-pizza-pizzadb-p6", "venezuelan-reina-pepiada-pizzadb-p12"]) {
      const row = rows.find((r) => r.evidenceId === id)!;
      expect(row.productDecisionStatus, id).toBe("BLOCKED_PRODUCT_DECISION");
      expect(row.sauceBase.status, id).toBe("unspecified");
      expect(row.blockers.map((b) => b.type), id).toEqual(["BASE_SAUCE_UNSPECIFIED"]);
    }
    expect([...rows.find((r) => r.evidenceId === "baingan-bharta-pizza-pizzadb-p6")!.ingredients.canonicalIngredientIds].sort()).toEqual(["cilantro", "eggplant", "fresh-tomato", "mozzarella", "onion"]);
    expect([...rows.find((r) => r.evidenceId === "venezuelan-reina-pepiada-pizzadb-p12")!.ingredients.canonicalIngredientIds].sort()).toEqual(["avocado", "chicken", "cilantro", "mayo", "mozzarella"]);
  });
  it("the runtime targets carry the matrix ids and the stand-in sauce bases", () => {
    const b = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === BAINGAN)!;
    const r = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === REINA)!;
    expect(b.targetId).toBe("baingan-bharta-pizza-pizzadb-p6");
    expect(r.targetId).toBe("venezuelan-reina-pepiada-pizzadb-p12");
    expect([...(b.sauceBase ?? [])]).toEqual(["curry-ketchup"]);
    expect([...(r.sauceBase ?? [])]).toEqual(["fromage-blanc-sauce"]);
  });
  it("the Owner decisions are not generalised: other unspecified-sauce rows are not shipped (caponata, tsukimi, nashville-hot-chicken, nduja)", () => {
    const shipped = new Set(RECIPES.map((r) => r.id as string));
    for (const held of ["caponata-pizza", "tsukimi-pizza", "nashville-hot-chicken-pizza", "nduja-pizza"]) expect(shipped.has(held), held).toBe(false);
  });
});

/** A pizza that physically recreates a recipe's Reference (its stand-in sauce, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(id: string, sauce: string, bakeResult = 66): PizzaState {
  const reference = getReferencePizza(id as never)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [sauce],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${id}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe.each([
  [BAINGAN, baingan, "curry-ketchup", "tomato-sauce"],
  [REINA, reina, "fromage-blanc-sauce", "sour-cream"],
] as const)("%s: Free Cooking / Research round (Completion Gate, discovery)", (id, recipe, sauce, wrongSauce) => {
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(recipe, referenceLikePizza(id, sauce))).toEqual({ status: "PASS" });
  });
  it("cooked with exactly its ingredients and its sauce it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
    const sig = signatureOfPizza(referenceLikePizza(id, sauce));
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: id } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    const dex = registerScoreToDex(EMPTY_DEX, id, { total: 70, stars: 3, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 }).dex;
    expect(discoveredRecipeIds(dex)).toEqual([id]);
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [id])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });
  it("resolveFreeCookPizza discovers it", () => {
    const r = resolveFreeCookPizza(referenceLikePizza(id, sauce), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
  });
  it("no sauce, another sauce, a missing cilantro, or the cilantro placed AFTER the bake makes it an ORIGINAL pizza (the exact set and the moment decide)", () => {
    const base = referenceLikePizza(id, sauce);
    const variants: Record<string, PizzaState> = {
      "no sauce": { ...base, sauceIds: [] } as PizzaState,
      "another sauce": { ...base, sauceIds: [wrongSauce] } as PizzaState,
      "no cilantro": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "cilantro") } as PizzaState,
      "cilantro AFTER the bake": { ...base, toppings: base.toppings.map((t) => (t.ingredientId === "cilantro" ? { ...t, stage: "post" as const } : t)) } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });
  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(id, sauce, 30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(id, sauce, 95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("Research: cilantro now unlocks a NEW lettered cohort of two; no pre-existing recipe changes its letter in the CANONICAL ladder order", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));

  it("baingan / reina share the cilantro cohort (letters A and B) from the moment cilantro is owned, and are unregistered before", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const now = researchCohortLetters(owned, ORDINARY);
    expect([now.get(BAINGAN), now.get(REINA)].sort()).toEqual(["A", "B"]);
    const noCilantro = researchCohortLetters(owned.filter((m) => m !== "cilantro"), ORDINARY);
    expect(noCilantro.has(BAINGAN) || noCilantro.has(REINA)).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "cilantro", cohortLetter: "A" })).toBe("？？？ピザ A（パクチー）");
  });

  it("at EVERY ladder prefix no pre-existing recipe changes its letter (no acceptedLetterShifts): ordinary catalog and full catalog (late recipes included)", () => {
    const withoutNewAll = RECIPES.filter((r) => !NEW_IDS.includes(r.id));
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      const now = researchCohortLetters(owned, ORDINARY);
      expect([...now].filter(([id]) => !NEW_IDS.includes(id)).sort(), `ordinary prefix ${n}`).toEqual([...researchCohortLetters(owned, withoutNew)].sort());
      const nowAll = researchCohortLetters(owned, RECIPES);
      expect([...nowAll].filter(([id]) => !NEW_IDS.includes(id)).sort(), `full prefix ${n}`).toEqual([...researchCohortLetters(owned, withoutNewAll)].sort());
    }
  });

  it("random purchase orders: a letter, once given, never changes", () => {
    let s = 20261104;
    const random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let o = 0; o < 40; o += 1) {
      const perm = [...ladderMaterials];
      for (let i = perm.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      const seen = new Map<string, string>();
      for (let n = 0; n <= perm.length; n += 1) {
        for (const [id, letter] of researchCohortLetters([...STARTER_INGREDIENT_IDS, ...perm.slice(0, n)], ORDINARY)) {
          const prev = seen.get(id);
          if (prev !== undefined) expect(letter, `${id} order ${o} prefix ${n}`).toBe(prev);
          seen.set(id, letter);
        }
      }
    }
  });

  it("BBQ chicken, canonical LADDER order (cilantro 69 before bbq-sauce 74): still a single-member cohort (no letter); only its anonymous label text moves from パクチー to バーベキューソース (derived, never stored)", () => {
    const labelOf = (owned: readonly string[]) => researchEntryLabel(deriveResearchEntries({ dex: [], ownedIngredientIds: owned } as never).entries.find((e) => (e.recipeId as string) === BBQ)!);
    const allLadder = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds);
    expect(researchCohortLetters([...STARTER_INGREDIENT_IDS, ...allLadder], RECIPES).has(BBQ)).toBe(false);
    expect(labelOf([...STARTER_INGREDIENT_IDS, ...allLadder])).toBe("？？？ピザ（バーベキューソース）");
  });

  it("Owner OD-B18-1 APPROVED order-specific shift (not canonical acceptedLetterShifts): bbq-sauce THEN cilantro grants BBQ letter B; in THIS one order every other pre-existing letter stays unchanged (other orders: see the audit below)", () => {
    expect(B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS).toEqual({ [BBQ]: "-->B" });
    const allLadder = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds);
    const floorOrder = [...STARTER_INGREDIENT_IDS, ...allLadder.filter((m) => m !== "cilantro" && m !== "bbq-sauce"), "bbq-sauce", "cilantro"];
    const now = researchCohortLetters(floorOrder, RECIPES);
    const before = researchCohortLetters(floorOrder, RECIPES.filter((r) => !NEW_IDS.includes(r.id)));
    expect(before.has(BBQ)).toBe(false); // before Batch 18 the cilantro cohort was the BBQ chicken alone: no letter
    const observedShift = `${before.get(BBQ) ?? "-"}->${now.get(BBQ) ?? "-"}`;
    expect(observedShift).toBe(B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS[BBQ]);
    expect([now.get(REINA), now.get(BBQ), now.get(BAINGAN)]).toEqual(["A", "B", "C"]);
    expect([...now].filter(([id]) => id !== BBQ && !NEW_IDS.includes(id)).sort()).toEqual([...before].sort());
    const entry = deriveResearchEntries({ dex: [], ownedIngredientIds: floorOrder } as never).entries.find((e) => (e.recipeId as string) === BBQ)!;
    expect(researchEntryLabel(entry)).toBe("？？？ピザ B（パクチー）"); // was 「？？？ピザ（パクチー）」
  });
});

describe("Research labels BEFORE vs AFTER Batch 18 across acquisition orders (Codex P2, PR #759): the exact Owner-approved audited scope (OD-B18-4)", () => {
  // Expansion Batch 19 (#774) is a LATER batch: its recipes are left out so this audit stays the Batch 18 before/after comparison (the Batch 19 audit is in expansionBatch19.test.ts).
  const changes = researchLetterChangesAcrossOrders(NEW_IDS, WITHOUT_B21.filter((r) => r.id !== "pesto-burrata-pizza" && r.id !== "pizza-alla-crudaiola" && r.id !== "pesto-noci-pizza"), 40, 20261105, B22_MATERIALS_LATER);
  const changed = [...changes.keys()].sort();

  it("the canonical ladder order changes no pre-existing letter (the full late catalog included)", () => {
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
  });

  it("in non-canonical orders exactly the pinned 39 pre-existing recipes can change their letter; Owner OD-B18-1 (the BBQ -->B in the bbq-sauce -> cilantro order) and OD-B18-4 (this exact audited set) approve them as derived display changes; the set may not grow", () => {
    expect(changed).toEqual([...B18_APPROVED_AUDITED_ALTERNATE_ORDER_LETTER_CHANGES].sort());
    expect(changes.get(BBQ)!.map((c) => c.change)).toContain(B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS[BBQ]);
    expect(changed.filter((id) => changes.get(id)!.some((c) => c.change.startsWith("-->")))).toHaveLength(24); // 24 of them can GAIN a letter where they had none
  });

  it("reproduces the two Codex examples: every ladder material owned, mayo last -> potato-mayo-pizza gains B; avocado last -> california-style-pizza gains B", () => {
    const allLadder = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
    const last = (m: string) => [...STARTER_INGREDIENT_IDS, ...allLadder.filter((x) => x !== m), m];
    const without = WITHOUT_B21.filter((r) => !NEW_IDS.includes(r.id));
    for (const [m, id] of [["mayo", "potato-mayo-pizza"], ["avocado", "california-style-pizza"]] as const) {
      expect(researchCohortLetters(last(m), without).get(id), `${id} before`).toBeUndefined();
      expect(researchCohortLetters(last(m), WITHOUT_B21).get(id), `${id} after`).toBe("B");
    }
  });

});
