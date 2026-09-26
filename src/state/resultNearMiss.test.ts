import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { evaluateDiscovery, type DiscoveryOutcome } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { hintSheetView } from "./discoveryHint";
import { resolveShopEntitlement } from "./materialEntitlement";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { NEAR_MISS_COPY, resultNearMiss, type ResultNearMissInput } from "./resultNearMiss";

/**
 * Discovery Hint 2.0 (Issue #229, 229-C): which "おしい" line a Free Cooking RESULT shows, on the
 * real 25-recipe data and the real matcher (the outcome is always `evaluateDiscovery`'s own).
 */

const LADDER_ORDER = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 3, y: 50 })),
    bakeResult: 70,
  };
}

/** The ladder played to `count` discoveries, all its materials owned; the pizza's outcome comes
 *  from the real matcher unless `outcome` overrides it. */
function input(count: number, ids: readonly string[], over: Partial<ResultNearMissInput> = {}): ResultNearMissInput {
  const dex = discover(LADDER_ORDER.slice(0, count));
  const materials = W1_25_DISCOVERY_LADDER.steps.filter((s) => s.step <= count).flatMap((s) => s.ingredientIds);
  const owned = [...STARTER_INGREDIENT_IDS, ...materials];
  const pizza = pizzaOf(ids);
  return {
    freeCook: true,
    completion: { status: "PASS" },
    lastDiscovery: evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, discoveredRecipeIds(dex)),
    pizza,
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(materials.map((m) => [m, 10])),
    ...over,
  };
}

const outcomeKind = (i: ResultNearMissInput) => i.lastDiscovery?.kind;

describe("ORIGINAL results (Dex 3: funghi is today's only DISCOVERABLE recipe)", () => {
  it.each([
    ["ADD_ONE", ["tomato-sauce", "mozzarella"], NEAR_MISS_COPY.ADD_ONE],
    ["REMOVE_ONE", ["tomato-sauce", "mozzarella", "mushroom", "basil"], NEAR_MISS_COPY.REMOVE_ONE],
    ["CLOSE", ["tomato-sauce", "mozzarella", "mushroom", "basil", "egg"], NEAR_MISS_COPY.CLOSE],
    ["FAR, key material unused", ["tomato-sauce", "basil"], NEAR_MISS_COPY.FAR_KEY_UNUSED],
  ] as const)("%s", (_kind, ids, text) => {
    const i = input(3, ids);
    expect(outcomeKind(i)).toBe("ORIGINAL");
    expect(resultNearMiss(i)?.textJa).toBe(text);
  });

  it("SAUCE_ONLY (Dex 18: genovese)", () => {
    const i = input(18, ["tomato-sauce", "mozzarella", "cherry-tomato"]);
    expect(outcomeKind(i)).toBe("ORIGINAL");
    expect(resultNearMiss(i)).toEqual({ kind: "SAUCE_ONLY", textJa: NEAR_MISS_COPY.SAUCE_ONLY });
  });

  it("FAR with the key material used: no line", () => {
    const i = input(8, ["tomato-sauce", "mozzarella", "ham"]); // meat-lovers is 3 away
    expect(outcomeKind(i)).toBe("ORIGINAL");
    expect(resultNearMiss(i)).toBeNull();
  });
});

describe("no line", () => {
  it("FAILED (OD-HINT-5 OFF), even one ingredient away", () => {
    const i = input(3, ["tomato-sauce", "mozzarella"], { completion: { status: "FAILED", reason: "UNDERBAKED", failures: [] } as never });
    expect(resultNearMiss(i)).toBeNull();
  });

  it("AMBIGUOUS", () => {
    const ambiguous: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["a", "b"] };
    expect(resultNearMiss(input(3, ["tomato-sauce", "mozzarella"], { lastDiscovery: ambiguous }))).toBeNull();
  });

  it("INCOMPLETE_MATCH (its copy is ResultPanel's)", () => {
    const incomplete: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: "funghi", targetId: "shipped:funghi" };
    expect(resultNearMiss(input(3, ["tomato-sauce", "mozzarella", "mushroom"], { lastDiscovery: incomplete }))).toBeNull();
  });

  it("NEW_DISCOVERY", () => {
    const i = input(3, ["tomato-sauce", "mozzarella", "mushroom"]);
    expect(outcomeKind(i)).toBe("NEW_DISCOVERY");
    expect(resultNearMiss(i)).toBeNull();
  });

  it("a guided (non-Free-Cooking) round", () => {
    expect(resultNearMiss(input(3, ["tomato-sauce", "mozzarella"], { freeCook: false }))).toBeNull();
  });

  it("nothing DISCOVERABLE (the new material out of stock)", () => {
    const i = input(3, ["tomato-sauce", "mozzarella"]);
    expect(resultNearMiss({ ...i, inventory: { ...i.inventory, mushroom: 0 } })).toBeNull();
  });
});

describe("ALREADY_DISCOVERED", () => {
  it("d=1 to today's recipe: one extra line (bismarck made at Dex 2 -> breakfast-pizza)", () => {
    const i = input(2, ["tomato-sauce", "mozzarella", "egg"]);
    expect(outcomeKind(i)).toBe("ALREADY_DISCOVERED");
    expect(resultNearMiss(i)).toEqual({ kind: "ADD_ONE", textJa: NEAR_MISS_COPY.ADD_ONE });
  });

  it("d>=2: nothing (margherita made at Dex 3 is 2 away from funghi)", () => {
    const i = input(3, ["tomato-sauce", "mozzarella", "basil"]);
    expect(outcomeKind(i)).toBe("ALREADY_DISCOVERED");
    expect(resultNearMiss(i)).toBeNull();
  });
});

describe("25-recipe ladder, table-driven", () => {
  it.each(Array.from({ length: 24 }, (_, i) => i + 1))("Dex %i: today's recipe minus its last topping reads ADD_ONE", (count) => {
    const target = RECIPES.find((r) => r.id === LADDER_ORDER[count])!;
    const items = [...new Set(target.requiredIngredients.map((r) => r.ingredientId))];
    const lastNonSauce = [...items].reverse().find((id) => !isSauce(id))!;
    const i = input(count, items.filter((id) => id !== lastNonSauce));
    expect(["ORIGINAL", "ALREADY_DISCOVERED"]).toContain(outcomeKind(i));
    expect(resultNearMiss(i)).toEqual({ kind: "ADD_ONE", textJa: NEAR_MISS_COPY.ADD_ONE });
  });

  it("every line is fixed copy: no recipe name / id, no ingredient name / id", () => {
    for (const text of Object.values(NEAR_MISS_COPY)) {
      for (const r of RECIPES) {
        expect(text).not.toContain(r.nameJa);
        expect(text).not.toContain(r.id);
      }
      for (const ing of INGREDIENTS) {
        expect(text).not.toContain(ing.nameJa);
        expect(text).not.toContain(ing.id);
      }
    }
  });
});

describe("the RESULT 「💡 ヒントを見る」 path (App: RETRY_SAME_RECIPE then SHOW_HINT)", () => {
  it("cooks freely again with the sheet open on today's target -- nothing pinned from the result", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon"];
    const dex = discover(["margherita", "bismarck"]);
    let s = gameReducer(createInitialGameState(dex, owned, 0, { egg: 10, bacon: 10 }, [], ["egg", "bacon"]), { type: "START_FREE_COOK" });
    s = { ...s, pizza: pizzaOf(["tomato-sauce", "mozzarella", "egg"]) };
    s = gameReducer(s, { type: "START_BAKE" });
    s = gameReducer(s, { type: "CONFIRM_BAKE", value: 70 });
    while (s.phase !== "RESULT") s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    s = gameReducer(s, { type: "REGISTER_TO_DEX" }); // App.tsx dispatches it right after CONFIRM_BAKE
    expect(s.freeCook).toBe(true);
    expect(s.lastDiscovery?.kind).toBe("ALREADY_DISCOVERED");
    expect(resultNearMiss(s)?.kind).toBe("ADD_ONE");

    s = gameReducer(s, { type: "RETRY_SAME_RECIPE" });
    s = gameReducer(s, { type: "SHOW_HINT" });
    expect(s.phase).toBe("PREPARE");
    expect(s.freeCook).toBe(true);
    expect(s.hintSheetOpen).toBe(true);
    expect(s.hintSession).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0 });
    expect(hintSheetView(s)).toMatchObject({ kind: "TARGET", canRevealMore: true });
  });
});
