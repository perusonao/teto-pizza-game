import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { resolveShopEntitlement } from "../../state/materialEntitlement";
import { recipeKeyStep } from "../../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "../../state/recipeDiscoveryState";
import { compareHintCandidates, discoverableHintCandidates, selectHintTarget } from "./hintTarget";

const recipe = (id: string): Recipe => RECIPES.find((r) => r.id === id)!;
const LADDER_ORDER = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

function inputsOf(dex: DexState, owned: readonly string[], inventory: Record<string, number>): RecipeDiscoveryInputs {
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory,
  };
}

/** The 25-ladder played in order: `count` recipes discovered, every entitled material bought
 *  with stock 10, except the newest step's materials when `newest` says otherwise. */
function ladderState(count: number, newest: "bought" | "not-bought" | "stock-0" = "bought"): RecipeDiscoveryInputs {
  const dex = discover(LADDER_ORDER.slice(0, count));
  const steps = W1_25_DISCOVERY_LADDER.steps.filter((s) => s.step <= count);
  const newestIds = new Set(steps.filter((s) => s.step === count).flatMap((s) => s.ingredientIds));
  const materials = steps.flatMap((s) => s.ingredientIds);
  const owned = [...STARTER_INGREDIENT_IDS, ...materials.filter((m) => newest !== "not-bought" || !newestIds.has(m))];
  const inventory = Object.fromEntries(materials.map((m) => [m, newest === "stock-0" && newestIds.has(m) ? 0 : 10]));
  return inputsOf(dex, owned, inventory);
}

/** Legacy save shape (15-ladder entitlement union): the first 15 RECIPES discovered and every
 *  material they use owned -- several recipes are DISCOVERABLE at once. */
function legacyState(): RecipeDiscoveryInputs {
  const old15 = RECIPES.slice(0, 15);
  const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
  return inputsOf(
    discover(old15.map((r) => r.id)),
    [...new Set([...STARTER_INGREDIENT_IDS, ...mats])],
    Object.fromEntries(mats.map((m) => [m, 30])),
  );
}

function fake(id: string, ingredientIds: string[]): Recipe {
  return { ...recipe("bismarck"), id: id as RecipeId, requiredIngredients: ingredientIds.map((ingredientId) => ({ ingredientId, minCount: 1 })) };
}

describe("selectHintTarget -- 25-recipe ladder (T-3 / T-4)", () => {
  it.each(Array.from({ length: 25 }, (_, c) => c))("Dex %i: the only target is the next ladder key recipe", (count) => {
    const inputs = ladderState(count);
    const candidates = discoverableHintCandidates(inputs);
    expect(candidates.map((r) => r.id)).toEqual([LADDER_ORDER[count]]);
    expect(selectHintTarget(inputs)).toEqual({ kind: "TARGET", recipeId: LADDER_ORDER[count], source: "auto" });
  });

  it("every target on the ladder is DISCOVERABLE; DISCOVERED / KBMM / UNKNOWN never are", () => {
    for (let count = 0; count <= 25; count += 1) {
      for (const newest of ["bought", "not-bought", "stock-0"] as const) {
        const inputs = ladderState(count, newest);
        const result = selectHintTarget(inputs);
        if (result.kind === "TARGET") expect(recipeDiscoveryState(recipe(result.recipeId), inputs)).toBe("DISCOVERABLE");
        for (const r of discoverableHintCandidates(inputs)) expect(recipeDiscoveryState(r, inputs)).toBe("DISCOVERABLE");
      }
    }
  });

  it.each(Array.from({ length: 24 }, (_, i) => i + 1))("Dex %i without the new material: SHOP_NEW; bought but stock 0: REFILL", (count) => {
    expect(selectHintTarget(ladderState(count, "not-bought"))).toEqual({ kind: "SHOP_NEW" });
    expect(selectHintTarget(ladderState(count, "stock-0"))).toEqual({ kind: "REFILL" });
  });

  it("all 25 discovered: COMPLETE", () => {
    expect(selectHintTarget(ladderState(25))).toEqual({ kind: "COMPLETE" });
  });

  it("a result names no recipe unless it is a target (HintEmpty carries only its kind)", () => {
    for (const newest of ["not-bought", "stock-0"] as const) {
      const result = selectHintTarget(ladderState(8, newest));
      expect(Object.keys(result)).toEqual(["kind"]);
    }
  });
});

describe("selectHintTarget -- order, pinned and sticky (T-4)", () => {
  it("several DISCOVERABLE: sorted by recipeKeyStep, then distinct ingredient count, then RECIPES index", () => {
    const candidates = discoverableHintCandidates(legacyState());
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < candidates.length; i += 1) {
      expect(compareHintCandidates(candidates[i - 1], candidates[i])).toBeLessThan(0);
      expect(recipeKeyStep(candidates[i - 1])).toBeLessThanOrEqual(recipeKeyStep(candidates[i]));
    }
    expect(selectHintTarget(legacyState())).toEqual({ kind: "TARGET", recipeId: candidates[0].id, source: "auto" });
  });

  it("tie-breaks: fewer distinct ingredients first, then declaration order", () => {
    const recipes = [
      fake("fake-a", ["tomato-sauce", "mozzarella", "egg", "basil"]),
      fake("fake-c", ["tomato-sauce", "mozzarella", "egg"]),
      fake("fake-d", ["tomato-sauce", "basil", "egg"]),
      fake("fake-b", ["tomato-sauce", "egg"]),
      fake("fake-starter", ["tomato-sauce", "mozzarella", "basil", "basil"]),
    ];
    const inputs = inputsOf(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "egg"], { egg: 5 });
    expect(discoverableHintCandidates(inputs, recipes).map((r) => r.id)).toEqual(["fake-starter", "fake-b", "fake-c", "fake-d", "fake-a"]);
  });

  it("identical state -> identical target, independent of Dex / owned / inventory ordering", () => {
    const a = legacyState();
    const reversedDex = discover(RECIPES.slice(0, 15).map((r) => r.id).reverse());
    const b: RecipeDiscoveryInputs = {
      dex: reversedDex,
      ownedIngredientIds: [...a.ownedIngredientIds].reverse(),
      unlockedForShopIngredientIds: [...a.unlockedForShopIngredientIds].reverse(),
      inventory: Object.fromEntries(Object.entries(a.inventory).reverse()),
    };
    expect(discoverableHintCandidates(b).map((r) => r.id)).toEqual(discoverableHintCandidates(a).map((r) => r.id));
    expect(selectHintTarget(b)).toEqual(selectHintTarget(a));
    expect(selectHintTarget(a)).toEqual(selectHintTarget(a));
  });

  it("a pinned Dex card that is DISCOVERABLE becomes the target with source dex, over sticky", () => {
    const inputs = legacyState();
    const [first, second] = discoverableHintCandidates(inputs);
    expect(selectHintTarget(inputs, { pinnedRecipeId: second.id })).toEqual({ kind: "TARGET", recipeId: second.id, source: "dex" });
    expect(selectHintTarget(inputs, { pinnedRecipeId: second.id, stickyRecipeId: first.id })).toEqual({
      kind: "TARGET",
      recipeId: second.id,
      source: "dex",
    });
  });

  it("an invalid pin (DISCOVERED / KBMM / UNKNOWN / unknown id) is ignored -> automatic order", () => {
    const inputs = ladderState(3);
    const auto = { kind: "TARGET", recipeId: LADDER_ORDER[3], source: "auto" };
    for (const pinnedRecipeId of ["margherita", "hawaiian", "no-such-recipe", ""]) {
      expect(selectHintTarget(inputs, { pinnedRecipeId })).toEqual(auto);
    }
    const kbmm = ladderState(3, "stock-0");
    expect(recipeDiscoveryState(recipe(LADDER_ORDER[3]), kbmm)).toBe("KNOWN_BUT_MISSING_MATERIAL");
    expect(selectHintTarget(kbmm, { pinnedRecipeId: LADDER_ORDER[3] })).toEqual({ kind: "REFILL" });
  });

  it("sticky keeps a revealed target while DISCOVERABLE, and lets go once it is not", () => {
    const inputs = legacyState();
    const [first, second] = discoverableHintCandidates(inputs);
    expect(selectHintTarget(inputs, { stickyRecipeId: second.id })).toEqual({ kind: "TARGET", recipeId: second.id, source: "auto" });
    const found = { ...inputs, dex: registerScoreToDex(inputs.dex, second.id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex };
    expect(selectHintTarget(found, { stickyRecipeId: second.id })).toEqual({ kind: "TARGET", recipeId: first.id, source: "auto" });
  });
});
