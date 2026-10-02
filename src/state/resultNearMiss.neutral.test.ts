import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { evaluateDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { notebookView } from "../logic/discovery/trialNotebook";
import { discoveredRecipeIds, EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { executionAdviceJa, SAUCE_THIN_ADVICE_JA } from "./executionAdvice";
import { resolveShopEntitlement } from "./materialEntitlement";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { NEAR_MISS_COPY, NEAR_MISS_FAR_GENERIC_COPY, resultNearMiss, type ResultNearMissInput } from "./resultNearMiss";
import { freeRound, ORDINARY, playFreeRound } from "./testSupport/trialNotebookFlow";

/**
 * Near/Far Neutralization Phase 1 (Owner Option B): anti-leak pins for the production `resultNearMiss` and the Trial Notebook
 * record. The RESULT line is a function of the attempt's own outcome kind only -- never of the DISCOVERABLE pool.
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

const NEUTRAL = { kind: "NEUTRAL", textJa: NEAR_MISS_FAR_GENERIC_COPY };
const LEGACY_TEXTS = Object.values(NEAR_MISS_COPY);

// d=1 add, d=1 remove, d=2, far, far with the key material unused, and a sauce-only difference, vs funghi (Dex 3).
const ATTEMPTS: Record<string, string[]> = {
  "d=1 (add one)": ["tomato-sauce", "mozzarella"],
  "d=1 (remove one)": ["tomato-sauce", "mozzarella", "mushroom", "basil"],
  "d=2 (close)": ["tomato-sauce", "mozzarella", "mushroom", "basil", "egg"],
  "far, key unused": ["tomato-sauce", "basil"],
  "sauce only": ["mozzarella", "mushroom"],
};

describe("neutral RESULT line (production resultNearMiss)", () => {
  it.each(Object.entries(ATTEMPTS))("%s: only the neutral generic line, never a legacy near/far line", (_n, ids) => {
    for (const count of [3, 5, 12, 25]) {
      const i = input(count, ids);
      if (i.lastDiscovery?.kind !== "ORIGINAL") continue;
      const line = resultNearMiss(i);
      expect(line).toEqual(NEUTRAL);
      expect(LEGACY_TEXTS).not.toContain(line?.textJa);
    }
  });

  it("pool=1: the same attempt gets the same line whichever recipe is the hidden one", () => {
    const a = input(3, ATTEMPTS["d=1 (add one)"]); // funghi is the only DISCOVERABLE recipe
    const b = input(4, ATTEMPTS["d=1 (add one)"]); // a different single hidden recipe
    expect(a.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(JSON.stringify(resultNearMiss(a))).toBe(JSON.stringify(resultNearMiss(b)));
  });

  it("pool=2+: candidate / ownership / Dex order never changes the line (byte-identical)", () => {
    for (const ids of Object.values(ATTEMPTS)) {
      const base = input(20, ids);
      const owned = [...base.ownedIngredientIds].reverse();
      const inv = Object.fromEntries(Object.entries(base.inventory).reverse());
      const shuffled = { ...base, ownedIngredientIds: owned, inventory: inv, unlockedForShopIngredientIds: [...base.unlockedForShopIngredientIds].reverse() };
      expect(JSON.stringify(resultNearMiss(shuffled))).toBe(JSON.stringify(resultNearMiss(base)));
    }
  });

  it("does not read the pool: an empty pool or a full pool gives the same line", () => {
    const base = input(3, ATTEMPTS["far, key unused"]);
    const empty = { ...base, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], inventory: {} };
    expect(resultNearMiss(empty)).toEqual(resultNearMiss(base));
  });

  it("a known (ALREADY_DISCOVERED) pizza, NEW_DISCOVERY, a failed bake and a non-free round get no line (existing flows kept)", () => {
    const known = input(3, ["tomato-sauce", "mozzarella", "basil"]); // margherita
    expect(known.lastDiscovery?.kind).toBe("ALREADY_DISCOVERED");
    expect(resultNearMiss(known)).toBeNull();
    const fresh = input(3, ["tomato-sauce", "mozzarella", "mushroom"]); // funghi
    expect(fresh.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
    expect(resultNearMiss(fresh)).toBeNull();
    const far = input(3, ATTEMPTS["far, key unused"]);
    expect(resultNearMiss({ ...far, completion: { status: "FAILED" } as never })).toBeNull();
    expect(resultNearMiss({ ...far, freeCook: false })).toBeNull();
  });

  it("no legacy wording anywhere in the neutral line: no 「あと1つ」「かなり近」「足す」「減らす」「新しく入荷」", () => {
    expect(NEUTRAL.textJa).not.toMatch(/あと|近|足す|減ら|入荷|ソースを変え|おしい/);
  });
});

describe("recipe-independent execution feedback is retained", () => {
  it("a thin sauce still gets the sauce advice, independent of the near/far line", () => {
    const thin = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], sauceDeposits: [{ x: 0.5, y: 0.5, r: 0.05, amount: 0.01 }] } as unknown as PizzaState;
    expect(executionAdviceJa(thin)).toBe(SAUCE_THIN_ADVICE_JA);
  });
});

describe("Trial Notebook record (real reducer)", () => {
  it("keeps the player's own attempt facts but stores no near/far / distance / candidate feedback", () => {
    const s = playFreeRound(freeRound(), ORDINARY);
    const rows = notebookView(s.trialNotebook);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ number: 1, retryCount: 0, feedback: null });
    expect(rows[0].combination).toBeDefined();
    const text = JSON.stringify(rows);
    for (const t of LEGACY_TEXTS) expect(text).not.toContain(t);
    expect(text).not.toMatch(/ADD_ONE|REMOVE_ONE|SAUCE_ONLY|CLOSE|FAR|distance|candidate|similar/i);
    for (const r of RECIPES) expect(text).not.toContain(r.id);
  });
});

describe("production Discovery success is unchanged", () => {
  it("the real matcher still reports NEW_DISCOVERY for an exact undiscovered recipe, with the line absent", () => {
    const i = input(3, ["tomato-sauce", "mozzarella", "mushroom"]);
    expect(i.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
    expect(resultNearMiss(i)).toBeNull();
  });
});
