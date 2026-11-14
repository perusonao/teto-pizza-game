import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, LATE_RECIPES } from "./lateCatalog";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_CATALOG, RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { toppingSizeClass } from "./toppingSizeClass";
import { ordinaryLadderSteps, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { B23_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
import { ordinaryCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
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
 * Expansion Batch 23 (Issue #780; Owner decisions 2026-11-10, Q-1..Q-7): the dessert recipe `apple-cinnamon-dessert` and the material `apple`. PROVISIONAL SPEC: the original pizzadb.jp is NOT confirmed; the evidence is the 172 matrix row apple-cinnamon-dessert-pizzadb.
 * Counts / the generic 58-78 bake window / colours / emoji are GAMEPLAY ASSUMPTIONS. NO_SAUCE is an explicit Owner GAMEPLAY decision (Q-1), NOT a fact about the original (pizzadb.jp lists "デザートソース", unspecified).
 * ORDINARY: apple-cinnamon-dessert (ordinary step 74, apple). The two late desserts (nutella-dessert-pizza, smore-dessert-pizza) and their five materials are NOT in this batch: they hit two existing gates (the `other` family, OD-DH4-2-9; a NO_SAUCE recipe without a cheese, TQ-1D G7 / Hint 5.0 uniformity) and wait for an Owner decision.
 */
const ORDINARY_IDS = ["apple-cinnamon-dessert"] as const;
const LATE_IDS = [] as const;
const NEW_IDS: readonly string[] = [...ORDINARY_IDS, ...LATE_IDS];
const NEW_MATERIALS = ["apple"] as const;
const get = (id: string) => RECIPES.find((r) => r.id === id)! as Recipe;
const idsOf = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const phased = (r: Recipe) => r.requiredIngredients.map((q) => [q.ingredientId, q.minCount, (q as { applicationPhase?: string }).applicationPhase ?? "PRE_BAKE"]);
const jaccard = (a: readonly string[], b: readonly string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
};
const symDiff = (a: readonly string[], b: readonly string[]) => new Set([...a, ...b]).size - [...new Set(a)].filter((x) => b.includes(x)).length;

describe("the recipe (Owner-approved provisional spec; ORDINARY; ladder-credited, key-free; NO_SAUCE is a GAMEPLAY decision)", () => {
  it("apple-cinnamon-dessert: apple 2 / cinnamon 2 / cream-cheese 3 / walnut 2, every piece before the bake (ordinary catalog)", () => {
    const r = get("apple-cinnamon-dessert");
    expect(r.nameJa).toBe("アップルシナモンデザートピザ");
    expect(phased(r)).toEqual([["apple", 2, "PRE_BAKE"], ["cinnamon", 2, "PRE_BAKE"], ["cream-cheese", 3, "PRE_BAKE"], ["walnut", 2, "PRE_BAKE"]]);
  });
  it("placement: apple-cinnamon-dessert is an ORDINARY recipe (NOT a late recipe), with its Discovery target id", () => {
    expect(LATE_RECIPES.map((r) => r.id)).not.toContain("apple-cinnamon-dessert");
    expect(RECIPE_DISCOVERY_TARGET_IDS["apple-cinnamon-dessert" as never]).toBe("apple-cinnamon-dessert-pizzadb");
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
  it("sauces: it is NO_SAUCE (the existing TQ-1D null mapping; Owner Q-1, a GAMEPLAY decision)", () => {
    expect(noSauceRecipeIds()).toEqual(expect.arrayContaining([...NEW_IDS]));
    for (const id of NEW_IDS) expect(getRecipeSauceProfile(id as never), id).toBeNull();
  });
});

describe("the material (Owner decisions 2026-11-10): ids, spec, art, families, sizes, colours, unique emoji", () => {
  const SPEC: Record<string, { category: string; color: string; emoji: string; placement: string; visual: string }> = {
    apple: { category: "topping", color: "#d9453a", emoji: "\u{1F34E}", placement: "scatter", visual: "apple-dessert" },
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
  it("family (Owner Q-4): apple is fruit", () => {
    expect(ingredientAttributeFamily("apple")).toBe("fruit");
  });
  it("size class (Owner Q-4): apple s", () => {
    expect(toppingSizeClass("apple")).toBe("s");
  });
});

describe("the ladder: ordinary step 74, the floors, the batch manifest", () => {
  const steps = DISCOVERY_LADDER.steps;
  it("ordinary steps become 74 (74 apple -> apple-cinnamon-dessert, no star gate); the thirteen late steps move +1 and stay the tail", () => {
    expect(ordinaryLadderSteps(steps)).toHaveLength(80); // Expansion Batch 24 (#780) appended the six ordinary steps 75-80 after step 74 (the late steps moved +6; steps 1-74 are unchanged)
    expect(steps.find((s) => s.step === 72)).toMatchObject({ ingredientIds: ["buffalo-sauce"], keyRecipeId: "buffalo-chicken" });
    expect(steps.find((s) => s.step === 73)).toMatchObject({ ingredientIds: ["brie"], keyRecipeId: "speck-e-brie" });
    expect(steps.find((s) => s.step === 74)).toMatchObject({ ingredientIds: ["apple"], keyRecipeId: "apple-cinnamon-dessert" });
    expect(steps).toHaveLength(95); // Expansion Batch 23-b (#780) appended the nutella / smore late steps after these; Expansion Batch 24 (#780) inserted six ordinary steps 75-80, so the late steps moved +6 (89 -> 95)
    expect(steps.slice(-4, -2).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([
      [92, ["radicchio", "balsamic-vinegar"], "pizza-radicchio-noci"], // (86 before Expansion Batch 24)
      [93, ["truffle"], "black-truffle-pizza"], // (87 before Expansion Batch 24)
    ]);
    for (const s of steps.slice(71)) expect((s as { starGates?: unknown }).starGates, `step ${s.step}`).toBeUndefined();
    expect(LATE_LADDER_STEPS).toHaveLength(15); // (Expansion Batch 23-b: + nutella and smore)
  });
  it("every other ingredient of the recipe is owned before its step (the apple is unlocked at its own step)", () => {
    const owned = (n: number) => new Set<string>([...STARTER_INGREDIENT_IDS, ...steps.slice(0, n).flatMap((s) => s.ingredientIds)]);
    for (const id of NEW_IDS) {
      const stepNo = steps.find((s) => s.keyRecipeId === id)!.step;
      const before = owned(stepNo - 1);
      const here = new Set<string>(steps[stepNo - 1].ingredientIds);
      for (const q of get(id).requiredIngredients) expect(before.has(q.ingredientId) || here.has(q.ingredientId), `${id}/${q.ingredientId}`).toBe(true);
    }
  });
  it("B23 adds no late material: the entitlement floors are unchanged (an ordinary step carries no floor)", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({
      "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68,
      cheddar: 79, lettuce: 79, "tortilla-chips": 79, "okonomiyaki-sauce": 80, cabbage: 80, "bonito-flakes": 80,
      fennel: 83, orange: 83, carrot: 84, "red-cabbage": 84, "sunflower-seeds": 84, radicchio: 85, "balsamic-vinegar": 85, truffle: 86, banana: 88, chocolate: 88, "powdered-sugar": 88, "graham-cracker": 89, marshmallow: 89,
    });
  });
  it("B23_BATCH is LANDED and consistent over the catalog: credit, key ingredient, cohort identity, append-only ladder", () => {
    expect(B23_BATCH.recipes.map((r) => [r.recipeId, r.keyIngredientId, r.ladderCredit])).toEqual([["apple-cinnamon-dessert", "apple", true]]);
    expect(validateBatchManifest(B23_BATCH, ordinaryCatalogView())).toEqual([]);
  });
});

describe("Reference Truth: the non-sauce pieces on the RT-01 slots (a calibrated assignment), no shared slot", () => {
  it.each([["apple-cinnamon-dessert", 9]])("%s: %i pieces", (id, total) => {
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
  it("discovery identity: the ingredient set + sauce + late dimension is unique; the ordinary recipe has no late axis", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const target = (id: string) => RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === id)!;
    expect(target("apple-cinnamon-dessert").capabilities).toEqual([]);
    expect(RECIPE_DISCOVERY_CATALOG.filter((o) => key(o) === key(target("apple-cinnamon-dessert"))).map((o) => o.recipeId)).toEqual(["apple-cinnamon-dessert"]);
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

describe("Free Cooking: a perfect round passes the Completion Gate and discovers the recipe", () => {
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
});

describe("Research: the canonical order changes 0 letters; the non-canonical changes are pinned and Owner-approved per ID (2026-11-10, Q-5)", () => {
  const ladderMaterials = ordinaryLadderSteps(DISCOVERY_LADDER.steps).flatMap((s) => s.ingredientIds);
  const allLadderMaterials = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
  const ORDINARY = ordinaryRecipes(RECIPES);
  const withoutNew = ORDINARY.filter((r) => !NEW_IDS.includes(r.id));
  const withoutNewAll = RECIPES.filter((r) => !NEW_IDS.includes(r.id));
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
   * OWNER-APPROVED PER ID (2026-11-10, Q-5; docs/reports/TETO_EXPANSION-BATCH-23_OwnerDecisionTable_2026-11-10.md section 4): the 8 pre-existing recipes whose letter can change in NON-canonical acquisition orders, with the presented before -> after.
   * The presented measurement assumed the full dessert train (the two late dessert recipes and five late materials were in the population). This batch ships apple-cinnamon-dessert ALONE, so the audit population differs and the (seeded random) measurement differs slightly:
   * the same 8 IDs, 0 canonical changes, but two IDs show ONE letter change the presented table did not list (A->B for pizza-radicchio-noci and spinach-artichoke-pizza), and ikura-salmon-pizza lacks its presented A->B.
   * OWNER-APPROVED (2026-11-10, PR #814): the apple-alone differences (the two additions and ikura's absent A->B) are approved; the canonical order must stay at 0 and any other ID or change is a STOP.
   */
  const PRESENTED_AND_APPROVED: Readonly<Record<string, readonly string[]>> = {
    "ikura-salmon-pizza": ["-->B", "A->B", "B->C"],
    "jalapeno-popper-pizza": ["-->A"],
    "moussaka-style-pizza": ["-->B"],
    "pesto-noci-pizza": ["-->B", "A->B"],
    "pesto-salmone": ["-->B", "B->C", "C->D", "D->E"],
    "pizza-radicchio-noci": ["-->B", "B->C"],
    "speck-e-brie": ["-->B", "B->C", "C->D"],
    "spinach-artichoke-pizza": ["-->B", "B->C", "C->D"],
  };
  const OWNER_APPROVED_EXTRA: Readonly<Record<string, readonly string[]>> = {
    "pizza-radicchio-noci": ["A->B"],
    "spinach-artichoke-pizza": ["A->B"],
  };
  it("the measured changes are the same 8 IDs (0 canonical); every change is in the presented table or is one of the two Owner-approved additions; any other ID or letter change is a STOP", () => {
    const changes = researchLetterChangesAcrossOrders(NEW_IDS, RECIPES.filter((r) => !["nutella-dessert-pizza", "smore-dessert-pizza"].includes(r.id)) as never, 40, 20261105, ["banana", "chocolate", "powdered-sugar", "graham-cracker", "marshmallow"]); // Expansion Batch 23-b (#780) is a LATER batch (its two recipes and five materials are left out): this stays the B23-a shipped-ladder comparison the Owner approved
    expect([...changes.values()].flat().filter((c) => c.canonical)).toEqual([]);
    const measured = new Map([...changes].map(([id, list]) => [id, [...new Set(list.map((c) => c.change))].sort()]));
    expect([...measured.keys()].sort()).toEqual(Object.keys(PRESENTED_AND_APPROVED).sort());
    for (const [id, list] of measured) {
      const allowed = new Set([...PRESENTED_AND_APPROVED[id], ...(OWNER_APPROVED_EXTRA[id] ?? [])]);
      for (const change of list) expect(allowed.has(change), `${id} ${change}`).toBe(true);
    }
    // the exact measured record of this batch (alone): the presented table minus ikura's A->B, plus the two Owner-approved additions
    expect(measured.get("ikura-salmon-pizza")).toEqual(["-->B", "B->C"]);
    expect(measured.get("pizza-radicchio-noci")).toEqual(["-->B", "A->B", "B->C"]);
    expect(measured.get("spinach-artichoke-pizza")).toEqual(["-->B", "A->B", "B->C", "C->D"]);
    for (const id of ["jalapeno-popper-pizza", "moussaka-style-pizza", "pesto-noci-pizza", "pesto-salmone", "speck-e-brie"]) expect(measured.get(id), id).toEqual([...PRESENTED_AND_APPROVED[id]].sort());
  }, 60_000);
});

describe("Hint 5.0: the recipe is a key-free target (CHEESE, STRUCTURE, one SUB_CLASS per topping) and names no recipe", () => {
  it("rung shape", () => {
    const shape = (id: string) => buildHint5Ladder(id)?.rungs.map((r) => r.kind).join(",") ?? null;
    expect(shape("apple-cinnamon-dessert")).toBe("CHEESE,STRUCTURE,SUB_CLASS,SUB_CLASS,SUB_CLASS");
  });
});
