import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { LATE_ENTITLEMENT_FLOORS } from "./lateCatalog";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { RECIPE_HINTS } from "./hints";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { toppingSizeClass } from "./toppingSizeClass";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B20A_BATCH, RECIPE_BATCHES } from "../logic/catalog/testSupport/recipeBatchManifest";
import { ordinaryCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
import { researchLetterChangesAcrossOrders } from "../logic/catalog/testSupport/researchLabelAudit";
import { MULTI_SAUCE_RECIPE_IDS, requiredSauceIds } from "../logic/testSupport/requiredSauces";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { buildHint5Ladder, hint5Presentation, HINT5_RUNG_MARKER, HINT5_RUNG_PRICE } from "../logic/discovery/hint5Ladder";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { EMPTY_DEX } from "../state/dex";

/**
 * Expansion Batch 20-A (Issue #790): `honey` (はちみつ, a sauce, the SECOND sauce layer) + `walnut` (くるみ, a `spice`-family topping, dedicated art = the #777 component) at ordinary step 71, and the one recipe `pesto-noci-pizza` (credited, the step's key). PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed;
 * the only evidence is the 172 matrix row `pesto-noci-pizzadb-p12`. Counts / the generic 58-78 bake window / colours are GAMEPLAY ASSUMPTIONS. Owner decisions 2026-11-08: mozzarella is NOT added; honey is a pre-bake second sauce layer (provisional); walnut is `spice` (provisional);
 * the 10 non-canonical Research letter changes of docs/reports/TETO_B20A_OWNER-DECISION-TABLE_2026-11-08.md are approved and the canonical order must change 0 letters (a mismatch is a STOP).
 */
const PN = "pesto-noci-pizza";
const pn = RECIPES.find((r) => r.id === PN)! as Recipe;
const NEW_IDS: readonly string[] = [PN];
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;

describe("honey and walnut (Owner 2026-11-08)", () => {
  const honey = getIngredient("honey")!;
  const walnut = getIngredient("walnut")!;
  it("honey is a finite spread SAUCE named はちみつ with no dedicated art and no topping family; walnut is a finite scatter TOPPING named くるみ with the walnut-kernel art, size class s, family spice", () => {
    expect(honey).toMatchObject({ id: "honey", category: "sauce", nameJa: "はちみつ", placement: "spread", color: "#e8a93a" });
    expect(honey.pieceVisual).toBeUndefined();
    expect(honey.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ingredientAttributeFamily("honey")).toBeNull();
    expect(walnut).toMatchObject({ id: "walnut", category: "topping", nameJa: "くるみ", placement: "scatter", pieceVisual: "walnut-kernel" });
    expect(walnut.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(toppingSizeClass("walnut")).toBe("s");
    expect(ingredientAttributeFamily("walnut")).toBe("spice");
  });
  it("each is exactly one new ingredient id, and their text fallbacks are unique in the catalog (G18)", () => {
    for (const id of ["honey", "walnut"]) expect(INGREDIENTS.filter((i) => i.id === id)).toHaveLength(1);
    for (const ing of [honey, walnut]) expect(INGREDIENTS.filter((i) => i.emoji === ing.emoji).map((i) => i.id), ing.id).toEqual([ing.id]);
  });
  it("their Shop offers are T4 from ordinary step 71: k follows the recipe's count (honey 1 -> pack 10, walnut 3 -> pack 30), pack 120 / refill 60", () => {
    expect(materialOffer(honey)).toMatchObject({ ingredientId: "honey", step: 71, tier: "T4", k: 1, packQuantity: 10, packPrice: 120, refillPrice: 60 });
    expect(materialOffer(walnut)).toMatchObject({ ingredientId: "walnut", step: 71, tier: "T4", k: 3, packQuantity: 30, packPrice: 120, refillPrice: 60 });
  });
});

describe(PN, () => {
  const set = ["pesto", "honey", "gorgonzola", "walnut"];
  it("has the matrix ingredient set (no substitution, NO mozzarella), in order: primary sauce, second sauce, cheese, topping (Rule W = legacy H4)", () => {
    expect(pn.requiredIngredients.map((q) => q.ingredientId)).toEqual(set);
    expect(pn.requiredIngredients.map((q) => q.minCount)).toEqual([1, 1, 2, 3]);
    expect(idsOf(pn)).not.toContain("mozzarella");
  });
  it("credit / Lunch Rush / CUT / Hint declarations, the generic bake window, and every requirement placed BEFORE the bake", () => {
    expect((pn as { ladderCredit?: boolean }).ladderCredit !== false).toBe(true);
    expect(pn.lunchRush).toBe(false);
    expect(isCutEligible(PN as never)).toBe(false);
    expect(RECIPE_HINT_ROLES[PN as never]).toEqual({ keyFree: true });
    expect(pn.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(pn.baseRewardPitz).toBe(100);
    expect(pn.requiredIngredients.some((q) => (q as { applicationPhase?: string }).applicationPhase === "POST_BAKE")).toBe(false);
    expect(getCookingProfile(PN as never).steps).not.toContain("FINISH");
  });
  it("is NOT a NO_SAUCE recipe: pesto is painted (the Reference target), honey is the second layer scored by presence and has no profile entry", () => {
    expect(noSauceRecipeIds()).not.toContain(PN);
    expect(getRecipeSauceProfile(PN as never)).toEqual({ recipeId: PN, ingredientId: "pesto", interaction: "PAINT" });
    expect(MULTI_SAUCE_RECIPE_IDS).toContain(PN);
    expect(requiredSauceIds(PN)).toEqual(["pesto", "honey"]);
  });
  it("the description names no moment, no quantity (Anti-Oracle); its two-sauce hint set asks for honey and names no recipe", () => {
    expect(pn.description).not.toMatch(/焼く前|焼いた後|後乗せ|[0-9０-９]/);
    expect(RECIPE_HINTS[PN]!.missing.honey).toBeTruthy();
    expect(JSON.stringify(RECIPE_HINTS[PN])).not.toMatch(/ノーチ|ペスト|ゴルゴンゾーラ|くるみ/);
  });
});

describe("Reference (scoring): the first slots of the RT-01 ring in requiredIngredients order", () => {
  it("slots, order, counts (gorgonzola 2 + walnut 3 = 5 non-sauce pieces)", () => {
    const ref = getReferencePizza(PN)!;
    const pieces = pn.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    const total = pieces.reduce((n, q) => n + q.minCount, 0);
    expect(total).toBe(5);
    expect(ref.sauce).not.toBeNull();
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(total).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(pieces.map((q) => q.ingredientId));
    for (const [i, g] of ref.pieceGroups.entries()) expect(g.positions.length).toBe(pieces[i].minCount);
  });
});

describe("Duplicate Gate and differentiation (the GLOBAL 0.4 Jaccard guideline is NOT changed; NO exception is needed)", () => {
  const all = [...RECIPES] as readonly Recipe[];
  it("no other recipe (late catalog included) has the set, none is a subset or a superset, and none differs by one ingredient", () => {
    const mine = idsOf(pn);
    for (const other of all) {
      if (other.id === PN) continue;
      const theirs = idsOf(other);
      expect(symDiff(mine, theirs), `${PN} vs ${other.id} symmetric difference`).toBeGreaterThan(1);
      expect(mine.every((x) => theirs.includes(x)) || theirs.every((x) => mine.includes(x)), `${PN} vs ${other.id} subset / superset`).toBe(false);
    }
  });
  it("stays well under the 0.4 guideline against every recipe (0.167 at most, the nearest being genovese)", () => {
    const worst = all.filter((o) => o.id !== PN).map((o) => [jaccard(idsOf(pn), idsOf(o)), o.id] as const).sort((a, b) => b[0] - a[0])[0];
    expect(worst[1]).toBe("genovese");
    expect(worst[0]).toBeCloseTo(1 / 6, 3);
  });
});

describe("ordinary step 71 and the late steps", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("steps 1-70 are frozen; step 71 is honey + walnut, no star gate, keyed to pesto-noci-pizza", () => {
    const step = steps.find((s) => s.step === 71)!;
    expect(step).toMatchObject({ step: 71, ingredientIds: ["honey", "walnut"], keyRecipeId: PN });
    expect((step as { starGates?: unknown }).starGates).toBeUndefined();
    expect(ordinaryLadderSteps(steps).at(-4)).toBe(step);
    expect(steps.find((s) => s.step === 70)).toMatchObject({ ingredientIds: ["burrata"], keyRecipeId: "pesto-burrata-pizza" });
  });
  it("every other ingredient of the recipe is owned before step 71 (honey and walnut are the last unlocks)", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, 70).flatMap((s) => s.ingredientIds)]);
    for (const q of pn.requiredIngredients) if (!["honey", "walnut"].includes(q.ingredientId)) expect(before.has(q.ingredientId), q.ingredientId).toBe(true);
    expect(before.has("honey") || before.has("walnut")).toBe(false);
  });
  it("the late steps follow at 72-78 (derived; +1 again) and the late floors are unchanged", () => {
    const late = steps.slice(74); // Expansion Batch 23 (#780): the ordinary step 74 moved the derived late numbers +1 again; Expansion Batch 22 (#780): the ordinary steps 72 / 73 moved the derived late numbers +2 (74-82) and four late steps (83-86) follow
    expect(late.map((s) => s.step)).toEqual([75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87]);
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68, "cheddar": 79, "lettuce": 79, "tortilla-chips": 79, "okonomiyaki-sauce": 80, "cabbage": 80, "bonito-flakes": 80, fennel: 83, orange: 83, carrot: 84, "red-cabbage": 84, "sunflower-seeds": 84, radicchio: 85, "balsamic-vinegar": 85, truffle: 86 });
  });
  it("the batch manifest is LANDED and consistent: appended tail, append-only ladder, chapter / cohort identity, explicit declarations", () => {
    expect(RECIPE_BATCHES).toContain(B20A_BATCH);
    expect(B20A_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([[PN, "walnut", true]]);
    expect(B20A_BATCH.acceptedLetterShifts).toBeUndefined();
    expect(validateBatchManifest(B20A_BATCH, ordinaryCatalogView())).toEqual([]);
  });
});

/** A pizza that physically recreates the Reference (both sauces, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(sauces: readonly string[], bakeResult = 66): PizzaState {
  const reference = getReferencePizza(PN as never)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [...sauces],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${PN}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe(`${PN}: Free Cooking / Research round (Completion Gate and discovery with two sauces)`, () => {
  const sauces = ["pesto", "honey"];
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(pn, referenceLikePizza(sauces))).toEqual({ status: "PASS" });
  });
  it("cooked with exactly its ingredients and BOTH sauces it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
    const sig = signatureOfPizza(referenceLikePizza(sauces));
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: PN } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: PN });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [PN])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });
  it("resolveFreeCookPizza discovers it", () => {
    const r = resolveFreeCookPizza(referenceLikePizza(sauces), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: PN });
  });
  it("the primary sauce only, honey only, another primary sauce, a missing walnut or an added mozzarella makes it an ORIGINAL pizza (the exact set decides)", () => {
    const base = referenceLikePizza(sauces);
    const variants: Record<string, PizzaState> = {
      "pesto only": { ...base, sauceIds: ["pesto"] } as PizzaState,
      "honey only": { ...base, sauceIds: ["honey"] } as PizzaState,
      "the other primary sauce": { ...base, sauceIds: ["tomato-sauce", "honey"] } as PizzaState,
      "no walnut": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "walnut") } as PizzaState,
      "with mozzarella": { ...base, toppings: [...base.toppings, { id: "m", ingredientId: "mozzarella", x: 50, y: 52 }] } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });
  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(sauces, 30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(sauces, 95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("Research: honey + walnut unlock ONE recipe (a single-member cohort, no letter); no pre-existing recipe changes its letter in the CANONICAL ladder order", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const ORDINARY = ordinaryRecipes(RECIPES);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));
  it("the recipe is a single-member cohort (no letter) and is unregistered before step 71; the label names only the unlock ingredient", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    expect(researchCohortLetters(owned, ORDINARY).has(PN)).toBe(false);
    expect(researchCohortLetters(owned.filter((m) => m !== "walnut" && m !== "honey"), ORDINARY).has(PN)).toBe(false);
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
});

/**
 * OWNER APPROVAL (2026-11-08, Issue #790; docs/reports/TETO_B20A_OWNER-DECISION-TABLE_2026-11-08.md B20A-LD-01 ... 10): in NON-canonical acquisition orders exactly these 10 pre-existing recipes can change their letter, with exactly these letter changes (measured on main 4ba0559).
 * The approval does NOT cover any additional recipe, a different change, an unexpected label loss or a non-letter change: if the audit ever yields a different set or different changes, STOP and ask the Owner again. The canonical-order 0-change invariant is asserted separately and must stay.
 */
const B20A_APPROVED: Readonly<Record<string, readonly string[]>> = {
  "pesto-caprese": ["-->A"],
  "pesto-tonno": ["-->A"],
  "pesto-vegetariana": ["-->A"],
  "quattro-formaggi": ["-->A"],
  genovese: ["-->B", "A->B", "B->C", "C->D", "E->F", "G->H"],
  "pesto-patate": ["-->B", "B->C", "D->E", "E->F", "G->H", "H->I", "I->J"],
  "pesto-salmone": ["-->B", "B->C", "C->D", "D->E", "F->G", "H->I"],
  "pesto-pollo": ["B->C", "C->D", "D->E", "F->G"],
  "pesto-trapanese": ["B->C", "C->D", "D->E", "E->F"],
  "pesto-burrata-pizza": ["B->C", "C->D", "G->H", "I->J", "J->K"],
};
describe("Research labels BEFORE vs AFTER Batch 20-A across acquisition orders: the exact audited scope, Owner-approved (10 IDs)", () => {
  const changes = researchLetterChangesAcrossOrders(NEW_IDS, (RECIPES as readonly Recipe[]).filter((r) => r.id !== "taco-pizza" && r.id !== "okonomiyaki-style-pizza" && !["speck-e-brie", "buffalo-chicken", "pizza-finocchi-salad", "pizza-cavolo-carote", "pizza-radicchio-noci", "black-truffle-pizza", "apple-cinnamon-dessert"].includes(r.id)), 40, 20261105, ["cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes", ...["brie", "buffalo-sauce", "fennel", "orange", "carrot", "red-cabbage", "sunflower-seeds", "radicchio", "truffle", "balsamic-vinegar", "apple"]]); // Expansion Batch 22 (#780) is a LATER batch too (its six recipes and ten materials are left out). Expansion Batch 21 (#780) is a LATER batch: its two recipes and its six materials are left out (the audit's seeded random orders then stay the ones this was approved against) so this stays the Batch 20-A before/after comparison (the Batch 21 audit is in expansionBatch21.test.ts)
  it("the canonical ladder order changes no pre-existing letter (the full late catalog included)", () => {
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
  });
  it("in non-canonical orders exactly the 10 Owner-approved pre-existing recipes can change their letter, and no other (an unlisted id is a STOP for a new Owner decision)", () => {
    expect([...changes.keys()].sort()).toEqual(Object.keys(B20A_APPROVED).sort());
    expect(Object.keys(B20A_APPROVED)).toHaveLength(10);
  });
  it("each recipe shows exactly its approved letter changes (a different change is a STOP), all of them letter changes", () => {
    for (const [id, list] of changes) {
      expect([...new Set(list.map((c) => c.change))].sort(), id).toEqual([...B20A_APPROVED[id]].sort());
      for (const c of list) expect(c.change, id).toMatch(/^(-|[A-Z]+)->(-|[A-Z]+)$/);
    }
  });
});

describe("AC-3: the paid Hint 5.0 SAUCE rung (10 Pitz) tells pesto-noci-pizza apart from the other pesto recipes", () => {
  const view = (id: string, completed: string[]) => hint5Presentation({ recipeId: id, discoveredCount: 5, storedFactIds: completed, legacyPurchases: [], pitzBalance: 100 })!;
  it("it is a key-free ladder whose first rungs are SAUCE then CHEESE, each priced 10 Pitz", () => {
    expect(buildHint5Ladder(PN)!.rungs.slice(0, 2).map((r) => r.kind)).toEqual(["SAUCE", "CHEESE"]);
    expect(HINT5_RUNG_PRICE.SAUCE).toBe(10);
    expect(view(PN, []).next).toMatchObject({ kind: "SAUCE", price: 10, affordable: true });
  });
  it("the SAUCE rung alone is enough: it shows {pesto, honey}, a set no other recipe has (honey is in no other recipe)", () => {
    const sauceOf = (id: string) => (view(id, [HINT5_RUNG_MARKER.SAUCE]).board.find((e) => e.kind === "SAUCE") as unknown as { ingredientIds: string[] }).ingredientIds;
    expect([...sauceOf(PN)].sort()).toEqual(["honey", "pesto"]);
    expect(RECIPES.filter((r) => r.id !== PN && r.requiredIngredients.some((q) => (q.ingredientId as string) === "honey"))).toEqual([]);
  });
  it("no rung line names a recipe (Anti-Oracle): the board holds ingredient ids and structure only", () => {
    const board = view(PN, [HINT5_RUNG_MARKER.SAUCE, HINT5_RUNG_MARKER.CHEESE, HINT5_RUNG_MARKER.STRUCTURE]).board;
    expect(JSON.stringify(board)).not.toMatch(/pesto-noci|ペスト・ノーチ/);
  });
});
