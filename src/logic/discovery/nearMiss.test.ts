import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { resolveShopEntitlement } from "../../state/materialEntitlement";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import type { RecipeDiscoveryInputs } from "../../state/recipeDiscoveryState";
import { buildHintSteps } from "./hintSteps";
import { discoverableHintCandidates, selectHintTarget } from "./hintTarget";
import { evaluateDiscovery, matchDiscovery } from "./matcher";
import { classifyNearMiss, type NearMiss } from "./nearMiss";
import { signatureOfPizza } from "./signature";

const recipe = (id: string): Recipe => RECIPES.find((r) => r.id === id)!;
const LADDER_ORDER = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";

/** A pizza holding exactly `ids` (sauces spread, everything else placed once). */
function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 2, y: 50 })),
    bakeResult: 70,
  };
}
const near = (ids: readonly string[], candidates: readonly string[]): NearMiss | null =>
  classifyNearMiss(signatureOfPizza(pizzaOf(ids)), candidates.map(recipe));

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

function fake(id: string, ingredientIds: string[]): Recipe {
  return { ...recipe("bismarck"), id: id as RecipeId, requiredIngredients: ingredientIds.map((ingredientId) => ({ ingredientId, minCount: 1 })) };
}
const catalogOf = (recipes: readonly Recipe[]) =>
  recipes.map((r) => {
    const items = [...new Set(r.requiredIngredients.map((q) => q.ingredientId))].sort();
    return { recipeId: r.id, items, sauceBase: items.filter(isSauce) };
  });

describe("classifyNearMiss -- classes (T-6 / T-7 / T-8)", () => {
  it("d=0 (exact) -> null: discovery always wins", () => {
    expect(near(["tomato-sauce", "mozzarella", "egg"], ["bismarck"])).toBeNull();
  });

  it("T-6 bismarck set vs breakfast-pizza -> ADD_ONE", () => {
    expect(near(["tomato-sauce", "mozzarella", "egg"], ["breakfast-pizza"])).toEqual({ kind: "ADD_ONE", distance: 1 });
  });

  it("T-7 margherita + egg vs bismarck -> REMOVE_ONE", () => {
    expect(near(["tomato-sauce", "mozzarella", "basil", "egg"], ["bismarck"])).toEqual({ kind: "REMOVE_ONE", distance: 1 });
  });

  it("T-8 tomato + mozzarella + cherry tomato vs genovese -> SAUCE_ONLY", () => {
    expect(near(["tomato-sauce", "mozzarella", "cherry-tomato"], ["genovese"])).toEqual({ kind: "SAUCE_ONLY", distance: 1 });
    // No sauce at all is a sauce mismatch too.
    expect(near(["mozzarella", "cherry-tomato"], ["genovese"])).toEqual({ kind: "SAUCE_ONLY", distance: 1 });
  });

  it("d=2 -> CLOSE (two missing / swap / sauce + one)", () => {
    expect(near(["tomato-sauce", "mozzarella"], ["breakfast-pizza"])).toEqual({ kind: "CLOSE", distance: 2 });
    expect(near(["tomato-sauce", "mozzarella", "egg", "ham"], ["breakfast-pizza"])).toEqual({ kind: "CLOSE", distance: 2 });
    expect(near(["pesto", "mozzarella", "egg"], ["breakfast-pizza"])).toEqual({ kind: "CLOSE", distance: 2 });
  });

  it("d>=3 -> FAR, with a key-unused flag only", () => {
    expect(near(["tomato-sauce", "mozzarella", "basil"], ["meat-lovers"])).toEqual({ kind: "FAR", distance: 5, keyUnused: true });
    expect(near(["tomato-sauce", "mozzarella", "ham"], ["meat-lovers"])).toEqual({ kind: "FAR", distance: 3, keyUnused: false });
  });

  it("no candidate -> null", () => {
    expect(near(["tomato-sauce", "mozzarella"], [])).toBeNull();
  });
});

describe("classifyNearMiss -- candidates, ties and parity (T-10 / T-11)", () => {
  it("the nearest DISCOVERABLE candidate decides", () => {
    // bambino: extra egg (d=1); breakfast-pizza: missing bacon + extra ham, corn (d=3).
    expect(near(["tomato-sauce", "mozzarella", "ham", "corn", "egg"], ["breakfast-pizza", "bambino"])).toEqual({ kind: "REMOVE_ONE", distance: 1 });
  });

  it("an exact match to any candidate wins over a nearer-looking other one", () => {
    expect(near(["tomato-sauce", "mozzarella", "egg"], ["breakfast-pizza", "bismarck"])).toBeNull();
  });

  it("ties follow the hint-target order and ignore the caller's array order", () => {
    const early = fake("fake-early", ["tomato-sauce", "mozzarella", "egg"]); // key step 1
    const late = fake("fake-late", ["pesto", "mozzarella"]); // key step 17
    const recipes = [late, early];
    const options = { catalog: catalogOf(recipes), recipes };
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce", "mozzarella"]));
    expect(classifyNearMiss(sig, [early, late], options)).toEqual({ kind: "ADD_ONE", distance: 1 });
    expect(classifyNearMiss(sig, [late, early], options)).toEqual({ kind: "ADD_ONE", distance: 1 });
  });

  it("T-10 synthetic duplicate identity (AMBIGUOUS for the matcher): exact -> null, near -> one class", () => {
    const a = fake("dup-a", ["tomato-sauce", "mozzarella", "egg"]);
    const b = fake("dup-b", ["tomato-sauce", "egg", "mozzarella"]);
    const options = { catalog: catalogOf([a, b]), recipes: [a, b] };
    const exact = signatureOfPizza(pizzaOf(["tomato-sauce", "mozzarella", "egg"]));
    expect(matchDiscovery(exact, options.catalog.map((t) => ({ ...t, targetId: t.recipeId, capabilities: [], identityDimensions: RECIPE_DISCOVERY_CATALOG[0].identityDimensions, eligibility: { status: "ELIGIBLE" as const } }))).kind).toBe("AMBIGUOUS");
    expect(classifyNearMiss(exact, [a, b], options)).toBeNull();
    expect(classifyNearMiss(signatureOfPizza(pizzaOf(["tomato-sauce", "mozzarella"])), [a, b], options)).toEqual({ kind: "ADD_ONE", distance: 1 });
  });

  it("T-11 a DISCOVERED recipe is never a candidate: its exact set reads as near-miss to the DISCOVERABLE one", () => {
    const dex = discover(["margherita", "bismarck"]);
    const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon"];
    const inputs: RecipeDiscoveryInputs = {
      dex,
      ownedIngredientIds: owned,
      unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
      inventory: { egg: 10, bacon: 10 },
    };
    const candidates = discoverableHintCandidates(inputs);
    expect(candidates.map((r) => r.id)).toEqual(["breakfast-pizza"]);
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce", "mozzarella", "egg"]));
    expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, discoveredRecipeIds(dex)).kind).toBe("ALREADY_DISCOVERED");
    expect(classifyNearMiss(sig, candidates)).toEqual({ kind: "ADD_ONE", distance: 1 });
  });

  it("anti-spoiler: a result carries only kind / distance / keyUnused -- no recipe, no ingredient", () => {
    const strings = [...RECIPES.flatMap((r) => [r.id, r.nameJa]), ...INGREDIENTS.flatMap((i) => [i.id, i.nameJa])];
    const pizzas = [
      ["tomato-sauce", "mozzarella", "egg"],
      ["tomato-sauce", "mozzarella", "basil", "egg"],
      ["tomato-sauce", "mozzarella", "cherry-tomato"],
      ["tomato-sauce", "mozzarella"],
      ["tomato-sauce", "mozzarella", "basil"],
    ];
    for (const ids of pizzas) {
      for (const r of RECIPES) {
        const result = near(ids, [r.id]);
        if (!result) continue;
        expect(Object.keys(result).every((k) => ["kind", "distance", "keyUnused"].includes(k))).toBe(true);
        const json = JSON.stringify(result);
        for (const s of strings) expect(json).not.toContain(`"${s}"`);
      }
    }
  });
});

describe("T-20 25-ladder reachability: H4 + near-miss reach every target, with the real matcher", () => {
  function ladderInputs(count: number): RecipeDiscoveryInputs {
    const dex = discover(LADDER_ORDER.slice(0, count));
    const materials = W1_25_DISCOVERY_LADDER.steps.filter((s) => s.step <= count).flatMap((s) => s.ingredientIds);
    const owned = [...STARTER_INGREDIENT_IDS, ...materials];
    return {
      dex,
      ownedIngredientIds: owned,
      unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
      inventory: Object.fromEntries(materials.map((m) => [m, 10])),
    };
  }

  it.each(Array.from({ length: 25 }, (_, c) => c))("Dex %i", (count) => {
    const inputs = ladderInputs(count);
    const target = selectHintTarget(inputs);
    expect(target).toMatchObject({ kind: "TARGET", recipeId: LADDER_ORDER[count] });
    if (target.kind !== "TARGET") return;
    const r = recipe(target.recipeId);
    const candidates = discoverableHintCandidates(inputs);
    const steps = buildHintSteps(r, { discoveredCount: count });
    const named = steps.flatMap((s) => (s.namedIngredientId ? [s.namedIngredientId] : []));
    const notTomato = steps.some((s) => s.textJa === "ソースはトマトじゃないみたい");
    const discovered = discoveredRecipeIds(inputs.dex);
    const outcome = (ids: readonly string[]) => evaluateDiscovery(signatureOfPizza(pizzaOf(ids)), RECIPE_DISCOVERY_CATALOG, discovered);

    if (count === 0) {
      // Onboarding: every ingredient is named, the named pizza is the discovery.
      expect(outcome(named)).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: r.id });
      return;
    }
    // Everything but one is named: the named-only pizza is one step away, with a direction.
    const first = classifyNearMiss(signatureOfPizza(pizzaOf(named)), candidates);
    expect(first?.distance).toBe(1);
    expect(["ADD_ONE", "SAUCE_ONLY"]).toContain(first?.kind);

    // Trying each owned ingredient of the hinted kind finds exactly one discovery: the target.
    const sauceMissing = first?.kind === "SAUCE_ONLY";
    const pool = inputs.ownedIngredientIds.filter(
      (id) => !named.includes(id) && isSauce(id) === sauceMissing && !(sauceMissing && notTomato && id === "tomato-sauce"),
    );
    const hits = pool.filter((id) => {
      const o = outcome([...named, id]);
      return o.kind === "NEW_DISCOVERY" && o.recipeId === r.id;
    });
    expect(hits).toHaveLength(1);
    expect(pool.length).toBeLessThanOrEqual(inputs.ownedIngredientIds.length);
    for (const id of pool.filter((p) => !hits.includes(p))) {
      expect(classifyNearMiss(signatureOfPizza(pizzaOf([...named, id])), candidates)?.kind).not.toBe("ADD_ONE");
    }
  });
});
