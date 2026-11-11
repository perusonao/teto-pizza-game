import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { LATE_DISCOVERY_TARGET_IDS, LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, LATE_RECIPES } from "./lateCatalog";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { toppingSizeClass } from "./toppingSizeClass";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B21_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
import { productionCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
import { researchLetterChangesAcrossOrders } from "../logic/catalog/testSupport/researchLabelAudit";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluateDiscovery, matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { buildHint5Ladder } from "../logic/discovery/hint5Ladder";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { discoveredRecipeIds, EMPTY_DEX } from "../state/dex";

/**
 * Expansion Batch 21 (Issue #780; Owner approvals 2026-11-08 Q-1 and 2026-11-09 Q-2 / Q-3): the two LATE recipes `taco-pizza` and `okonomiyaki-style-pizza` and their six late materials
 * (cheddar, lettuce, tortilla-chips at late step 79, keyed to taco-pizza; okonomiyaki-sauce, cabbage, bonito-flakes at late step 80, keyed to okonomiyaki-style-pizza). PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed;
 * the evidence is the 172 matrix rows `taco-pizza-pizzadb` and `okonomiyaki-style-pizza-pizzadb-p1`. Counts / the generic 58-78 bake window / colours are GAMEPLAY ASSUMPTIONS.
 * The values are the Q-3 values of docs/reports/TETO_B21_Q2-Q3_Individual-Lists_2026-11-08.md (= src/data/staged/stagedPromotionCandidates.ts) EXCEPT the two DEVIATIONS pinned below.
 */
const TACO = "taco-pizza";
const OKO = "okonomiyaki-style-pizza";
const NEW_IDS: readonly string[] = [TACO, OKO];
const NEW_MATERIALS = ["cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes"] as const;
const taco = RECIPES.find((r) => r.id === TACO)! as Recipe;
const oko = RECIPES.find((r) => r.id === OKO)! as Recipe;
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;

describe("the two recipes (Q-3 values; late catalog, POST_BAKE garnishes, ladder-credited, key-free)", () => {
  it("taco-pizza: tomato-sauce 1 / cheddar 2 / beef 3 / fresh-tomato 2 / lettuce 2 POST_BAKE / tortilla-chips 2 POST_BAKE (the matrix post_bake evidence)", () => {
    expect(taco.nameJa).toBe("タコピザ");
    expect(taco.description).toBe("牛ひき肉とチェダーに、レタスとトルティーヤチップスをあわせた一枚。");
    expect(taco.requiredIngredients.map((q) => [q.ingredientId, q.minCount, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"])).toEqual([
      ["tomato-sauce", 1, "PRE_BAKE"],
      ["cheddar", 2, "PRE_BAKE"],
      ["beef", 3, "PRE_BAKE"],
      ["fresh-tomato", 2, "PRE_BAKE"],
      ["lettuce", 2, "POST_BAKE"],
      ["tortilla-chips", 2, "POST_BAKE"],
    ]);
  });
  it("okonomiyaki-style-pizza: okonomiyaki-sauce 1 / cabbage 3 (cooked in the dish: before the bake) / pork 3 / mayo 1 / bonito-flakes 2 / nori 1 POST_BAKE (the row's 青のり); NO cheese", () => {
    expect(oko.nameJa).toBe("お好み焼き風ピザ");
    expect(oko.description).toBe("お好み焼きソースにキャベツと豚肉、マヨネーズとかつお節をのせた一枚。");
    expect(oko.requiredIngredients.map((q) => [q.ingredientId, q.minCount, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"])).toEqual([
      ["okonomiyaki-sauce", 1, "PRE_BAKE"],
      ["cabbage", 3, "PRE_BAKE"],
      ["pork", 3, "PRE_BAKE"],
      ["mayo", 1, "PRE_BAKE"],
      ["bonito-flakes", 2, "PRE_BAKE"],
      ["nori", 1, "POST_BAKE"],
    ]);
    expect(idsOf(oko).some((id) => getIngredient(id)?.category === "cheese")).toBe(false);
  });
  it("both are LATE recipes (the tail of the catalog after tarako-cream-pizza, before Pinsa), with the generic late calibration and Discovery target ids", () => {
    expect(LATE_RECIPES.map((r) => r.id).slice(6, 9)).toEqual(["tarako-cream-pizza", TACO, OKO]);
    for (const r of [taco, oko]) {
      expect((r as { ladderCredit?: boolean }).ladderCredit !== false, r.id).toBe(true);
      expect(r.lunchRush, r.id).toBe(false);
      expect(isCutEligible(r.id as never), r.id).toBe(false);
      expect(RECIPE_HINT_ROLES[r.id as never], r.id).toEqual({ keyFree: true });
      expect(r.bakeTarget, r.id).toEqual({ start: 58, end: 78 });
      expect(r.baseRewardPitz, r.id).toBe(100);
      expect(getCookingProfile(r.id as never).steps, r.id).toContain("FINISH");
    }
    expect(LATE_DISCOVERY_TARGET_IDS[TACO]).toBe("taco-pizza-pizzadb");
    expect(LATE_DISCOVERY_TARGET_IDS[OKO]).toBe("okonomiyaki-style-pizza-pizzadb-p1");
  });
  it("neither is a NO_SAUCE recipe: the sauce is painted (taco: the existing tomato-sauce, the row's salsa = I-1 reuse; okonomiyaki: okonomiyaki-sauce)", () => {
    expect(noSauceRecipeIds()).not.toContain(TACO);
    expect(noSauceRecipeIds()).not.toContain(OKO);
    expect(getRecipeSauceProfile(TACO as never)).toEqual({ recipeId: TACO, ingredientId: "tomato-sauce", interaction: "PAINT" });
    expect(getRecipeSauceProfile(OKO as never)).toEqual({ recipeId: OKO, ingredientId: "okonomiyaki-sauce", interaction: "PAINT" });
  });
  it("the descriptions name no moment and no quantity (Anti-Oracle)", () => {
    for (const r of [taco, oko]) expect(r.description, r.id).not.toMatch(/焼く前|焼いた後|焼き上|後乗せ|仕上げ|[0-9０-９]/);
  });
});

describe("the six late materials (Q-3 values) and the two Owner-confirmation-pending DEVIATIONS", () => {
  const Q3: Record<string, { category: string; nameJa: string; color: string; emoji: string; placement: string }> = {
    cheddar: { category: "cheese", nameJa: "チェダーチーズ", color: "#f2a33a", emoji: "\u{1F536}", placement: "scatter" },
    lettuce: { category: "topping", nameJa: "レタス", color: "#9fd36b", emoji: "\u{1F34F}", placement: "scatter" }, // DEVIATION: Q-3 says \u{1FAB4}
    "tortilla-chips": { category: "topping", nameJa: "トルティーヤチップス", color: "#e8c25a", emoji: "\u{1F53A}", placement: "scatter" },
    "okonomiyaki-sauce": { category: "sauce", nameJa: "お好み焼きソース", color: "#5a3420", emoji: "\u{1F376}", placement: "spread" },
    cabbage: { category: "topping", nameJa: "キャベツ", color: "#c9e3a3", emoji: "\u{1FAB7}", placement: "scatter" }, // DEVIATION: Q-3 says \u{1F96C}
    "bonito-flakes": { category: "topping", nameJa: "かつお節", color: "#c98f5a", emoji: "\u{1FAB6}", placement: "scatter" },
  };
  it("each is exactly one new ingredient id with the Q-3 id / category / nameJa / color / placement, ladder-gated (never a Starter); lettuce / cabbage carry the dedicated #797 art (Owner 2026-11-09), the other four none", () => {
    for (const id of NEW_MATERIALS) {
      expect(INGREDIENTS.filter((i) => i.id === id), id).toHaveLength(1);
      expect(getIngredient(id), id).toMatchObject(Q3[id]);
      expect(getIngredient(id)!.unlockCondition, id).toEqual({ minTotalStars: 0 });
      expect((getIngredient(id) as { pieceVisual?: string }).pieceVisual, id).toBe(({ lettuce: "lettuce-leaf", cabbage: "cabbage-shreds", "tortilla-chips": "tortilla-chip-triangles" } as Record<string, string>)[id]);
      expect(STARTER_INGREDIENT_IDS, id).not.toContain(id);
    }
  });
  it("EMOJI DEVIATION (awaiting Owner confirmation): lettuce is 🍏 and cabbage is 🪷, not the Q-3 values 🪴 / 🥬, which are the Hint 5.0 herb / vegetable class symbols that G18 / H5-INV-2 forbid an ingredient to share; since 2026-11-09 both draw their dedicated SVG, so the emoji is only the hidden text fallback", () => {
    expect(getIngredient("lettuce")!.emoji).toBe("\u{1F34F}");
    expect(getIngredient("cabbage")!.emoji).toBe("\u{1FAB7}");
    // (The Q-3 values themselves are compared with src/data/staged/stagedPromotionCandidates.ts in staged/stagedPromotion.firstTrain.test.ts: nothing outside src/data/staged may import it.)
    expect(INGREDIENTS.some((i) => i.emoji === "\u{1FAB4}" || i.emoji === "\u{1F96C}")).toBe(false);
  });
  it("the text fallbacks are unique across the catalog (G18), including the two deviation values", () => {
    for (const id of NEW_MATERIALS) expect(INGREDIENTS.filter((i) => i.emoji === getIngredient(id)!.emoji).map((i) => i.id), id).toEqual([id]);
  });
  it("families and size classes: cheddar is a cheese (no topping family); lettuce / cabbage vegetable, bonito-flakes seafood; sizes lettuce m / tortilla-chips m / cabbage s / bonito-flakes xs / cheddar l (Owner 2026-11-09, formally specified)", () => {
    expect(ingredientAttributeFamily("cheddar")).toBeNull();
    expect(ingredientAttributeFamily("lettuce")).toBe("vegetable");
    expect(ingredientAttributeFamily("cabbage")).toBe("vegetable");
    expect(ingredientAttributeFamily("bonito-flakes")).toBe("seafood");
    expect(ingredientAttributeFamily("okonomiyaki-sauce")).toBeNull();
    expect([toppingSizeClass("lettuce"), toppingSizeClass("tortilla-chips"), toppingSizeClass("cabbage"), toppingSizeClass("bonito-flakes"), toppingSizeClass("cheddar")]).toEqual(["m", "m", "s", "xs", "l"]);
  });
  it("FAMILY DEVIATION (awaiting Owner confirmation): tortilla-chips is `vegetable` (the nori precedent), not the staged row's `other`, which the DH4-PROD gate OD-DH4-2-9 rejects", () => {
    expect(ingredientAttributeFamily("tortilla-chips")).toBe("vegetable");
  });
  it("their Shop offers are T4 (sauce pack 120 / refill 60) from their own late step: 82 for cheddar / lettuce / tortilla-chips, 83 for okonomiyaki-sauce / cabbage / bonito-flakes (derived: Expansion Batch 22's two ordinary steps moved them +2, Expansion Batch 23's ordinary step 74 +1 more); k follows the largest count", () => {
    const expected: Record<string, [number, number]> = { cheddar: [82, 2], lettuce: [82, 2], "tortilla-chips": [82, 2], "okonomiyaki-sauce": [83, 1], cabbage: [83, 3], "bonito-flakes": [83, 2] };
    for (const id of NEW_MATERIALS) {
      const [step, k] = expected[id];
      expect(materialOffer(getIngredient(id)!), id).toMatchObject({ ingredientId: id, step, tier: "T4", k, packQuantity: 10 * k, packPrice: 120, refillPrice: 60 });
    }
  });
});

describe("Reference (scoring): the first slots of the RT-01 ring groups in requiredIngredients order", () => {
  it.each([
    [TACO, 11],
    [OKO, 10],
  ])("%s: %i non-sauce pieces on the first slots of the ring (a calibrated assignment), no shared slot, the sauce painted", (id, total) => {
    const recipe = RECIPES.find((r) => r.id === id)! as Recipe;
    const ref = getReferencePizza(id as never)!;
    const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    expect(pieces.reduce((n, q) => n + q.minCount, 0)).toBe(total);
    expect(ref.sauce).not.toBeNull();
    const placed = ref.pieceGroups.flatMap((g) => g.positions);
    // The slot assignment is a Reference CALIBRATION (the groups interleave, so the POST_BAKE pieces land on spread-out slots): the pieces occupy exactly the first `total` slots of the ring, as a set.
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    expect(placed.map(key).sort()).toEqual(getReferenceSlots(total).map(key).sort());
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(pieces.map((q) => q.ingredientId));
    for (const [i, g] of ref.pieceGroups.entries()) expect(g.positions.length).toBe(pieces[i].minCount);
    expect(new Set(placed.map((p) => `${p.x},${p.y}`)).size).toBe(placed.length);
  });
  it("lettuce and cabbage land HEAVY_SQUASH (LIGHT_LEAF is reserved for the leafy herbs, bakeRoastResistant)", () => {
    for (const [id, ingredientId] of [[TACO, "lettuce"], [OKO, "cabbage"]] as const) {
      expect(getReferencePizza(id as never)!.pieceGroups.find((g) => g.ingredientId === ingredientId)!.interaction.landingStyle, `${id}/${ingredientId}`).toBe("HEAVY_SQUASH");
    }
  });
});

describe("Duplicate Gate and differentiation (the GLOBAL 0.4 Jaccard guideline is NOT changed; NO exception is needed)", () => {
  const all = [...RECIPES] as readonly Recipe[];
  it.each([[TACO], [OKO]])("%s: no other recipe (late catalog included) has the set, none is a subset or a superset, and none differs by one ingredient", (id) => {
    const me = all.find((r) => r.id === id)!;
    const mine = idsOf(me);
    for (const other of all) {
      if (other.id === id) continue;
      const theirs = idsOf(other);
      expect(symDiff(mine, theirs), `${id} vs ${other.id} symmetric difference`).toBeGreaterThan(1);
      expect(mine.every((x) => theirs.includes(x)) || theirs.every((x) => mine.includes(x)), `${id} vs ${other.id} subset / superset`).toBe(false);
    }
  });
  it("the measured maximum Jaccard stays under the 0.4 guideline: taco-pizza 0.200 (pizza-alla-crudaiola), okonomiyaki-style-pizza 0.125 (porchetta-pizza)", () => {
    const worst = (id: string) => {
      const me = all.find((r) => r.id === id)!;
      return all.filter((o) => o.id !== id).map((o) => [jaccard(idsOf(me), idsOf(o)), o.id] as const).sort((a, b) => b[0] - a[0])[0];
    };
    expect(worst(TACO)[1]).toBe("pizza-alla-crudaiola");
    expect(worst(TACO)[0]).toBeCloseTo(0.2, 3);
    expect(worst(OKO)[1]).toBe("porchetta-pizza");
    expect(worst(OKO)[0]).toBeCloseTo(0.125, 3);
  });
  it("discovery identity: each ingredient set + sauce + late dimension is unique among the catalog, with the late axis on the POST_BAKE garnishes", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const tacoT = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === TACO)!;
    const okoT = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === OKO)!;
    expect(tacoT.capabilities).toEqual(["LATE_ADDITION"]);
    expect(okoT.capabilities).toEqual(["LATE_ADDITION"]);
    expect(tacoT.identityDimensions.late).toEqual([["POST_BAKE", ["lettuce", "tortilla-chips"]]]);
    expect(okoT.identityDimensions.late).toEqual([["POST_BAKE", ["nori"]]]);
    for (const t of [tacoT, okoT]) expect(RECIPE_DISCOVERY_CATALOG.filter((o) => key(o) === key(t)).map((o) => o.recipeId)).toEqual([t.recipeId]);
  });
});

describe("the late steps 79 / 80, the floors, and the batch manifest", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("ordinary steps are 73 (Expansion Batch 22 added 72 / 73); the two B21 late steps are 82 / 83 (derived: +3), no star gate, keyed to the recipes; the rest of the older late steps are unchanged (75-81)", () => {
    expect(ordinaryLadderSteps(steps)).toHaveLength(74); // Expansion Batch 23 (#780) appended step 74
    expect(steps.slice(74, 83).map((s) => s.step)).toEqual([75, 76, 77, 78, 79, 80, 81, 82, 83]);
    expect(steps.at(-8)).toMatchObject({ step: 82, ingredientIds: ["cheddar", "lettuce", "tortilla-chips"], keyRecipeId: TACO });
    expect(steps.at(-7)).toMatchObject({ step: 83, ingredientIds: ["okonomiyaki-sauce", "cabbage", "bonito-flakes"], keyRecipeId: OKO });
    for (const s of steps.slice(-8, -6)) expect((s as { starGates?: unknown }).starGates, `step ${s.step}`).toBeUndefined();
    expect(LATE_LADDER_STEPS.slice(-8, -6).map((s) => s.keyRecipeId)).toEqual([TACO, OKO]);
    expect(steps.find((s) => s.step === 81)).toMatchObject({ ingredientIds: ["cod-roe", "fresh-cream-sauce", "nori"], keyRecipeId: "tarako-cream-pizza" });
  });
  it("every other ingredient of each recipe is owned before its late step (the new materials are the last unlocks of their step)", () => {
    const owned = (n: number) => new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, n).flatMap((s) => s.ingredientIds)]);
    for (const [recipe, stepNo] of [[taco, 82], [oko, 83]] as const) {
      const before = owned(stepNo - 1);
      for (const q of recipe.requiredIngredients) {
        const isNewHere = (NEW_MATERIALS as readonly string[]).includes(q.ingredientId) && steps.find((s) => s.ingredientIds.includes(q.ingredientId))!.step === stepNo;
        if (!isNewHere) expect(before.has(q.ingredientId) || (NEW_MATERIALS as readonly string[]).includes(q.ingredientId), `${recipe.id}/${q.ingredientId}`).toBe(true);
      }
    }
  });
  it("the entitlement floors are the ladder numbers at the moment of shipping (79 / 80) and every older floor is unchanged", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({
      "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68,
      cheddar: 79, lettuce: 79, "tortilla-chips": 79, "okonomiyaki-sauce": 80, cabbage: 80, "bonito-flakes": 80, fennel: 83, orange: 83, carrot: 84, "red-cabbage": 84, "sunflower-seeds": 84, radicchio: 85, "balsamic-vinegar": 85, truffle: 86, banana: 88, chocolate: 88, "powdered-sugar": 88, "graham-cracker": 89, marshmallow: 89,
    });
  });
  it("B21_BATCH is LANDED and consistent over the FULL catalog (late batches are deliberately not in RECIPE_BATCHES): credit, key ingredient, cohort identity, append-only ladder", () => {
    expect(B21_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([[TACO, "tortilla-chips", true], [OKO, "bonito-flakes", true]]);
    expect(B21_BATCH.acceptedLetterShifts).toBeUndefined();
    expect(validateBatchManifest(B21_BATCH, productionCatalogView())).toEqual([]);
  });
});

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const STOCK = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

/** The Reference pieces of a recipe split by the phase of their requirement: [pre-bake, post-bake] (position = the Reference slot). */
function referencePieces(id: string) {
  const recipe = RECIPES.find((r) => r.id === id)! as Recipe;
  const reference = getReferencePizza(id as never)!;
  const phaseOf = new Map(recipe.requiredIngredients.map((q) => [q.ingredientId, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"]));
  const all = reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `b21-${id}-${gi}-${i}`, ingredientId: g.ingredientId, x: p.x, y: p.y })));
  return { pre: all.filter((t) => phaseOf.get(t.ingredientId) !== "POST_BAKE"), post: all.filter((t) => phaseOf.get(t.ingredientId) === "POST_BAKE"), sauceId: recipe.requiredIngredients.find((q) => getIngredient(q.ingredientId)?.category === "sauce")!.ingredientId };
}

/** A real Production Free Cooking round: sauce + pre-bake pieces, bake, FINISH pieces, 完成. */
function round(id: string, mutate?: (parts: ReturnType<typeof referencePieces>) => ReturnType<typeof referencePieces>, bakeValue = 68): GameState {
  const parts = (mutate ?? ((p) => p))(referencePieces(id));
  const initial = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK);
  const prepared = act(initial, { type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 });
  const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: [parts.sauceId], toppings: parts.pre };
  const atBake = act({ ...prepared, pizza }, { type: "START_BAKE", now: 20_000 });
  let next = gameReducer(atBake, { type: "CONFIRM_BAKE", value: bakeValue, now: 25_000 });
  for (const t of parts.post) next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId: t.ingredientId, x: t.x, y: t.y });
  return gameReducer(next, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
}

describe("Free Cooking: a perfect round (sauce + pre-bake pieces, bake, 後乗せ in FINISH, 完成) passes the Completion Gate and discovers each recipe", () => {
  it.each([[TACO], [OKO]])("%s: Completion Gate PASS -> UNIQUE_MATCH -> NEW_DISCOVERY, recorded in the Dex with the late-addition technique", (id) => {
    const result = round(id);
    expect(result.phase).toBe("RESULT");
    expect(result.recipe.id).toBe(id);
    expect(result.completion?.status).toBe("PASS");
    const registered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(registered.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    expect(discoveredRecipeIds(registered.dex)).toContain(id);
    expect(registered.discoveredTechniqueIds).toContain("late-addition");
  });
  it.each([[TACO], [OKO]])("%s: the signature of the finished pizza is a UNIQUE_MATCH of the catalog, and a Dex that has it does not announce it again", (id) => {
    const finished = round(id).pizza;
    const sig = signatureOfPizza(finished);
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: id } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [id])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });
  it.each([[TACO], [OKO]])("%s: the garnish placed BEFORE the bake, or left out of FINISH, is an ORIGINAL pizza (the moment is part of the identity, never announced)", (id) => {
    const late = (p: ReturnType<typeof referencePieces>) => ({ ...p, pre: [...p.pre, ...p.post], post: [] });
    const lateless = (p: ReturnType<typeof referencePieces>) => ({ ...p, post: [] });
    for (const mutate of [late, lateless]) {
      const registered = gameReducer(round(id, mutate), { type: "REGISTER_TO_DEX" });
      expect(registered.lastDiscovery?.kind).toBe("ORIGINAL");
      expect(discoveredRecipeIds(registered.dex)).not.toContain(id);
    }
  });
});

describe("Research: the 17 individually Owner-approved pre-existing recipes (Q-2, 2026-11-09), the canonical order changes 0 letters", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const allLadderMaterials = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
  const ORDINARY = ordinaryRecipes(RECIPES);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));
  const withoutNewAll = RECIPES.filter((r) => !NEW_IDS.includes(r.id));

  it("each recipe is a single-member cohort (no letter) in the canonical order: tortilla-chips / bonito-flakes are the last material of their step", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...allLadderMaterials];
    const letters = researchCohortLetters(owned, RECIPES);
    expect(letters.has(TACO)).toBe(false);
    expect(letters.has(OKO)).toBe(false);
  });
  it("at EVERY ladder prefix (ordinary and late steps) no pre-existing recipe changes its letter in the canonical order (ordinary catalog and the full catalog): 0 changes, no acceptedLetterShifts", () => {
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      expect([...researchCohortLetters(owned, ORDINARY)].filter(([id]) => !NEW_IDS.includes(id)).sort(), `ordinary prefix ${n}`).toEqual([...researchCohortLetters(owned, withoutNew)].sort());
    }
    for (let n = 0; n <= allLadderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...allLadderMaterials.slice(0, n)];
      expect([...researchCohortLetters(owned, RECIPES)].filter(([id]) => !NEW_IDS.includes(id)).sort(), `full prefix ${n}`).toEqual([...researchCohortLetters(owned, withoutNewAll)].sort());
    }
  });

  /** The Owner-approved record: src/data/staged/__golden__/firstTrain.research.json (the Q-2 list of docs/reports/TETO_B21_Q2-Q3_Individual-Lists_2026-11-08.md): `id: change change ...`, 17 IDs. */
  const APPROVED_IDS = [
    "baingan-bharta-pizza", "california-style-pizza", "chilean-napolitana", "cuban-pizza", "goulash-pizza", "nigerian-suya-pizza", "pesto-burrata-pizza", "pesto-caprese", "pizza-alla-crudaiola",
    "pizza-feta-eliniki", "porchetta-pizza", "potato-mayo-pizza", "reina-pepiada-pizza", "rendang-pizza", "tarako-cream-pizza", "veggie-supreme-pizza", "wasabi-beef-pizza",
  ];
  const approved = JSON.parse(readFileSync(join(__dirname, "staged", "__golden__", "firstTrain.research.json"), "utf8")) as { canonicalChanges: number; nonCanonicalChanges: string[] };
  const approvedChanges = new Map(approved.nonCanonicalChanges.map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2).split(" ").sort()]));
  const asMap = (m: ReturnType<typeof researchLetterChangesAcrossOrders>) => new Map([...m].map(([id, list]) => [id, [...new Set(list.map((c) => c.change))].sort()]));
  /** The three tests below measure the SAME input (the shipped ladder, default 40 seeded orders). The audit is deterministic, so it is computed once, lazily, and shared (CI stabilisation: each call took ~3.3 s locally, over the 5 s default under CI load). */
  let shippedChanges: ReturnType<typeof researchLetterChangesAcrossOrders> | undefined;
  // Expansion Batch 22 (#780) is a LATER batch: its six recipes and ten materials are left out, so this stays the Batch 21 shipped-ladder comparison the Owner approved.
  const B22_RECIPES_LATER: readonly string[] = ["speck-e-brie", "buffalo-chicken", "pizza-finocchi-salad", "pizza-cavolo-carote", "pizza-radicchio-noci", "black-truffle-pizza", "apple-cinnamon-dessert", "nutella-dessert-pizza", "smore-dessert-pizza"]; // + Expansion Batch 23 (#780) and 23-b, LATER batches
  const B22_MATERIALS_LATER: readonly string[] = ["brie", "buffalo-sauce", "fennel", "orange", "carrot", "red-cabbage", "sunflower-seeds", "radicchio", "truffle", "balsamic-vinegar", "apple", "banana", "chocolate", "powdered-sugar", "graham-cracker", "marshmallow"]; // + Expansion Batch 23 (#780) and 23-b
  const shipped = () => (shippedChanges ??= researchLetterChangesAcrossOrders(NEW_IDS, RECIPES.filter((r) => !B22_RECIPES_LATER.includes(r.id)) as never, 40, 20261105, B22_MATERIALS_LATER));

  it("the approved record is exactly the 17 IDs (and records 0 canonical changes)", () => {
    expect(approved.canonicalChanges).toBe(0);
    expect([...approvedChanges.keys()].sort()).toEqual(APPROVED_IDS);
  });
  it("the approval-time measurement (10 seeded random orders over the ladder as it was approved, i.e. without the six B21 materials) reproduces the approved record EXACTLY: the same 17 IDs with the same letter changes", () => {
    const measured = asMap(researchLetterChangesAcrossOrders(NEW_IDS, RECIPES.filter((r) => !B22_RECIPES_LATER.includes(r.id)) as never, 10, 20261105, [...NEW_MATERIALS, ...B22_MATERIALS_LATER]));
    expect([...measured.keys()].sort()).toEqual(APPROVED_IDS);
    for (const id of APPROVED_IDS) expect(measured.get(id), id).toEqual(approvedChanges.get(id));
  });
  it("on the SHIPPED ladder (the six B21 materials included, the audit's default 40 seeded random orders): the canonical order changes 0 letters and the set of changed pre-existing recipes is exactly the 17 approved IDs", () => {
    const changes = shipped();
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
    expect([...changes.keys()].sort()).toEqual(APPROVED_IDS);
    for (const list of changes.values()) for (const c of list) expect(c.change).toMatch(/^(-|[A-Z]+)->(-|[A-Z]+)$/);
  }, 30_000);
  it("on the SHIPPED ladder every approved letter change is observed for its ID (the approved record is a subset of what is measured)", () => {
    const measured = asMap(shipped());
    for (const id of APPROVED_IDS) for (const change of approvedChanges.get(id)!) expect(measured.get(id), `${id} ${change}`).toContain(change);
  }, 30_000);
  /**
   * OWNER-APPROVED (2026-11-09, #780 / #799): the Q-2 approval was limited to the changes listed per ID, and on the SHIPPED ladder (the six B21 materials are in the random-order population) four of the 17 IDs show the ADDITIONAL
   * letter-to-letter changes below, which the approval-time measurement (no B21 materials in the ladder) did not contain. The Owner approved exactly these additions, "limited to the reported content; any other Research letter change is a STOP".
   * (A parallel PR, #798, reported a smaller sample of the same additions; the Owner is asked to confirm that THIS reported set is the approved scope -- see the #799 / #780 comments.)
   */
  const APPROVED_EXTRA: Readonly<Record<string, readonly string[]>> = {
    "pesto-burrata-pizza": ["H->I", "I->J", "J->K", "K->L"],
    "pizza-feta-eliniki": ["H->I", "I->J", "J->K"],
    "potato-mayo-pizza": ["B->C"],
    "wasabi-beef-pizza": ["C->D", "D->E"],
  };
  it("on the SHIPPED ladder the measured changes are exactly the approved record PLUS the four Owner-approved additions (2026-11-09; any other difference is a new STOP)", () => {
    const measured = asMap(shipped());
    for (const id of APPROVED_IDS) {
      const expected = [...approvedChanges.get(id)!, ...(APPROVED_EXTRA[id] ?? [])].sort();
      expect(measured.get(id), id).toEqual(expected);
    }
    expect(Object.keys(APPROVED_EXTRA).sort()).toEqual(["pesto-burrata-pizza", "pizza-feta-eliniki", "potato-mayo-pizza", "wasabi-beef-pizza"]);
  }, 30_000);
});

describe("Hint 5.0: both are key-free targets (a SAUCE, [CHEESE,] STRUCTURE, SUB_CLASS ladder) and name no recipe", () => {
  it("rung shapes", () => {
    const shape = (id: string) => buildHint5Ladder(id)?.rungs.map((r) => r.kind).join(",") ?? null;
    expect(shape(TACO)).toBe("SAUCE,CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS");
    expect(shape(OKO)).toBe("SAUCE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS");
  });
});
