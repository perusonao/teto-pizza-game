import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { LATE_DISCOVERY_TARGET_IDS, LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, LATE_RECIPES } from "./lateCatalog";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { toppingSizeClass } from "./toppingSizeClass";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B23_LATE_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
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
 * Expansion Batch 23-b (Issue #780; Owner decisions 2026-11-10): the two LATE dessert recipes `nutella-dessert-pizza` and `smore-dessert-pizza` and their five late materials (banana, chocolate, powdered-sugar, graham-cracker, marshmallow). PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed.
 * NO_SAUCE is an explicit Owner GAMEPLAY decision (Q-1), NOT a fact about the original. nutella's chocolate is a SCATTERED topping and no walnut is added (Q-2). B23-b resolves the two existing-gate conflicts WITHOUT weakening any gate (Owner 2026-11-10): the four dessert foods are `spice`
 * (the `other` family is unreachable by the DH4-PROD gate OD-DH4-2-9; cinnamon / walnut / mayo precedent) and each recipe also carries cream-cheese 2 BEFORE the bake (a NO_SAUCE recipe must start with a CHEESE rung: TQ-1D G7 / Hint G9). B23-a (apple-cinnamon-dessert, apple) is tested in expansionBatch23.test.ts.
 */
const ORDINARY_IDS = [] as const;
const LATE_IDS = ["nutella-dessert-pizza", "smore-dessert-pizza"] as const;
const NEW_IDS: readonly string[] = [...ORDINARY_IDS, ...LATE_IDS];
const NEW_MATERIALS = ["banana", "chocolate", "powdered-sugar", "graham-cracker", "marshmallow"] as const;
const get = (id: string) => RECIPES.find((r) => r.id === id)! as Recipe;
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const phased = (r: Recipe) => r.requiredIngredients.map((q) => [q.ingredientId, q.minCount, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"]);
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;

describe("the two recipes (Owner-approved provisional spec; LATE; ladder-credited, key-free; NO_SAUCE is a GAMEPLAY decision; a cream-cheese base)", () => {
  it("nutella-dessert-pizza: cream-cheese 2 / banana 2 / chocolate 2 (a scattered topping, no walnut) before the bake, powdered-sugar 2 after the bake (Japanese name unchanged, Q-7)", () => {
    expect(get("nutella-dessert-pizza").nameJa).toBe("ヌテラデザートピザ");
    expect(phased(get("nutella-dessert-pizza"))).toEqual([["cream-cheese", 2, "PRE_BAKE"], ["banana", 2, "PRE_BAKE"], ["chocolate", 2, "PRE_BAKE"], ["powdered-sugar", 2, "POST_BAKE"]]);
  });
  it("smore-dessert-pizza: cream-cheese 2 / chocolate 2 / graham-cracker 2 after the bake / marshmallow 2 (Japanese name unchanged, Q-7)", () => {
    expect(get("smore-dessert-pizza").nameJa).toBe("スモアデザートピザ");
    expect(phased(get("smore-dessert-pizza"))).toEqual([["cream-cheese", 2, "PRE_BAKE"], ["chocolate", 2, "PRE_BAKE"], ["graham-cracker", 2, "POST_BAKE"], ["marshmallow", 2, "PRE_BAKE"]]);
  });
  it("placement: both are late recipes (the two late recipes follow black-truffle-pizza, before Pinsa), with their Discovery target ids", () => {
    const ids = LATE_RECIPES.map((r) => r.id);
    expect(ids.slice(ids.indexOf("black-truffle-pizza"), ids.indexOf("black-truffle-pizza") + 3)).toEqual(["black-truffle-pizza", ...LATE_IDS]);
    expect(LATE_DISCOVERY_TARGET_IDS["nutella-dessert-pizza"]).toBe("nutella-dessert-pizza-pizzadb-p6");
    expect(LATE_DISCOVERY_TARGET_IDS["smore-dessert-pizza"]).toBe("smore-dessert-pizza-pizzadb-p4");
  });
  it("the generic calibration: ladder-credited, no Lunch Rush, no CUT, bake 58-78, 100 Pitz, permanently key-free; the descriptions name no moment and no quantity (Anti-Oracle)", () => {
    for (const id of NEW_IDS) {
      const r = get(id);
      expect((r as { ladderCredit?: boolean }).ladderCredit !== false, id).toBe(true);
      expect(r.lunchRush, id).toBe(false);
      expect(isCutEligible(id as never), id).toBe(false);
      expect(RECIPE_HINT_ROLES[id as never], id).toEqual({ keyFree: true });
      expect(r.bakeTarget, id).toEqual({ start: 58, end: 78 });
      expect(r.baseRewardPitz, id).toBe(100);
      expect(r.description, id).not.toMatch(/焼く前|焼いた後|焼き上|後乗せ|仕上げ|[0-9０-９]/);
    }
  });
  it("sauces: both are NO_SAUCE (the existing TQ-1D null mapping; Owner Q-1, a GAMEPLAY decision)", () => {
    expect(noSauceRecipeIds()).toEqual(expect.arrayContaining([...NEW_IDS]));
    for (const id of NEW_IDS) expect(getRecipeSauceProfile(id as never), id).toBeNull();
  });
});

describe("the five materials (Owner decisions 2026-11-10): ids, spec, art, families (spice, never `other`), sizes, colours, unique emoji", () => {
  const SPEC: Record<string, { category: string; color: string; emoji: string; placement: string; visual: string }> = {
    banana: { category: "topping", color: "#f2d24a", emoji: "\u{1F34C}", placement: "scatter", visual: "banana-dessert" },
    chocolate: { category: "topping", color: "#6b3f26", emoji: "\u{1F36B}", placement: "scatter", visual: "chocolate-dessert" },
    "powdered-sugar": { category: "topping", color: "#ffffff", emoji: "\u{1F9C1}", placement: "scatter", visual: "powdered-sugar-dessert" },
    "graham-cracker": { category: "topping", color: "#d9a85f", emoji: "\u{1F960}", placement: "scatter", visual: "graham-cracker-dessert" },
    marshmallow: { category: "topping", color: "#fbf4ee", emoji: "\u{1F361}", placement: "scatter", visual: "marshmallow-dessert" },
  };
  it("each is exactly one ingredient row, ladder-gated (never a Starter), with the approved category / colour / emoji / placement and the dedicated dessert art", () => {
    for (const id of NEW_MATERIALS) {
      expect(INGREDIENTS.filter((i) => i.id === id), id).toHaveLength(1);
      const { visual, ...rest } = SPEC[id];
      expect(getIngredient(id), id).toMatchObject(rest);
      expect((getIngredient(id) as { pieceVisual?: string }).pieceVisual, id).toBe(visual);
      expect(getIngredient(id)!.unlockCondition, id).toEqual({ minTotalStars: 0 });
      expect(STARTER_INGREDIENT_IDS, id).not.toContain(id);
    }
  });
  it("the text fallbacks are unique across the catalog (G18) and none is a Hint 5.0 family class symbol (H5-INV-2)", () => {
    for (const id of NEW_MATERIALS) expect(INGREDIENTS.filter((i) => i.emoji === getIngredient(id)!.emoji).map((i) => i.id), id).toEqual([id]);
    for (const symbol of ["\u{1F96C}", "\u{1FAB4}", "\u{1F969}", "\u{1F30A}", "\u{1F9C2}", "\u{1F347}", "✨"]) expect(NEW_MATERIALS.some((id) => getIngredient(id)!.emoji === symbol), symbol).toBe(false);
  });
  it("families (Owner 2026-11-10): banana fruit; chocolate / graham-cracker / marshmallow / powdered-sugar spice (the `other` family is unreachable, OD-DH4-2-9)", () => {
    expect([ingredientAttributeFamily("banana"), ingredientAttributeFamily("chocolate"), ingredientAttributeFamily("graham-cracker"), ingredientAttributeFamily("marshmallow"), ingredientAttributeFamily("powdered-sugar")]).toEqual(["fruit", "spice", "spice", "spice", "spice"]);
  });
  it("size classes (Owner Q-4): banana s / chocolate s / graham-cracker m / marshmallow s / powdered-sugar xs", () => {
    expect([toppingSizeClass("banana"), toppingSizeClass("chocolate"), toppingSizeClass("graham-cracker"), toppingSizeClass("marshmallow"), toppingSizeClass("powdered-sugar")]).toEqual(["s", "s", "m", "s", "xs"]);
  });
});

describe("the ladder: two new late steps, the floors, the batch manifest", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("the ordinary ladder is unchanged (74); two new late steps are the tail (88 nutella, 89 smore: the REC-04 tie goes to the smaller recipe id), no star gate", () => {
    expect(ordinaryLadderSteps(steps)).toHaveLength(74);
    expect(steps).toHaveLength(89);
    expect(steps.slice(-3).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([
      [87, ["truffle"], "black-truffle-pizza"],
      [88, ["banana", "chocolate", "powdered-sugar"], "nutella-dessert-pizza"],
      [89, ["graham-cracker", "marshmallow"], "smore-dessert-pizza"],
    ]);
    for (const s of steps.slice(-2)) expect((s as { starGates?: unknown }).starGates, `step ${s.step}`).toBeUndefined();
    expect(LATE_LADDER_STEPS.slice(-2).map((s) => s.keyRecipeId)).toEqual([...LATE_IDS]);
  });
  it("every other ingredient of each recipe is owned before its step (the new materials are unlocked at their own step)", () => {
    const owned = (n: number) => new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, n).flatMap((s) => s.ingredientIds)]);
    for (const id of NEW_IDS) {
      const stepNo = steps.find((s) => s.keyRecipeId === id)!.step;
      const before = owned(stepNo - 1);
      const here = new Set<string>(steps[stepNo - 1].ingredientIds);
      for (const q of get(id).requiredIngredients) expect(before.has(q.ingredientId) || here.has(q.ingredientId), `${id}/${q.ingredientId}`).toBe(true);
    }
  });
  it("the entitlement floors are the ladder numbers at the moment of shipping (88-89) and every older floor is unchanged", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({
      "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68,
      cheddar: 79, lettuce: 79, "tortilla-chips": 79, "okonomiyaki-sauce": 80, cabbage: 80, "bonito-flakes": 80,
      fennel: 83, orange: 83, carrot: 84, "red-cabbage": 84, "sunflower-seeds": 84, radicchio: 85, "balsamic-vinegar": 85, truffle: 86,
      banana: 88, chocolate: 88, "powdered-sugar": 88, "graham-cracker": 89, marshmallow: 89,
    });
  });
  it("B23_LATE_BATCH is LANDED and consistent over the catalog: credit, key ingredient, cohort identity, append-only ladder", () => {
    expect(B23_LATE_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([["nutella-dessert-pizza", "powdered-sugar", true], ["smore-dessert-pizza", "marshmallow", true]]);
    expect(B23_LATE_BATCH.acceptedLetterShifts).toBeUndefined();
    expect(validateBatchManifest(B23_LATE_BATCH, productionCatalogView())).toEqual([]);
  });
});

describe("Reference Truth: the non-sauce pieces on the RT-01 slots (a calibrated assignment), no shared slot", () => {
  it.each([["nutella-dessert-pizza", 8], ["smore-dessert-pizza", 8]])("%s: %i pieces", (id, total) => {
    const recipe = get(id);
    const ref = getReferencePizza(id as never)!;
    const pieces = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category !== "sauce");
    expect(pieces.reduce((n, q) => n + q.minCount, 0)).toBe(total);
    const placed = ref.pieceGroups.flatMap((g) => g.positions);
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    expect(placed.map(key).sort()).toEqual(getReferenceSlots(total).map(key).sort());
    expect(ref.pieceGroups.map((g) => g.ingredientId)).toEqual(pieces.map((q) => q.ingredientId));
    for (const [i, g] of ref.pieceGroups.entries()) expect(g.positions.length).toBe(pieces[i].minCount);
    expect(new Set(placed.map(key)).size).toBe(placed.length);
  });
});

describe("Duplicate Gate and differentiation (the GLOBAL 0.4 Jaccard guideline is NOT changed; NO exception is needed)", () => {
  const all = [...RECIPES] as readonly Recipe[];
  it.each(NEW_IDS.map((id) => [id]))("%s: no other recipe has the set, none is a subset or a superset, none differs by one ingredient, and the maximum Jaccard stays under 0.4", (id) => {
    const mine = idsOf(get(id));
    for (const other of all) {
      if (other.id === id) continue;
      const theirs = idsOf(other);
      expect(symDiff(mine, theirs), `${id} vs ${other.id} symmetric difference`).toBeGreaterThan(1);
      expect(mine.every((x) => theirs.includes(x)) || theirs.every((x) => mine.includes(x)), `${id} vs ${other.id} subset / superset`).toBe(false);
      expect(jaccard(mine, theirs), `${id} vs ${other.id} Jaccard`).toBeLessThan(0.4);
    }
  });
  it("discovery identity: each ingredient set + sauce + late dimension is unique; the late axis is on the POST_BAKE garnishes", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const target = (id: string) => RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === id)!;
    expect(target("nutella-dessert-pizza").identityDimensions.late).toEqual([["POST_BAKE", ["powdered-sugar"]]]);
    expect(target("smore-dessert-pizza").identityDimensions.late).toEqual([["POST_BAKE", ["graham-cracker"]]]);
    for (const id of LATE_IDS) expect(target(id).capabilities, id).toEqual(["LATE_ADDITION"]);
    for (const id of NEW_IDS) expect(RECIPE_DISCOVERY_CATALOG.filter((o) => key(o) === key(target(id))).map((o) => o.recipeId), id).toEqual([id]);
  });
});

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const STOCK = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

/** The Reference pieces of a recipe split by the phase of their requirement: [pre-bake, post-bake]; the sauces (one or two layers) painted before the bake. */
function referencePieces(id: string) {
  const recipe = get(id);
  const reference = getReferencePizza(id as never)!;
  const phaseOf = new Map(recipe.requiredIngredients.map((q) => [q.ingredientId, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"]));
  const all = reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `b23-${id}-${gi}-${i}`, ingredientId: g.ingredientId, x: p.x, y: p.y })));
  return { pre: all.filter((t) => phaseOf.get(t.ingredientId) !== "POST_BAKE"), post: all.filter((t) => phaseOf.get(t.ingredientId) === "POST_BAKE"), sauceIds: recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category === "sauce").map((q) => q.ingredientId) };
}

/** A real Production Free Cooking round: sauce(s) + pre-bake pieces, bake, FINISH pieces (late recipes), 完成. */
function round(id: string, mutate?: (parts: ReturnType<typeof referencePieces>) => ReturnType<typeof referencePieces>, bakeValue = 68): GameState {
  const parts = (mutate ?? ((p) => p))(referencePieces(id));
  const initial = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK);
  const prepared = act(initial, { type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 });
  const pizza: PizzaState = { ...createEmptyPizza(), sauceIds: parts.sauceIds, toppings: parts.pre };
  const atBake = act({ ...prepared, pizza }, { type: "START_BAKE", now: 20_000 });
  let next = gameReducer(atBake, { type: "CONFIRM_BAKE", value: bakeValue, now: 25_000 });
  for (const t of parts.post) next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId: t.ingredientId, x: t.x, y: t.y });
  return gameReducer(next, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
}

describe("Free Cooking: a perfect round passes the Completion Gate and discovers each recipe", () => {
  it.each(NEW_IDS.map((id) => [id]))("%s: Completion Gate PASS -> UNIQUE_MATCH -> NEW_DISCOVERY, recorded in the Dex", (id) => {
    const result = round(id);
    expect(result.phase).toBe("RESULT");
    expect(result.recipe.id).toBe(id);
    expect(result.completion?.status).toBe("PASS");
    const registered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(registered.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    expect(discoveredRecipeIds(registered.dex)).toContain(id);
    if ((LATE_IDS as readonly string[]).includes(id)) expect(registered.discoveredTechniqueIds).toContain("late-addition");
  });
  it.each(NEW_IDS.map((id) => [id]))("%s: the signature of the finished pizza is a UNIQUE_MATCH of the catalog, and a Dex that has it does not announce it again", (id) => {
    const sig = signatureOfPizza(round(id).pizza);
    expect(matchDiscovery(sig, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: id } });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, [id])).not.toMatchObject({ kind: "NEW_DISCOVERY" });
  });
  it.each(LATE_IDS.map((id) => [id]))("%s: the garnish placed BEFORE the bake, or left out of FINISH, is an ORIGINAL pizza (the moment is part of the identity, never announced)", (id) => {
    const early = (p: ReturnType<typeof referencePieces>) => ({ ...p, pre: [...p.pre, ...p.post], post: [] });
    const lateless = (p: ReturnType<typeof referencePieces>) => ({ ...p, post: [] });
    for (const mutate of [early, lateless]) {
      const registered = gameReducer(round(id, mutate), { type: "REGISTER_TO_DEX" });
      expect(registered.lastDiscovery?.kind).toBe("ORIGINAL");
      expect(discoveredRecipeIds(registered.dex)).not.toContain(id);
    }
  });
});

describe("Research: the canonical order changes 0 letters; the non-canonical changes are pinned and AWAIT the Owner's per-ID approval", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const allLadderMaterials = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
  const ORDINARY = ordinaryRecipes(RECIPES);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));
  const withoutNewAll = RECIPES.filter((r) => !NEW_IDS.includes(r.id));
  it("each LATE recipe is a single-member cohort (no letter) in the canonical order (its key is the last material of its own step)", () => {
    const letters = researchCohortLetters([...STARTER_INGREDIENT_IDS, ...allLadderMaterials], RECIPES);
    for (const id of LATE_IDS) expect(letters.has(id), id).toBe(false);
  });
  it("at EVERY ladder prefix no pre-existing recipe changes its letter in the canonical order (ordinary catalog and the full catalog): 0 changes, no acceptedLetterShifts", () => {
    for (let n = 0; n <= ladderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...ladderMaterials.slice(0, n)];
      expect([...researchCohortLetters(owned, ORDINARY)].filter(([id]) => !NEW_IDS.includes(id)).sort(), `ordinary prefix ${n}`).toEqual([...researchCohortLetters(owned, withoutNew)].sort());
    }
    for (let n = 0; n <= allLadderMaterials.length; n += 1) {
      const owned = [...STARTER_INGREDIENT_IDS, ...allLadderMaterials.slice(0, n)];
      expect([...researchCohortLetters(owned, RECIPES)].filter(([id]) => !NEW_IDS.includes(id)).sort(), `full prefix ${n}`).toEqual([...researchCohortLetters(owned, withoutNewAll)].sort());
    }
  }, 60_000);
  /**
   * OWNER-APPROVED (2026-11-10, B23-b only, per ID): the measured non-canonical changes of the SHIPPED-LADDER audit (the audit's default 40 seeded random orders) for B23-b, pre-existing recipe -> the distinct letter changes.
   * The earlier presented table (B23 decision table section 4) was measured WITHOUT the cream-cheese in nutella / smore (which then changed nothing); with the cream-cheese base (plan A) the two late recipes join the cream-cheese cohorts in some orders,
   * the Owner approved exactly these five IDs, conditions: canonical-order change 0, no unapproved Research change, no relaxed gate, a new difference is a STOP.
   */
  const OWNER_APPROVED_B23B: Readonly<Record<string, readonly string[]>> = {
    "pesto-salmone": ["-->B", "B->D", "C->D", "C->E", "D->F", "E->F", "E->G"],
    "jalapeno-popper-pizza": ["-->A"],
    "spinach-artichoke-pizza": ["-->A"],
    "apple-cinnamon-dessert": ["-->A"],
    "ikura-salmon-pizza": ["-->A"],
  };
  it("the measured changes are exactly the pinned 5 IDs (0 canonical); any other ID or letter change is a STOP", () => {
    const changes = researchLetterChangesAcrossOrders(NEW_IDS, RECIPES as never);
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
    const measured = new Map([...changes].map(([id, list]) => [id, [...new Set(list.map((c) => c.change))].sort()]));
    expect([...measured.keys()].sort()).toEqual(Object.keys(OWNER_APPROVED_B23B).sort());
    for (const [id, expected] of Object.entries(OWNER_APPROVED_B23B)) expect(measured.get(id), id).toEqual([...expected].sort());
  }, 60_000);
});

describe("Hint 5.0: both are key-free targets (CHEESE, STRUCTURE, one SUB_CLASS per topping) and name no recipe", () => {
  it("rung shapes (a cheese base: the existing TQ-1D G7 / G9 gates are unchanged)", () => {
    const shape = (id: string) => buildHint5Ladder(id)?.rungs.map((r) => r.kind).join(",") ?? null;
    expect(shape("nutella-dessert-pizza")).toBe("CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS");
    expect(shape("smore-dessert-pizza")).toBe("CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS");
  });
});
