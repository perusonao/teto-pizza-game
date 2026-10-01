import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { evaluateDiscovery, type DiscoveryOutcome } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { NEAR_MISS_COPY, NEAR_MISS_FAR_GENERIC_COPY, nearMissLine, resultNearMiss, RESULT_FAR_GENERIC_ENABLED, type ResultNearMissInput } from "./resultNearMiss";

/**
 * Original Pizza Recovery P2 on the REAL 25-recipe catalog and the real matcher: no-sauce wording,
 * the (OFF) generic FAR line, isolation, the closed copy set, and the truthfulness of every
 * directional line (each one is followed to a real discovery).
 */
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const ALL_IDS: string[] = INGREDIENTS.map((i) => i.id);

function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 3, y: 50 })),
    bakeResult: 70,
  };
}

/** Empty Dex, every material owned and in stock: every recipe is DISCOVERABLE. */
function fullOwnership(ids: readonly string[], over: Partial<ResultNearMissInput> = {}): ResultNearMissInput {
  const pizza = pizzaOf(ids);
  return {
    freeCook: true,
    completion: { status: "PASS" },
    lastDiscovery: evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, []),
    pizza,
    dex: EMPTY_DEX,
    ownedIngredientIds: ALL_IDS,
    unlockedForShopIngredientIds: ALL_IDS,
    inventory: Object.fromEntries(ALL_IDS.map((id) => [id, 10])),
    ...over,
  };
}
const outcomeOf = (ids: readonly string[]) => evaluateDiscovery(signatureOfPizza(pizzaOf(ids)), RECIPE_DISCOVERY_CATALOG, []);

describe("P2-B no-sauce wording", () => {
  it("a pizza with no sauce, one sauce short of margherita, keeps the directional sauce line (real catalog)", () => {
    const i = fullOwnership(["mozzarella", "basil"]);
    expect(i.lastDiscovery?.kind).toBe("ORIGINAL");
    // ADD step: "change the sauce" is true for a sauce-less pizza and keeps the hint-reachability contract
    expect(resultNearMiss(i)).toEqual({ kind: "SAUCE_ONLY", textJa: NEAR_MISS_COPY.SAUCE_ONLY });
  });

  it("a wrong sauce keeps the 'change the sauce' line (real catalog)", () => {
    const i = fullOwnership(["pesto", "mozzarella", "basil"]);
    expect(i.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(resultNearMiss(i)).toEqual({ kind: "SAUCE_ONLY", textJa: NEAR_MISS_COPY.SAUCE_ONLY });
  });

  it("a sauce-less TARGET (REMOVE step) is never told to 'change the sauce': the generic remove line, no sauce word", () => {
    const line = nearMissLine({ kind: "SAUCE_ONLY", distance: 1, sauceStep: "REMOVE" }, false);
    expect(line).toEqual({ kind: "REMOVE_ONE", textJa: NEAR_MISS_COPY.REMOVE_ONE });
    expect(line!.textJa).not.toContain("ソース");
  });

  it("ADD and CHANGE steps use the existing sauce line; every other class maps to its own line", () => {
    for (const step of ["ADD", "CHANGE"] as const) {
      expect(nearMissLine({ kind: "SAUCE_ONLY", distance: 1, sauceStep: step }, false)).toEqual({ kind: "SAUCE_ONLY", textJa: NEAR_MISS_COPY.SAUCE_ONLY });
    }
    for (const kind of ["ADD_ONE", "REMOVE_ONE", "CLOSE"] as const) {
      expect(nearMissLine({ kind, distance: kind === "CLOSE" ? 2 : 1 }, false)).toEqual({ kind, textJa: NEAR_MISS_COPY[kind] });
    }
  });

  it("a known pizza only ever gets a distance-1 line", () => {
    expect(nearMissLine({ kind: "CLOSE", distance: 2 }, true)).toBeNull();
    expect(nearMissLine({ kind: "ADD_ONE", distance: 1 }, true)).not.toBeNull();
    expect(nearMissLine({ kind: "FAR", distance: 4, keyUnused: true }, true)).toBeNull();
  });
});

describe("P2-C generic FAR line (OD-P2-2 = ON)", () => {
  // margherita family, three or more away from everything
  const far = ["tomato-sauce", "ham", "pineapple", "onion", "corn", "mushroom", "egg"];

  it("is ON in production: a far ORIGINAL with no nearer line gets exactly the generic sentence", () => {
    expect(RESULT_FAR_GENERIC_ENABLED).toBe(true);
    const i = fullOwnership(far);
    expect(i.lastDiscovery?.kind).toBe("ORIGINAL");
    const line = resultNearMiss(i);
    expect(line).not.toBeNull();
    expect(line!.kind).toBe("FAR");
    expect([NEAR_MISS_FAR_GENERIC_COPY, NEAR_MISS_COPY.FAR_KEY_UNUSED]).toContain(line!.textJa);
  });

  it("the generic sentence really appears (some far ORIGINAL has no key-unused nudge) and holds no digit, recipe or component", () => {
    const pool = ["egg", "ham", "pineapple", "corn", "onion", "mushroom", "bacon", "sausage", "tuna", "anchovy", "garlic"];
    const texts = new Set<string>();
    for (const a of pool) {
      for (const b of pool) {
        const i = fullOwnership(["tomato-sauce", a, b, "corn", "pineapple", "egg"]);
        if (i.lastDiscovery?.kind !== "ORIGINAL") continue;
        const line = resultNearMiss(i);
        if (line?.kind === "FAR") texts.add(line.textJa);
      }
    }
    expect(texts.has(NEAR_MISS_FAR_GENERIC_COPY)).toBe(true);
    expect(NEAR_MISS_FAR_GENERIC_COPY).not.toMatch(/[0-9０-９]|ソース|チーズ|トッピング|距離|近い|遠い/);
  });

  it("the switch can still turn it off (rollback path): silence returns unless the key-unused nudge applies", () => {
    const i = fullOwnership(far);
    const off = resultNearMiss(i, { farGeneric: false });
    expect(off === null || off.textJa === NEAR_MISS_COPY.FAR_KEY_UNUSED).toBe(true);
  });

  it("the generic line is only ever for a far ORIGINAL or INCOMPLETE_MATCH: never a known pizza, a failed bake, a guided round, or a non-ORIGINAL outcome", () => {
    const i = fullOwnership(far);
    const ambiguous: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["a", "b"] };
    for (const over of [
      { freeCook: false },
      { completion: { status: "FAILED", reason: "UNDERBAKED", failures: [] } as never },
      { lastDiscovery: ambiguous },
      { lastDiscovery: { kind: "NEW_DISCOVERY", recipeId: "funghi", targetId: "shipped:funghi" } as DiscoveryOutcome },
      { lastDiscovery: { kind: "ALREADY_DISCOVERED", recipeId: "funghi", targetId: "shipped:funghi" } as DiscoveryOutcome },
    ] as Partial<ResultNearMissInput>[]) {
      expect(resultNearMiss({ ...i, ...over })).toBeNull();
    }
  });

  it("a nearer line always wins over the generic one (ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE are unchanged)", () => {
    expect(resultNearMiss(fullOwnership(["tomato-sauce", "mozzarella"]))!.kind).not.toBe("FAR");
    expect(resultNearMiss(fullOwnership(["pesto", "mozzarella", "basil"]))).toEqual({ kind: "SAUCE_ONLY", textJa: NEAR_MISS_COPY.SAUCE_ONLY });
  });

  it("nothing DISCOVERABLE -> no generic line either (it never claims there is something to find)", () => {
    let allFound: DexState = EMPTY_DEX;
    for (const r of RECIPES) {
      allFound = registerScoreToDex(allFound, r.id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
    }
    const i = fullOwnership(far, { dex: allFound, lastDiscovery: { kind: "ORIGINAL", blockedTargetIds: [] } });
    expect(resultNearMiss(i)).toBeNull();
  });

  it("the generic line carries no distance, no recipe and no ingredient", () => {
    const text = NEAR_MISS_FAR_GENERIC_COPY;
    expect(text).not.toMatch(/[0-9０-９]/);
    for (const s of [...RECIPES.flatMap((r) => [r.id, r.nameJa]), ...INGREDIENTS.flatMap((x) => [x.id, x.nameJa])]) expect(text).not.toContain(s);
  });
});

describe("P2-B a known (ALREADY_DISCOVERED) pizza never gets a FAR line", () => {
  it("even where the same pizza as an ORIGINAL would get the key-unused nudge", () => {
    const pool = ["egg", "ham", "pineapple", "corn", "onion", "mushroom", "basil", "garlic", "oregano", "bacon", "sausage", "tuna", "anchovy"];
    let found: string[] | null = null;
    for (const id of pool) {
      const ids = ["tomato-sauce", id, "pineapple", "corn"];
      const line = resultNearMiss(fullOwnership(ids));
      if (line?.kind === "FAR") {
        found = ids;
        break;
      }
    }
    expect(found, "a far ORIGINAL with the key-unused nudge exists in the pool").not.toBeNull();
    const known: DiscoveryOutcome = { kind: "ALREADY_DISCOVERED", recipeId: "margherita", targetId: "shipped:margherita" };
    expect(resultNearMiss(fullOwnership(found!, { lastDiscovery: known }))).toBeNull();
    expect(resultNearMiss(fullOwnership(found!, { lastDiscovery: known }), { farGeneric: true })).toBeNull();
  });
});

describe("P2-D no component feedback, no Hint 5.0 substitution", () => {
  const copies = [...Object.values(NEAR_MISS_COPY), NEAR_MISS_FAR_GENERIC_COPY];

  it("the copy set is closed and names no recipe and no ingredient", () => {
    expect(copies).toHaveLength(6);
    for (const text of copies) {
      for (const s of [...RECIPES.flatMap((r) => [r.id, r.nameJa]), ...INGREDIENTS.flatMap((x) => [x.id, x.nameJa])]) expect(text).not.toContain(s);
    }
  });

  it("only SAUCE_ONLY (existing) uses a component word; nothing says cheese, topping or the key", () => {
    for (const text of copies) expect(text).not.toMatch(/チーズ|トッピング|具材|cheese/);
    expect(copies.filter((t) => t.includes("ソース"))).toEqual([NEAR_MISS_COPY.SAUCE_ONLY]);
  });

  it("the result does not depend on hint facts, Pitz or ladder state (the input type has none, and extras are ignored)", () => {
    const i = fullOwnership(["tomato-sauce", "mozzarella"]);
    const withFacts = { ...i, discoveryHintFacts: { margherita: ["h5:sauce", "cls:onion"] }, pitzBalance: 9999, hintPurchases: { margherita: 4 } } as ResultNearMissInput;
    expect(resultNearMiss(withFacts)).toEqual(resultNearMiss(i));
  });
});

describe("P2-B truthfulness: every directional line is followed to a real discovery (25 recipes, real matcher)", () => {
  const nonSauce = ALL_IDS.filter((id) => !isSauce(id));
  const sauces = ALL_IDS.filter(isSauce);

  function reaches(edits: readonly (readonly string[])[]): boolean {
    return edits.some((e) => outcomeOf(e).kind === "NEW_DISCOVERY");
  }

  it("ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE lines never point at an unreachable recipe", () => {
    let checked = 0;
    const seen = new Set<string>();
    for (const r of RECIPES) {
      const set: string[] = [...new Set<string>(r.requiredIngredients.map((q) => q.ingredientId))];
      const base = set.filter(isSauce);
      const pieces = set.filter((id) => !isSauce(id));
      const pizzas: string[][] = [
        ...pieces.map((p) => set.filter((id) => id !== p)), // remove one piece
        ...nonSauce.filter((id) => !set.includes(id)).map((x) => [...set, x]), // add one piece
        ...sauces.filter((s) => !base.includes(s)).map((s) => [...pieces, s]), // swap the sauce
        [...pieces], // drop the sauce
      ];
      for (const ids of pizzas) {
        const key = [...ids].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        if (outcomeOf(ids).kind !== "ORIGINAL") continue;
        const line = resultNearMiss(fullOwnership(ids));
        if (!line) continue;
        const has = new Set(ids);
        const hasSauce = ids.some(isSauce);
        if (line.kind === "ADD_ONE") {
          // adding one ingredient (a piece, or a sauce when the pizza has none) reaches a discovery
          const edits = [...nonSauce.filter((x) => !has.has(x)), ...(hasSauce ? [] : sauces)].map((x) => [...ids, x]);
          expect(reaches(edits), `ADD_ONE for ${key}`).toBe(true);
        } else if (line.kind === "REMOVE_ONE") {
          const edits = ids.map((x) => ids.filter((y) => y !== x));
          expect(reaches(edits), `REMOVE_ONE for ${key}`).toBe(true);
        } else if (line.kind === "SAUCE_ONLY") {
          const edits = sauces.map((s) => [...ids.filter((y) => !isSauce(y)), s]);
          expect(reaches(edits), `SAUCE_ONLY for ${key}`).toBe(true);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});
