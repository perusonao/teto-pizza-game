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
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B20A_BATCH, RECIPE_BATCHES } from "../logic/catalog/testSupport/recipeBatchManifest";
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
 * Expansion Batch 20-A (Issue #790): `honey` (はちみつ, a spread SAUCE, the second sauce layer) + `walnut` (くるみ, a topping, family `other`) as ordinary step 71, and pesto-noci-pizza (credited, the step's key).
 * PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed; the only evidence is the 172 matrix row `pesto-noci-pizzadb-p12`. Counts / the generic 58-78 bake window / colours / names are GAMEPLAY ASSUMPTIONS.
 * The recipe has TWO sauce layers (the primary sauce, pesto, is the Reference target; honey is scored by presence, as the olive-oil of grandma-pizza and the Batch 19 recipes), every piece is placed BEFORE the bake, no new technique and no FINISH / prep / sear / steam step.
 * Owner decisions (2026-11-08, Issue #790): honey = a pre-bake second sauce layer; mozzarella is NOT added; walnut family `spice` (Owner first chose `other`, changed to `spice` after the DH4-PROD gate measurement, see ingredientTaxonomy.ts); the PR #777 walnut art is re-used; provisional counts / names / bake window adopted; ONE implementation PR.
 * Decision table: docs/reports/TETO_B20A_Owner-Decision-Table_2026-11-08.md (branch `claude/b20a-owner-decision-table`, commit f3925e94).
 */
const PN = "pesto-noci-pizza";
const pn = RECIPES.find((r) => r.id === PN)! as Recipe;
const NEW_IDS: readonly string[] = [PN];
const SET = ["pesto", "honey", "gorgonzola", "walnut"];
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;

describe("honey (Owner 2026-11-08: a pre-bake second sauce layer)", () => {
  const ing = getIngredient("honey")!;
  it("is a finite spread SAUCE named はちみつ with no dedicated art, no family row and no size class (it is painted, not placed)", () => {
    expect(ing).toMatchObject({ id: "honey", category: "sauce", nameJa: "はちみつ", placement: "spread" });
    expect(ing.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ing.pieceVisual).toBeUndefined();
    expect(ingredientAttributeFamily("honey")).toBeNull();
  });
  it("is exactly one new ingredient id with an emoji no other ingredient uses (G18; miso-sauce keeps its 🍯)", () => {
    expect(INGREDIENTS.filter((i) => i.id === "honey")).toHaveLength(1);
    expect(INGREDIENTS.filter((i) => i.emoji === ing.emoji).map((i) => i.id)).toEqual(["honey"]);
    expect(ing.emoji).not.toBe("\u{1F36F}");
  });
});

describe("walnut (family `spice`, the PR #777 art re-used)", () => {
  const ing = getIngredient("walnut")!;
  it("is a finite scatter TOPPING named くるみ with the walnut-kernel art, size class s, family spice (NOT other: the DH4-PROD gate keeps 「その他」 unreachable and the walnut is this recipe's only topping = the Rule W reserve)", () => {
    expect(ing).toMatchObject({ id: "walnut", category: "topping", nameJa: "くるみ", pieceVisual: "walnut-kernel", placement: "scatter" });
    expect(ing.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(toppingSizeClass("walnut")).toBe("s");
    expect(ingredientAttributeFamily("walnut")).toBe("spice");
    expect(ingredientAttributeFamily("almond")).toBe("other"); // the shipped nuts keep `other` (they are never a Rule W reserve)
    expect(ingredientAttributeFamily("pine-nuts")).toBe("other");
  });
  it("is exactly one new ingredient id with an emoji no other ingredient uses (G18; not almond's 🥜 nor pine-nuts' 🌰)", () => {
    expect(INGREDIENTS.filter((i) => i.id === "walnut")).toHaveLength(1);
    expect(INGREDIENTS.filter((i) => i.emoji === ing.emoji).map((i) => i.id)).toEqual(["walnut"]);
  });
});

describe(PN, () => {
  it("has the matrix ingredient set (no substitution, NO mozzarella), in order: primary sauce, second sauce, cheese, topping (the topping is the Rule W reserved ingredient)", () => {
    expect(pn.requiredIngredients.map((q) => [q.ingredientId, q.minCount])).toEqual([["pesto", 1], ["honey", 1], ["gorgonzola", 2], ["walnut", 3]]);
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
    expect(getCookingProfile(PN as never).steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
  });
  it("is NOT a NO_SAUCE recipe: pesto is painted (the Reference target), honey is the presence-scored second sauce with no profile entry", () => {
    expect(noSauceRecipeIds()).not.toContain(PN);
    expect(getRecipeSauceProfile(PN as never)).toEqual({ recipeId: PN, ingredientId: "pesto", interaction: "PAINT" });
    expect(MULTI_SAUCE_RECIPE_IDS).toContain(PN);
  });
  it("the description names no moment, no ingredient quantity and not the recipe's key (Anti-Oracle)", () => {
    expect(pn.description).not.toMatch(/焼く前|焼いた後|後乗せ|[0-9０-９]/);
  });
  it("its two-sauce hint set asks for the second sauce (honey) and names no recipe", () => {
    expect(RECIPE_HINTS[PN]!.missing["honey"]).toBeTruthy();
    expect(JSON.stringify(RECIPE_HINTS[PN])).not.toMatch(/ノーチ|ペスト|くるみ|ゴルゴンゾーラ/);
  });
});

describe("Reference (scoring): the first 5 slots of the RT-01 ring in requiredIngredients order", () => {
  it("slots, order, counts (gorgonzola 2, walnut 3; the two sauces are not pieces)", () => {
    const ref = getReferencePizza(PN as never)!;
    const pieces = pn.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    const total = pieces.reduce((n, q) => n + q.minCount, 0);
    expect(total).toBe(5);
    expect(ref.sauce).not.toBeNull();
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(total).map(({ x, y }) => ({ x, y })));
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(pieces.map((q) => q.ingredientId));
    for (const [i, g] of ref.pieceGroups.entries()) expect(g.positions.length).toBe(pieces[i].minCount);
  });
});

describe("Duplicate Gate (no Jaccard exception; the global 0.4 guideline is untouched)", () => {
  const all = [...RECIPES] as readonly Recipe[];
  it("no other recipe (late catalog included) has the same set, none is a subset or a superset, and none differs by one ingredient", () => {
    const mine = idsOf(pn);
    for (const other of all) {
      if (other.id === PN) continue;
      const theirs = idsOf(other);
      expect(symDiff(mine, theirs), `${PN} vs ${other.id} symmetric difference`).toBeGreaterThan(1);
      expect(mine.every((x) => theirs.includes(x)) || theirs.every((x) => mine.includes(x)), `${PN} vs ${other.id} subset / superset`).toBe(false);
    }
  });
  it("stays far under the 0.4 guideline: the worst neighbour is genovese at 1/6", () => {
    const rows = all.filter((o) => o.id !== PN).map((o) => [o.id, jaccard(idsOf(pn), idsOf(o))] as const).sort((a, b) => b[1] - a[1]);
    expect(rows[0][0]).toBe("genovese");
    expect(rows[0][1]).toBeCloseTo(1 / 6, 3);
    expect(idsOf(pn).sort()).toEqual([...SET].sort());
  });
});

describe("ordinary step 71 and the late steps", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("steps 1-70 are frozen; step 71 is honey + walnut (the last, walnut, is the cohort key), no star gate, keyed to pesto-noci-pizza", () => {
    const step = steps.find((s) => s.step === 71)!;
    expect(step).toMatchObject({ step: 71, ingredientIds: ["honey", "walnut"], keyRecipeId: PN });
    expect((step as { starGates?: unknown }).starGates).toBeUndefined();
    expect(steps.find((s) => s.step === 70)).toMatchObject({ ingredientIds: ["burrata"], keyRecipeId: "pesto-burrata-pizza" });
    expect(ordinaryLadderSteps(steps).at(-1)).toBe(step);
  });
  it("every other ingredient of the recipe is owned before step 71 (honey and walnut are the last unlocks)", () => {
    const before = new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, 70).flatMap((s) => s.ingredientIds)]);
    for (const q of pn.requiredIngredients) if (q.ingredientId !== "honey" && q.ingredientId !== "walnut") expect(before.has(q.ingredientId), q.ingredientId).toBe(true);
    expect(before.has("honey") || before.has("walnut")).toBe(false);
  });
  it("the late steps follow at 72-78 (derived; +1 again) and the late floors are unchanged", () => {
    const late = steps.slice(71);
    expect(late.map((s) => s.step)).toEqual([72, 73, 74, 75, 76, 77, 78]);
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68 });
  });
  it("the batch manifest is LANDED and consistent: appended tail, append-only ladder, chapter / cohort identity, explicit declarations", () => {
    expect(RECIPE_BATCHES).toContain(B20A_BATCH);
    expect(B20A_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([[PN, "walnut", true]]);
    expect(B20A_BATCH.acceptedLetterShifts).toBeUndefined();
    expect(validateBatchManifest(B20A_BATCH, ordinaryCatalogView())).toEqual([]);
  });
});

/** A pizza that physically recreates the recipe's Reference (both sauces, exact piece positions) -- what a perfect Free Cooking / Research round produces. */
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
  it("pesto only, honey only, another primary sauce, a missing walnut, or an added mozzarella makes it an ORIGINAL pizza (the exact set decides)", () => {
    const base = referenceLikePizza(sauces);
    const variants: Record<string, PizzaState> = {
      "pesto only": { ...base, sauceIds: ["pesto"] } as PizzaState,
      "honey only": { ...base, sauceIds: ["honey"] } as PizzaState,
      "another primary sauce": { ...base, sauceIds: ["tomato-sauce", "honey"] } as PizzaState,
      "no walnut": { ...base, toppings: base.toppings.filter((t) => t.ingredientId !== "walnut") } as PizzaState,
      "plus mozzarella": { ...base, toppings: [...base.toppings, { id: "extra-mozzarella", ingredientId: "mozzarella", x: 50, y: 52 }] } as PizzaState,
    };
    for (const [label, pizza] of Object.entries(variants)) expect(resolveFreeCookPizza(pizza, EMPTY_DEX).kind, label).toBe("ORIGINAL");
  });
  it("a raw or burnt bake is a FAILED round, not an original pizza", () => {
    expect(resolveFreeCookPizza(referenceLikePizza(sauces, 30), EMPTY_DEX).kind).toBe("FAILED");
    expect(resolveFreeCookPizza(referenceLikePizza(sauces, 95), EMPTY_DEX).kind).toBe("FAILED");
  });
});

describe("Research: the walnut cohort letter is new; no pre-existing recipe changes its letter in the CANONICAL ladder order (stop condition)", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const ORDINARY = ordinaryRecipes(RECIPES);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));
  it("the recipe is a single-member cohort (no letter) from the moment its two new materials are owned, is unregistered before, and its label names only the unlock ingredient (walnut, the last of the step)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials];
    expect(researchCohortLetters(owned, ORDINARY).has(PN)).toBe(false); // a single-member cohort has no letter (researchEntry.ts)
    expect(researchEntryLabel({ unlockIngredientId: "walnut", cohortLetter: null })).toBe("？？？ピザ（くるみ）");
    expect(researchEntryLabel({ unlockIngredientId: "walnut", cohortLetter: "A" })).toBe("？？？ピザ A（くるみ）");
    // nothing else is unlocked by honey / walnut: the recipe is the only one whose requirements include either material
    expect(ORDINARY.filter((r) => r.requiredIngredients.some((q) => q.ingredientId === "honey" || q.ingredientId === "walnut")).map((r) => r.id)).toEqual([PN]);
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
 * Non-canonical acquisition orders: a pre-existing recipe's letter can change when a shared material (pesto / gorgonzola) is acquired last (the same effect Batches 18 and 19 audited). The audited scope below is the Decision Table §4 (the 10 existing recipes).
 * OWNER APPROVAL (Issue #790, 2026-11-08, B20-A final approval): "Research: the non-canonical-order changes of the 10 existing IDs listed in the approval table only; the canonical-order change stays 0". The approval covers ONLY the alternate-order LETTER changes characterised by the audit
 * (a letter gained, moved or dropped within the cohort letters): it does NOT cover any additional recipe, an unexpected label loss, a non-letter change or a broader Research algorithm change. If the audit ever yields an unlisted id, STOP and ask the Owner again.
 */
const B20A_APPROVED_ALTERNATE_ORDER_LETTER_CHANGES: readonly string[] = [
  "genovese",
  "pesto-burrata-pizza",
  "pesto-caprese",
  "pesto-patate",
  "pesto-pollo",
  "pesto-salmone",
  "pesto-tonno",
  "pesto-trapanese",
  "pesto-vegetariana",
  "quattro-formaggi",
];
describe("Research labels BEFORE vs AFTER Batch 20-A across acquisition orders: the exact audited scope, individually Owner-approved (10 IDs)", () => {
  const changes = researchLetterChangesAcrossOrders(NEW_IDS, RECIPES as readonly Recipe[]);
  it("the canonical ladder order changes no pre-existing letter (the full late catalog included)", () => {
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
  });
  it("in non-canonical orders exactly the 10 Owner-approved pre-existing recipes can change their letter, and no other (an unlisted id is a STOP for a new Owner decision)", () => {
    expect([...changes.keys()].sort()).toEqual([...B20A_APPROVED_ALTERNATE_ORDER_LETTER_CHANGES].sort());
    expect(B20A_APPROVED_ALTERNATE_ORDER_LETTER_CHANGES).toHaveLength(10);
  });
  it("every audited change is a LETTER change (a letter gained, moved or dropped within the cohort letters), never a non-letter change", () => {
    for (const [id, list] of changes) for (const c of list) expect(c.change, id).toMatch(/^(-|[A-Z]+)->(-|[A-Z]+)$/);
  });
  it("no audited change drops a letter (no `->-`): every change gains a first letter or moves an existing one", () => {
    for (const [id, list] of changes) for (const c of list) expect(c.change, id).not.toMatch(/->-$/);
  });
});

describe("Hint 5.0: pesto-noci-pizza is a key-free ladder; the SAUCE rung shows its two sauces and names no recipe", () => {
  const view = (completed: string[]) => hint5Presentation({ recipeId: PN, discoveredCount: 5, storedFactIds: completed, legacyPurchases: [], pitzBalance: 100 })!;
  it("is a key-free ladder: SAUCE, CHEESE, STRUCTURE, SUB_CLASS, the first two priced 10 Pitz", () => {
    expect(buildHint5Ladder(PN)!.rungs.map((r) => r.kind)).toEqual(["SAUCE", "CHEESE", "STRUCTURE", "SUB_CLASS"]);
    expect(HINT5_RUNG_PRICE.SAUCE).toBe(10);
    expect(HINT5_RUNG_PRICE.CHEESE).toBe(10);
    expect(view([]).next).toMatchObject({ kind: "SAUCE", price: 10, affordable: true });
  });
  it("the SAUCE rung shows {pesto, honey} and the CHEESE rung shows {gorgonzola}", () => {
    const sauceOf = (view([HINT5_RUNG_MARKER.SAUCE]).board.find((e) => e.kind === "SAUCE") as unknown as { ingredientIds: string[] }).ingredientIds;
    expect([...sauceOf].sort()).toEqual(["honey", "pesto"]);
    const cheeseOf = (view([HINT5_RUNG_MARKER.CHEESE]).board.find((e) => e.kind === "CHEESE") as unknown as { ingredientIds: string[] }).ingredientIds;
    expect([...cheeseOf]).toEqual(["gorgonzola"]);
  });
  it("no rung line names the recipe (Anti-Oracle): the board holds ingredient ids and structure only", () => {
    const board = view([HINT5_RUNG_MARKER.SAUCE, HINT5_RUNG_MARKER.CHEESE, HINT5_RUNG_MARKER.STRUCTURE]).board;
    expect(JSON.stringify(board)).not.toMatch(/pesto-noci|ペスト・ノーチ/);
  });
});
