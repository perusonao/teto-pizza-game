import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { LATE_DISCOVERY_TARGET_IDS, LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, LATE_RECIPES } from "./lateCatalog";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_CATALOG, RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { toppingSizeClass } from "./toppingSizeClass";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B22_BATCH, B22_LATE_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
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
import { COMPOSED } from "../logic/catalog/testSupport/composedForBuild";

/**
 * Expansion Batch 22 (Issue #780; Owner approvals 2026-11-09): six recipes and ten materials. PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed; the evidence is the 172 matrix rows
 * (speck-e-brie-pizzadb-p4, buffalo-chicken-pizzadb, pizza-finocchi-salad-pizzadb-p8, pizza-cavolo-carote-pizzadb-p8, pizza-radicchio-noci-pizzadb-p8, black-truffle-pizza-pizzadb-p14). Counts / the generic 58-78 bake window / colours / emoji are GAMEPLAY ASSUMPTIONS.
 * ORDINARY: buffalo-chicken (ordinary step 72, buffalo-sauce, a pre-bake PAINT sauce) and speck-e-brie (ordinary step 73, brie); the order is the REC-04 rule's own (a tie goes to the smaller recipe id). LATE: pizza-finocchi-salad (fennel, orange), pizza-cavolo-carote (carrot, red-cabbage, sunflower-seeds),
 * pizza-radicchio-noci (radicchio, balsamic-vinegar), black-truffle-pizza (truffle), one late step each.
 */
const ORDINARY_IDS = ["speck-e-brie", "buffalo-chicken"] as const;
const LATE_IDS = ["pizza-finocchi-salad", "pizza-cavolo-carote", "pizza-radicchio-noci", "black-truffle-pizza"] as const;
const NEW_IDS: readonly string[] = [...ORDINARY_IDS, ...LATE_IDS];
const NEW_MATERIALS = ["brie", "buffalo-sauce", "fennel", "orange", "carrot", "red-cabbage", "sunflower-seeds", "radicchio", "balsamic-vinegar", "truffle"] as const;
const get = (id: string) => RECIPES.find((r) => r.id === id)! as Recipe;
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const phased = (r: Recipe) => r.requiredIngredients.map((q) => [q.ingredientId, q.minCount, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"]);
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;
function lab(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const [r, g, b] = c;
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

describe("the six recipes (Owner-approved provisional spec; two ORDINARY, four LATE; ladder-credited, key-free)", () => {
  it("speck-e-brie: brie 3 / mozzarella 3 / prosciutto-crudo 2 / walnut 2, every piece before the bake (ordinary catalog)", () => {
    const r = get("speck-e-brie");
    expect(r.nameJa).toBe("スペックエブリー");
    expect(phased(r)).toEqual([["brie", 3, "PRE_BAKE"], ["mozzarella", 3, "PRE_BAKE"], ["prosciutto-crudo", 2, "PRE_BAKE"], ["walnut", 2, "PRE_BAKE"]]);
  });
  it("buffalo-chicken: buffalo-sauce 1 (a PRE-bake PAINT sauce, Owner M7-d: NO POST_BAKE) / mozzarella 3 / gorgonzola 3 / chicken 2 (ordinary catalog)", () => {
    const r = get("buffalo-chicken");
    expect(phased(r)).toEqual([["buffalo-sauce", 1, "PRE_BAKE"], ["mozzarella", 3, "PRE_BAKE"], ["gorgonzola", 3, "PRE_BAKE"], ["chicken", 2, "PRE_BAKE"]]);
    expect(r.requiredIngredients.some((q) => (q as { applicationPhase?: string }).applicationPhase === "POST_BAKE")).toBe(false);
  });
  it("pizza-finocchi-salad / pizza-cavolo-carote / pizza-radicchio-noci / black-truffle-pizza: the Owner-approved sauce layers, bases and POST_BAKE garnishes (D-5: raw leaves, citrus and the truffle after the bake)", () => {
    expect(phased(get("pizza-finocchi-salad"))).toEqual([["olive-oil", 1, "PRE_BAKE"], ["mozzarella", 3, "PRE_BAKE"], ["black-olive", 2, "PRE_BAKE"], ["fennel", 2, "PRE_BAKE"], ["mint", 2, "PRE_BAKE"], ["orange", 2, "POST_BAKE"]]);
    expect(phased(get("pizza-cavolo-carote"))).toEqual([["olive-oil", 1, "PRE_BAKE"], ["mozzarella", 3, "PRE_BAKE"], ["carrot", 2, "PRE_BAKE"], ["sunflower-seeds", 2, "PRE_BAKE"], ["lemon", 2, "POST_BAKE"], ["red-cabbage", 2, "POST_BAKE"]]);
    expect(phased(get("pizza-radicchio-noci"))).toEqual([["olive-oil", 1, "PRE_BAKE"], ["balsamic-vinegar", 1, "PRE_BAKE"], ["mozzarella", 3, "PRE_BAKE"], ["walnut", 2, "PRE_BAKE"], ["radicchio", 2, "POST_BAKE"]]);
    expect(phased(get("black-truffle-pizza"))).toEqual([["mozzarella", 3, "PRE_BAKE"], ["parmigiano", 3, "PRE_BAKE"], ["truffle", 2, "POST_BAKE"]]);
  });
  it("placement: the two ordinary recipes are NOT late recipes; the four late recipes are the tail of the late catalog after okonomiyaki-style-pizza (before Pinsa), with their Discovery target ids", () => {
    for (const id of ORDINARY_IDS) expect(LATE_RECIPES.map((r) => r.id), id).not.toContain(id);
    expect(LATE_RECIPES.map((r) => r.id).slice(6, 13)).toEqual(["tarako-cream-pizza", "taco-pizza", "okonomiyaki-style-pizza", ...LATE_IDS]);
    expect(RECIPE_DISCOVERY_TARGET_IDS["speck-e-brie" as never]).toBe("speck-e-brie-pizzadb-p4");
    expect(RECIPE_DISCOVERY_TARGET_IDS["buffalo-chicken" as never]).toBe("buffalo-chicken-pizzadb");
    expect(LATE_DISCOVERY_TARGET_IDS["pizza-finocchi-salad"]).toBe("pizza-finocchi-salad-pizzadb-p8");
    expect(LATE_DISCOVERY_TARGET_IDS["pizza-cavolo-carote"]).toBe("pizza-cavolo-carote-pizzadb-p8");
    expect(LATE_DISCOVERY_TARGET_IDS["pizza-radicchio-noci"]).toBe("pizza-radicchio-noci-pizzadb-p8");
    expect(LATE_DISCOVERY_TARGET_IDS["black-truffle-pizza"]).toBe("black-truffle-pizza-pizzadb-p14");
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
  it("sauces: speck-e-brie and black-truffle-pizza are NO_SAUCE (the existing TQ-1D null mapping); buffalo-chicken paints buffalo-sauce (PAINT); finocchi / cavolo / radicchio paint olive-oil (PAINT_TEMPORARY, each recipe's OWN mapping); radicchio's balsamic is a second layer scored by presence", () => {
    expect(noSauceRecipeIds()).toEqual(expect.arrayContaining(["speck-e-brie", "black-truffle-pizza"]));
    for (const id of ["buffalo-chicken", ...LATE_IDS.slice(0, 3)]) expect(noSauceRecipeIds(), id).not.toContain(id);
    expect(getRecipeSauceProfile("buffalo-chicken" as never)).toEqual({ recipeId: "buffalo-chicken", ingredientId: "buffalo-sauce", interaction: "PAINT" });
    for (const id of LATE_IDS.slice(0, 3)) expect(getRecipeSauceProfile(id as never), id).toEqual({ recipeId: id, ingredientId: "olive-oil", interaction: "PAINT_TEMPORARY" });
  });
});

describe("the ten materials (Owner decisions 2026-11-09): ids, spec, art, families, sizes, colours, unique emoji", () => {
  const SPEC: Record<string, { category: string; color: string; emoji: string; placement: string; visual?: string }> = {
    brie: { category: "cheese", color: "#f6edc6", emoji: "\u{1F315}", placement: "scatter", visual: "brie-wedge" },
    "buffalo-sauce": { category: "sauce", color: "#ec5a12", emoji: "\u{1F9AC}", placement: "spread" },
    fennel: { category: "topping", color: "#e4edc2", emoji: "\u{1FABB}", placement: "scatter", visual: "fennel-slices" },
    orange: { category: "topping", color: "#f59a1c", emoji: "\u{1F34A}", placement: "scatter", visual: "orange-slices" },
    carrot: { category: "topping", color: "#ee7d28", emoji: "\u{1F955}", placement: "scatter", visual: "carrot-rounds" },
    "red-cabbage": { category: "topping", color: "#9a4a9e", emoji: "\u{1FAD0}", placement: "scatter", visual: "red-cabbage-shreds" },
    "sunflower-seeds": { category: "topping", color: "#e6d49a", emoji: "\u{1F33B}", placement: "scatter", visual: "sunflower-kernels" },
    radicchio: { category: "topping", color: "#a42a40", emoji: "\u{1F339}", placement: "scatter", visual: "radicchio-leaf" },
    truffle: { category: "topping", color: "#4a382e", emoji: "\u{1F344}\u{200D}\u{1F7EB}", placement: "scatter", visual: "truffle-shavings" },
    "balsamic-vinegar": { category: "sauce", color: "#3c1a4a", emoji: "\u{1F3FA}", placement: "spread" },
  };
  it("each is exactly one ingredient row, ladder-gated (never a Starter), with the approved category / colour / emoji / placement and the dedicated #797 art where one exists (buffalo-sauce and balsamic-vinegar have none: their emoji is displayed)", () => {
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
  it("families (Owner): truffle vegetable, sunflower-seeds spice (never `other`, OD-DH4-2-9), fennel / carrot / red-cabbage / radicchio vegetable, orange fruit; cheese and sauces have none", () => {
    expect([ingredientAttributeFamily("truffle"), ingredientAttributeFamily("sunflower-seeds"), ingredientAttributeFamily("fennel"), ingredientAttributeFamily("carrot"), ingredientAttributeFamily("red-cabbage"), ingredientAttributeFamily("radicchio"), ingredientAttributeFamily("orange")]).toEqual(["vegetable", "spice", "vegetable", "vegetable", "vegetable", "vegetable", "fruit"]);
    for (const id of ["brie", "buffalo-sauce", "balsamic-vinegar"]) expect(ingredientAttributeFamily(id), id).toBeNull();
  });
  it("size classes (Owner): truffle xs, sunflower-seeds xs, brie l; fennel s / orange s / carrot s / red-cabbage s / radicchio m", () => {
    expect([toppingSizeClass("truffle"), toppingSizeClass("sunflower-seeds"), toppingSizeClass("brie"), toppingSizeClass("fennel"), toppingSizeClass("orange"), toppingSizeClass("carrot"), toppingSizeClass("red-cabbage"), toppingSizeClass("radicchio")]).toEqual(["xs", "xs", "l", "s", "s", "s", "s", "m"]);
  });
  it("the two new sauces stay at least dE 25 from every other sauce (late4 precedent; measured: buffalo-sauce nearest tomato-sauce 26.0, balsamic-vinegar nearest soy-sauce 37.3)", () => {
    for (const id of ["buffalo-sauce", "balsamic-vinegar"]) {
      for (const other of INGREDIENTS.filter((i) => i.category === "sauce" && i.id !== id)) expect(deltaE(getIngredient(id)!.color, other.color), `${id} vs ${other.id}`).toBeGreaterThanOrEqual(25);
    }
  });
});

describe("the ladder: ordinary steps 72 / 73, four new late steps, the floors, the batch manifests", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("ordinary steps become 73 (72 buffalo-sauce -> buffalo-chicken, 73 brie -> speck-e-brie, no star gate); the nine earlier late steps move +2 (derived 75-83 -> kept as a tail); four new late steps are the tail", () => {
    expect(ordinaryLadderSteps(steps)).toHaveLength(COMPOSED.ordinarySteps.length); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
    expect(steps.find((s) => s.step === 72)).toMatchObject({ ingredientIds: ["buffalo-sauce"], keyRecipeId: "buffalo-chicken" }); // the REC-04 rule's own order: both need one new material, the tie goes to the smaller recipe id
    expect(steps.find((s) => s.step === 73)).toMatchObject({ ingredientIds: ["brie"], keyRecipeId: "speck-e-brie" });
    expect(steps).toHaveLength(COMPOSED.steps.length); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
    const B22_LATE_KEYS = ["taco-pizza", "okonomiyaki-style-pizza", ...LATE_IDS];
    expect(B22_LATE_KEYS.map((key) => { const s = steps.find((x) => x.keyRecipeId === key)!; return [s.step, s.ingredientIds, s.keyRecipeId]; })).toEqual([
      [COMPOSED.stepOfKey("taco-pizza"), ["cheddar", "lettuce", "tortilla-chips"], "taco-pizza"],
      [COMPOSED.stepOfKey("okonomiyaki-style-pizza"), ["okonomiyaki-sauce", "cabbage", "bonito-flakes"], "okonomiyaki-style-pizza"],
      [COMPOSED.stepOfKey("pizza-finocchi-salad"), ["fennel", "orange"], "pizza-finocchi-salad"],
      [COMPOSED.stepOfKey("pizza-cavolo-carote"), ["carrot", "red-cabbage", "sunflower-seeds"], "pizza-cavolo-carote"],
      [COMPOSED.stepOfKey("pizza-radicchio-noci"), ["radicchio", "balsamic-vinegar"], "pizza-radicchio-noci"],
      [COMPOSED.stepOfKey("black-truffle-pizza"), ["truffle"], "black-truffle-pizza"],
    ]);
    for (const s of steps.slice(71)) expect((s as { starGates?: unknown }).starGates, `step ${s.step}`).toBeUndefined();
    expect(LATE_LADDER_STEPS.filter((s) => (LATE_IDS as readonly string[]).includes(s.keyRecipeId)).map((s) => s.keyRecipeId)).toEqual([...LATE_IDS]);
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
  it("the entitlement floors are the ladder numbers at the moment of shipping (83-86) and every older floor is unchanged", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual(COMPOSED.floors); // R-1 (#780): composed from the frozen baseline and the landed specs (composedCatalog.ts); a landing train needs no edit here.
  });
  it("B22_BATCH (ordinary) and B22_LATE_BATCH (late) are LANDED and consistent over the catalog: credit, key ingredient, cohort identity, append-only ladder", () => {
    expect(B22_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([["buffalo-chicken", "buffalo-sauce", true], ["speck-e-brie", "brie", true]]);
    expect(B22_LATE_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([["pizza-finocchi-salad", "orange", true], ["pizza-cavolo-carote", "sunflower-seeds", true], ["pizza-radicchio-noci", "balsamic-vinegar", true], ["black-truffle-pizza", "truffle", true]]);
    expect(B22_LATE_BATCH.acceptedLetterShifts).toBeUndefined();
    expect(validateBatchManifest(B22_LATE_BATCH, productionCatalogView())).toEqual([]);
  });
});

describe("Reference Truth: the non-sauce pieces on the RT-01 slots (a calibrated assignment), no shared slot", () => {
  it.each([["pizza-finocchi-salad", 11], ["pizza-cavolo-carote", 11], ["pizza-radicchio-noci", 7], ["black-truffle-pizza", 8], ["speck-e-brie", 10], ["buffalo-chicken", 8]])("%s: %i pieces", (id, total) => {
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
  it("discovery identity: each ingredient set + sauce + late dimension is unique; the late axis is on the POST_BAKE garnishes; the ordinary ones have no late axis", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const target = (id: string) => RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === id)!;
    expect(target("pizza-finocchi-salad").identityDimensions.late).toEqual([["POST_BAKE", ["orange"]]]);
    expect(target("pizza-cavolo-carote").identityDimensions.late).toEqual([["POST_BAKE", ["lemon", "red-cabbage"]]]);
    expect(target("pizza-radicchio-noci").identityDimensions.late).toEqual([["POST_BAKE", ["radicchio"]]]);
    expect(target("black-truffle-pizza").identityDimensions.late).toEqual([["POST_BAKE", ["truffle"]]]);
    for (const id of LATE_IDS) expect(target(id).capabilities, id).toEqual(["LATE_ADDITION"]);
    for (const id of ORDINARY_IDS) expect(target(id).capabilities, id).toEqual([]);
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
  const all = reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `b22-${id}-${gi}-${i}`, ingredientId: g.ingredientId, x: p.x, y: p.y })));
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
   * PENDING OWNER APPROVAL (2026-11-09): the measured non-canonical changes of the SHIPPED-LADDER audit (the audit's default 40 seeded random orders), pre-existing recipe -> the distinct letter changes. NOT approved yet: the Owner approves per ID
   * (docs/reports/TETO_B22_Result_*.md lists them); any difference from this pin is a new STOP. The what-if measured before the implementation (docs/reports/data/TETO_B22_research-what-if.json, with ordinary steps 72 brie / 73 buffalo-sauce) gave the same 35 IDs; with the REC-04 rule's own step order (72 buffalo-sauce / 73 brie) two IDs, frango-catupiry and curry-pizza-japan, show one more letter step each.
   */
  const PENDING_OWNER_APPROVAL: Readonly<Record<string, readonly string[]>> = {
    "baba-ganoush-pizza": ["-->B", "B->C", "F->G", "G->I", "I->K", "J->L", "K->M", "L->N", "L->O"],
    "bacalhau": ["-->A"],
    "bbq-chicken-pizza": ["-->A"],
    "boscaiola": ["-->A", "-->B", "A->B", "B->C", "D->E", "E->F", "F->G"],
    "brazilian-calabresa": ["-->A"],
    "calabresa-argentina": ["-->A"],
    "capricciosa": ["-->A"],
    "curry-pizza-japan": ["-->B", "B->C", "C->D", "D->E", "E->F"],
    "eggplant-ricotta-pizza": ["-->A", "-->B", "B->C", "F->G", "H->I"],
    "frango-catupiry": ["-->B", "B->C", "C->D", "D->E", "E->F", "F->G"],
    "fugazza": ["-->A", "-->B", "A->B", "B->C", "C->D", "D->E", "E->F"],
    "grandma-pizza": ["-->A", "-->B", "A->B", "B->C", "C->D", "E->F", "G->H"],
    "jamaican-jerk-chicken-pizza": ["-->B", "A->B", "C->D"],
    "new-haven-apizza": ["-->A"],
    "palmito-pizza": ["-->A"],
    "parmigiana-pizza": ["-->B", "B->C", "D->E"],
    "pesto-burrata-pizza": ["-->A", "-->B", "B->C", "D->E", "G->I", "H->I", "I->K", "J->K", "J->L"],
    "pesto-noci-pizza": ["-->A", "-->B", "B->C"],
    "pesto-pollo": ["-->B", "A->B", "B->C", "C->D", "D->E"],
    "pesto-salmone": ["-->B", "B->C"],
    "pesto-tonno": ["-->A"],
    "pizza-alla-crudaiola": ["-->A", "-->B", "A->B", "B->C", "C->D"],
    "pizza-bianca": ["-->A", "-->B", "A->B", "B->C", "C->D", "D->E"],
    "pizza-bianca-ricotta": ["B->C", "C->D", "D->E", "E->F", "F->H", "H->J", "I->J", "I->K", "J->L", "K->M", "K->N"],
    "pizza-feta-eliniki": ["-->A", "-->B", "B->C", "F->H", "G->H", "H->I", "H->J", "I->J", "I->K"],
    "pizza-portuguesa": ["-->A"],
    "prosciutto-funghi": ["-->A"],
    "puttanesca-pizza": ["-->A"],
    "quattro-formaggi": ["-->A", "-->B", "A->B", "B->C"],
    "reina-pepiada-pizza": ["-->A"],
    "shirasu-pizza": ["-->B", "A->B"],
    "spinach-artichoke-pizza": ["-->B", "A->B", "B->C", "C->D"],
    "supreme-pizza": ["-->A"],
    "veggie-supreme-pizza": ["-->A"],
    "vongole": ["B->C", "C->D", "F->G", "H->J", "J->L", "L->N", "M->O", "M->P"],
  };
  it("the measured changes are exactly the pinned 35 IDs (0 canonical); any other ID or letter change is a STOP", () => {
    // Expansion Batch 23 and 23-b (#780) are LATER batches: their recipes and materials are left out, so this stays the Batch 22 shipped-ladder comparison the Owner approved.
    const changes = researchLetterChangesAcrossOrders(NEW_IDS, RECIPES.filter((r) => !["apple-cinnamon-dessert", "nutella-dessert-pizza", "smore-dessert-pizza"].includes(r.id)) as never, 40, 20261105, ["apple", "banana", "chocolate", "powdered-sugar", "graham-cracker", "marshmallow"]);
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
    const measured = new Map([...changes].map(([id, list]) => [id, [...new Set(list.map((c) => c.change))].sort()]));
    expect([...measured.keys()].sort()).toEqual(Object.keys(PENDING_OWNER_APPROVAL).sort());
    for (const [id, expected] of Object.entries(PENDING_OWNER_APPROVAL)) expect(measured.get(id), id).toEqual([...expected].sort());
  }, 60_000);
});

describe("Hint 5.0: all six are key-free targets (SAUCE where a sauce exists, [CHEESE,] STRUCTURE, one SUB_CLASS per topping) and name no recipe", () => {
  it("rung shapes", () => {
    const shape = (id: string) => buildHint5Ladder(id)?.rungs.map((r) => r.kind).join(",") ?? null;
    expect(shape("speck-e-brie")).toBe("CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS");
    expect(shape("buffalo-chicken")).toBe("SAUCE,CHEESE,STRUCTURE,SUB_CLASS");
    expect(shape("pizza-finocchi-salad")).toBe("SAUCE,CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS");
    expect(shape("pizza-cavolo-carote")).toBe("SAUCE,CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS,SUB_CLASS");
    expect(shape("pizza-radicchio-noci")).toBe("SAUCE,CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS");
    expect(shape("black-truffle-pizza")).toBe("CHEESE,STRUCTURE,SUB_CLASS");
  });
});
