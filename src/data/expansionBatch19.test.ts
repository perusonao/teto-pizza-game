import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { pinsaEnabled } from "./pinsaGate";
import { LATE_ENTITLEMENT_FLOORS, LATE_RECIPES } from "./lateCatalog";
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
import { B19_BATCH, RECIPE_BATCHES } from "../logic/catalog/testSupport/recipeBatchManifest";
import { ordinaryCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
import { researchLetterChangesAcrossOrders } from "../logic/catalog/testSupport/researchLabelAudit";
import { MULTI_SAUCE_RECIPE_IDS } from "../logic/testSupport/requiredSauces";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { researchCohortLetters, researchEntryLabel } from "../logic/discovery/researchEntry";
import { buildHint5Ladder, hint5Presentation, HINT5_RUNG_MARKER, HINT5_RUNG_PRICE } from "../logic/discovery/hint5Ladder";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { EMPTY_DEX } from "../state/dex";

/**
 * Expansion Batch 19 (Issue #774): `burrata` (ブッラータ, a cheese, ordinary step 70) + pesto-burrata-pizza (credited, the step's key) + pizza-alla-crudaiola (NOT credited). PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed; the only evidence is the 172 matrix rows
 * `pesto-burrata-pizzadb-p12` and `pizza-alla-crudaiola-pizzadb-p8`. Counts / the generic 58-78 bake window / colours are GAMEPLAY ASSUMPTIONS. Both recipes have TWO sauce layers (the primary sauce is the Reference target, olive-oil is scored by presence, as grandma-pizza), every piece is placed
 * BEFORE the bake, no new technique and no FINISH / prep / sear / steam step. Owner decisions: Prep Rev 5 D1-D9, Q1-Q4, P1, P2 (docs/reports/TETO_EXPANSION-BATCH-19_Prep.md).
 */
const PB = "pesto-burrata-pizza";
const CR = "pizza-alla-crudaiola";
const pb = RECIPES.find((r) => r.id === PB)! as Recipe;
const cr = RECIPES.find((r) => r.id === CR)! as Recipe;
const NEW_IDS: readonly string[] = [PB, CR];
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;

describe("burrata (Owner D1, R2 D5: candidate C)", () => {
  const ing = getIngredient("burrata")!;
  it("is a finite scatter CHEESE named ブッラータ with the torn-ball art, size class l, no family row", () => {
    expect(ing).toMatchObject({ id: "burrata", category: "cheese", nameJa: "ブッラータ", pieceVisual: "burrata-torn-ball", placement: "scatter" });
    expect(ing.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(toppingSizeClass("burrata")).toBe("l");
    expect(ingredientAttributeFamily("burrata")).toBeNull();
  });
  it("is exactly one new ingredient id; the cheese emoji convention is kept (a text fallback only)", () => {
    expect(INGREDIENTS.filter((i) => i.id === "burrata")).toHaveLength(1);
    expect(ing.emoji).toBe(getIngredient("ricotta")!.emoji);
  });
  it("its Shop offer is T4 / k = 2 (stock 20, pack 120 / refill 60) from ordinary step 70", () => {
    expect(materialOffer(ing)).toMatchObject({ ingredientId: "burrata", step: 70, tier: "T4", k: 2, packQuantity: 20, packPrice: 120, refillPrice: 60 });
  });
});

describe.each([
  [PB, pb, ["pesto", "olive-oil", "burrata", "fresh-tomato"], true],
  [CR, cr, ["tomato-sauce", "olive-oil", "mozzarella", "burrata", "fresh-tomato", "arugula"], false],
] as const)("%s", (id, recipe, set, credited) => {
  it("has the matrix ingredient set (no substitution), in order: primary sauce, second sauce, cheese, topping (Rule W = legacy H4)", () => {
    expect(recipe.requiredIngredients.map((q) => q.ingredientId)).toEqual(set);
    expect(recipe.requiredIngredients.every((q) => q.minCount >= 1)).toBe(true);
  });
  it("credit / Lunch Rush / CUT / Hint declarations, the generic bake window, and every requirement placed BEFORE the bake", () => {
    expect((recipe as { ladderCredit?: boolean }).ladderCredit !== false).toBe(credited);
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(id as never)).toBe(false);
    expect(RECIPE_HINT_ROLES[id as never]).toEqual({ keyFree: true });
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.some((q) => (q as { applicationPhase?: string }).applicationPhase === "POST_BAKE")).toBe(false);
    expect(getCookingProfile(id as never).steps).not.toContain("FINISH");
  });
  it("is NOT a NO_SAUCE recipe: the primary sauce is painted (the Reference target), olive-oil is scored by presence and has no profile entry", () => {
    expect(noSauceRecipeIds()).not.toContain(id);
    expect(getRecipeSauceProfile(id as never)).toEqual({ recipeId: id, ingredientId: set[0], interaction: "PAINT" });
    expect(MULTI_SAUCE_RECIPE_IDS).toContain(id);
  });
  it("the description names no moment, no ingredient quantity and neither recipe's key (Anti-Oracle)", () => {
    expect(recipe.description).not.toMatch(/焼く前|焼いた後|後乗せ|[0-9０-９]/);
  });
  it("its two-sauce hint set asks for the second sauce (olive-oil) and names no recipe", () => {
    expect(RECIPE_HINTS[id]!.missing["olive-oil"]).toBeTruthy();
    expect(JSON.stringify(RECIPE_HINTS[id])).not.toMatch(/ブッラータ|ペスト|クルダイオーラ/);
  });
});

describe("References (scoring): the first slots of the RT-01 ring in requiredIngredients order", () => {
  for (const [id, recipe] of [[PB, pb], [CR, cr]] as const) {
    it(`${id}: slots, order, counts`, () => {
      const ref = getReferencePizza(id)!;
      const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
      const total = pieces.reduce((n, q) => n + q.minCount, 0);
      expect(ref.sauce).not.toBeNull();
      expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(total).map(({ x, y }) => ({ x, y })));
      expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(pieces.map((q) => q.ingredientId));
      for (const [i, g] of ref.pieceGroups.entries()) expect(g.positions.length).toBe(pieces[i].minCount);
    });
  }
  it("crudaiola's non-sauce pieces are exactly the 8-slot ring (4 groups of 2)", () => {
    expect(cr.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce").reduce((n, q) => n + q.minCount, 0)).toBe(8);
  });
});

describe("Duplicate Gate and differentiation (the GLOBAL 0.4 Jaccard guideline is NOT changed; the one deviation is named)", () => {
  const all = [...RECIPES] as readonly Recipe[];
  it("no other recipe (late catalog included) has either ingredient set, none is a subset or a superset, and none differs by one ingredient", () => {
    for (const r of [pb, cr]) {
      const mine = idsOf(r);
      for (const other of all) {
        if (other.id === r.id) continue;
        const theirs = idsOf(other);
        expect(symDiff(mine, theirs), `${r.id} vs ${other.id} symmetric difference`).toBeGreaterThan(1);
        expect(mine.every((x) => theirs.includes(x)) || theirs.every((x) => mine.includes(x)), `${r.id} vs ${other.id} subset / superset`).toBe(false);
      }
    }
  });
  it("pesto-burrata-pizza stays under the 0.4 guideline against every recipe except the batch-mate (0.333 at most); the batch-mate is the one 0.429 pair", () => {
    const worst = Math.max(...all.filter((o) => o.id !== PB && o.id !== CR).map((o) => jaccard(idsOf(pb), idsOf(o))));
    expect(worst).toBeCloseTo(1 / 3, 3);
  });
  it("OD-B19-2 (conditional, THIS recipe only; C1-C5): pizza-alla-crudaiola has exactly four named 0.429 neighbours with symmetric difference 4 and no fifth above 0.4", () => {
    const named = ["jamon-serrano-pizza", "grandma-pizza", PB, "pinsa-romana"].filter((id) => all.some((r) => r.id === id));
    const above = all.filter((o) => o.id !== CR && jaccard(idsOf(cr), idsOf(o)) > 0.4).map((o) => o.id);
    expect(above.sort()).toEqual([...named].sort());
    for (const id of named) {
      const other = all.find((r) => r.id === id)!;
      expect(jaccard(idsOf(cr), idsOf(other)), id).toBeCloseTo(3 / 7, 3);
      expect(symDiff(idsOf(cr), idsOf(other)), id).toBe(4);
    }
    // C5: the set is the matrix row's, with no substitution to lower the Jaccard.
    expect(idsOf(cr).sort()).toEqual(["arugula", "burrata", "fresh-tomato", "mozzarella", "olive-oil", "tomato-sauce"]);
  });
});

describe("ordinary step 70 and the late steps", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("steps 1-69 are frozen; step 70 is burrata alone, no star gate, keyed to pesto-burrata-pizza (crudaiola adds no step)", () => {
    const step = steps.find((s) => s.step === 70)!;
    expect(step).toMatchObject({ step: 70, ingredientIds: ["burrata"], keyRecipeId: PB });
    expect((step as { starGates?: unknown }).starGates).toBeUndefined();
    expect(steps.filter((s) => s.keyRecipeId === CR)).toEqual([]);
    expect(ordinaryLadderSteps(steps).at(-2)).toBe(step); // (Expansion Batch 20-A, #790, appended the ordinary step 71 after it)
  });
  it("every other ingredient of both recipes is owned before step 70 (burrata is the last unlock)", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, 69).flatMap((s) => s.ingredientIds)]);
    for (const r of [pb, cr]) for (const q of r.requiredIngredients) if (q.ingredientId !== "burrata") expect(before.has(q.ingredientId), `${r.id}/${q.ingredientId}`).toBe(true);
    expect(before.has("burrata")).toBe(false);
  });
  it("the late steps follow at 72-78 (derived; +1 again by Expansion Batch 20-A's ordinary step 71) and the late floors are unchanged", () => {
    const late = steps.slice(71);
    expect(late.map((s) => s.step)).toEqual([72, 73, 74, 75, 76, 77, 78, 79, 80]);
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68, "cheddar": 79, "lettuce": 79, "tortilla-chips": 79, "okonomiyaki-sauce": 80, "cabbage": 80, "bonito-flakes": 80 });
    expect(LATE_RECIPES.length).toBeGreaterThan(0);
  });
  it("the batch manifest is LANDED and consistent: appended tail, append-only ladder, chapter / cohort identity, explicit declarations", () => {
    expect(RECIPE_BATCHES).toContain(B19_BATCH);
    expect(B19_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([[PB, "burrata", true], [CR, "burrata", false]]);
    expect(B19_BATCH.acceptedLetterShifts).toBeUndefined();
    expect(validateBatchManifest(B19_BATCH, ordinaryCatalogView())).toEqual([]);
  });
});

/** A pizza that physically recreates a recipe's Reference (both sauces, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
function referenceLikePizza(id: string, sauces: readonly string[], bakeResult = 66): PizzaState {
  const reference = getReferencePizza(id as never)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [...sauces],
    toppings: reference.pieceGroups.flatMap((group, gi) => group.positions.map((p, i) => ({ id: `${id}-${gi}-${i}`, ingredientId: group.ingredientId, ...p }))),
    bakeResult,
  } as PizzaState;
}

describe.each([
  [PB, pb, ["pesto", "olive-oil"], ["tomato-sauce", "olive-oil"]],
  [CR, cr, ["tomato-sauce", "olive-oil"], ["pesto", "olive-oil"]],
] as const)("%s: Free Cooking / Research round (AC-7: Completion Gate and discovery with two sauces)", (id, recipe, sauces, wrongSauces) => {
  it("a perfect round passes the Completion Gate", () => {
    expect(evaluatePizzaCompletion(recipe, referenceLikePizza(id, sauces))).toEqual({ status: "PASS" });
  });
  it("cooked with exactly its ingredients and BOTH sauces it is a UNIQUE_MATCH -> NEW_DISCOVERY, and a Dex that has it does not announce it again", () => {
    const sig = signatureOfPizza(referenceLikePizza(id, sauces));
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: id } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [id])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });
  it("resolveFreeCookPizza discovers it", () => {
    const r = resolveFreeCookPizza(referenceLikePizza(id, sauces), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
  });
  it("the primary sauce only, the other recipe's primary sauce, or a missing burrata makes it an ORIGINAL pizza (the exact set decides)", () => {
    const base = referenceLikePizza(id, sauces);
    const variants: Record<string, PizzaState> = {
      "primary sauce only": { ...base, sauceIds: [sauces[0]] } as PizzaState,
      "olive-oil only": { ...base, sauceIds: ["olive-oil"] } as PizzaState,
      "the other primary sauce": { ...base, sauceIds: [...wrongSauces] } as PizzaState,
      "no burrata": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "burrata") } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });
  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(id, sauces, 30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(id, sauces, 95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("Research (AC-8): burrata unlocks a NEW lettered cohort of two; no pre-existing recipe changes its letter in the CANONICAL ladder order", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const ORDINARY = ordinaryRecipes(RECIPES);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));
  it("both recipes share the burrata cohort (letters A and B) from the moment burrata is owned, and are unregistered before; the label names only the unlock ingredient", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    const now = researchCohortLetters(owned, ORDINARY);
    expect([now.get(PB), now.get(CR)].sort()).toEqual(["A", "B"]);
    const noBurrata = researchCohortLetters(owned.filter((m) => m !== "burrata"), ORDINARY);
    expect(noBurrata.has(PB) || noBurrata.has(CR)).toBe(false);
    expect(researchEntryLabel({ unlockIngredientId: "burrata", cohortLetter: "A" })).toBe("？？？ピザ A（ブッラータ）");
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
    let s = 20261107;
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
});

/**
 * AC-8 / Owner Q2 + P2: in NON-canonical acquisition orders a pre-existing recipe's letter can change when a shared material is acquired last (the same effect Batch 18 audited). The audited scope below is the Result Report §6 (B19-LD-01 ... B19-LD-20, in this order).
 * OWNER APPROVAL (PR #783 comment 6704906797, 2026-11-07, at HEAD 94954b72): each of the 20 IDs was APPROVED individually, ONLY for the alternate-order letter changes characterised by the audit. The approval does NOT cover any additional recipe, an unexpected label loss, a non-letter change or a broader
 * Research algorithm change: if the audit ever yields an unlisted id, STOP and ask the Owner again. The canonical-order 0-change invariant is asserted separately and must stay.
 */
const B19_APPROVED_ALTERNATE_ORDER_LETTER_CHANGES: readonly string[] = [
  "quattro-formaggi",
  "fugazza",
  "pizza-bianca",
  "vongole",
  "baba-ganoush-pizza",
  "pizza-feta-eliniki",
  "pizza-bianca-ricotta",
  "eggplant-ricotta-pizza",
  "grandma-pizza",
  "boscaiola",
  "pesto-caprese",
  "pesto-pollo",
  "pesto-trapanese",
  "veggie-supreme-pizza",
  "california-style-pizza",
  "chilean-napolitana",
  "jamon-serrano-pizza",
  "pinsa-romana",
  "rucola-e-grana",
  "baingan-bharta-pizza",
];
describe("Research labels BEFORE vs AFTER Batch 19 across acquisition orders (AC-8, P2): the exact audited scope, individually Owner-approved (20 IDs)", () => {
  const changes = researchLetterChangesAcrossOrders(NEW_IDS, RECIPES as readonly Recipe[]);
  it("the canonical ladder order changes no pre-existing letter (the full late catalog included)", () => {
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
  });
  it("in non-canonical orders exactly the 20 Owner-approved pre-existing recipes can change their letter, and no other (an unlisted id is a STOP for a new Owner decision)", () => {
    // pinsa-romana (B19-LD-18) exists only while the Pinsa gate is open: the Pinsa-closed build has exactly the other 19.
    expect([...changes.keys()].sort()).toEqual([...B19_APPROVED_ALTERNATE_ORDER_LETTER_CHANGES].filter((id) => id !== "pinsa-romana" || pinsaEnabled()).sort());
    expect(B19_APPROVED_ALTERNATE_ORDER_LETTER_CHANGES).toHaveLength(20);
  });
  it("every audited change is a LETTER change (a letter gained, moved or dropped within the cohort letters), never a non-letter change", () => {
    for (const [id, list] of changes) for (const c of list) expect(c.change, id).toMatch(/^(-|[A-Z]+)->(-|[A-Z]+)$/);
  });
});

describe("AC-8b: the paid Hint 5.0 SAUCE or CHEESE rung (10 Pitz) tells pesto-burrata-pizza and pizza-alla-crudaiola apart (P1)", () => {
  const view = (id: string, completed: string[]) => hint5Presentation({ recipeId: id, discoveredCount: 5, storedFactIds: completed, legacyPurchases: [], pitzBalance: 100 })!;
  it("both are key-free ladders whose first rungs are SAUCE then CHEESE, each priced 10 Pitz", () => {
    for (const id of [PB, CR]) expect(buildHint5Ladder(id)!.rungs.slice(0, 2).map((r) => r.kind)).toEqual(["SAUCE", "CHEESE"]);
    expect(HINT5_RUNG_PRICE.SAUCE).toBe(10);
    expect(HINT5_RUNG_PRICE.CHEESE).toBe(10);
    expect(view(PB, []).next).toMatchObject({ kind: "SAUCE", price: 10, affordable: true });
  });
  it("the SAUCE rung alone is enough: it shows {pesto, olive-oil} for one and {tomato-sauce, olive-oil} for the other (the two sets differ)", () => {
    const sauceOf = (id: string) => (view(id, [HINT5_RUNG_MARKER.SAUCE]).board.find((e) => e.kind === "SAUCE") as unknown as { ingredientIds: string[] }).ingredientIds;
    expect([...sauceOf(PB)].sort()).toEqual(["olive-oil", "pesto"]);
    expect([...sauceOf(CR)].sort()).toEqual(["olive-oil", "tomato-sauce"]);
  });
  it("the CHEESE rung alone is also enough: {burrata} versus {mozzarella, burrata}", () => {
    const cheeseOf = (id: string) => (view(id, [HINT5_RUNG_MARKER.CHEESE]).board.find((e) => e.kind === "CHEESE") as unknown as { ingredientIds: string[] }).ingredientIds;
    expect([...cheeseOf(PB)].sort()).toEqual(["burrata"]);
    expect([...cheeseOf(CR)].sort()).toEqual(["burrata", "mozzarella"]);
  });
  it("no rung line names a recipe (Anti-Oracle): the board holds ingredient ids and structure only", () => {
    const board = view(PB, [HINT5_RUNG_MARKER.SAUCE, HINT5_RUNG_MARKER.CHEESE, HINT5_RUNG_MARKER.STRUCTURE]).board;
    expect(JSON.stringify(board)).not.toMatch(/pesto-burrata|crudaiola|ペスト・ブッラータ|クルダイオーラ/);
  });
});
