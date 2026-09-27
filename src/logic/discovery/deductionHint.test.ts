import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import {
  ATTRIBUTE_FAMILIES,
  ATTRIBUTE_GROUPS,
  ingredientAttributeFamily,
  ingredientAttributeGroup,
  TAXONOMY_INGREDIENT_IDS,
} from "../../data/ingredientTaxonomy";
import { RECIPES, type Recipe } from "../../data/recipes";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import {
  deductionHintTextJa,
  INGREDIENT_TOTAL_FACT_ID,
  ingredientTotalOwned,
  legacyOwnsIngredientTotal,
  MIN_ATTRIBUTE_CANDIDATES,
  reserveAttributeAnswer,
  reserveAttributeAudit,
  structureTotalFact,
  type ReserveAttributeAnswer,
} from "./deductionHint";
import { buildHintSteps } from "./hintSteps";
import { classifyNearMiss } from "./nearMiss";
import { buildSelectableHintModel, purchaseSelectableHint, selectableHintPresentation } from "./selectableHint";
import { selectableHintSavedState } from "./hintFactMigration";
import { signatureOfPizza } from "./signature";
import { ladderOrder, ownedAtLadderStep as ownedAtStep } from "./testSupport/deductionAudit";
import { createDefaultSave, loadSave, SAVE_STORAGE_KEY } from "../../state/persistence";

const ownedAtLadderStep = (index: number) => ownedAtStep(index, W1_25_DISCOVERY_LADDER);

/**
 * Discovery Hint 4.0 DH4-1 (Issue #253): the Deduction Hint pure layer against every runtime recipe.
 * Each recipe is checked at the ladder state where it is the hint target (`ownedAtLadderStep`) and at
 * every later state (progression safety).
 */

const recipe = (id: string): Recipe => RECIPES.find((r) => r.id === id)!;
const LADDER = ladderOrder(W1_25_DISCOVERY_LADDER);
const TARGETS = LADDER.slice(1); // Dex >= 1: margherita at Dex 0 is the free onboarding
const distinct = (r: Recipe) => [...new Set(r.requiredIngredients.map((x) => x.ingredientId))];
const ctxAt = (index: number, owned: readonly string[] = ownedAtLadderStep(index)) => ({ discoveredCount: index, ownedIngredientIds: owned });
const levelPool = (id: string, index: number, answer: ReserveAttributeAnswer, owned?: readonly string[]) =>
  reserveAttributeAudit(id, ctxAt(index, owned))!.levels.find((l) => l.level === answer.level)?.privacyWorstCaseCandidates ?? null;

/** Words that would state an absence, a closure or a remaining count (OD-H3-7, OD-DH4-2). */
// 「まだわかっていない」 is about the player's knowledge, not the recipe, so a bare ない is allowed.
const NEGATIVE = /使わない|じゃない|入っていない|含まない|ありません|だけ|全部で0|0種類|あと|残り|ここまで|もうない/;

describe("DH4-1 taxonomy data (OD-DH4-4)", () => {
  it("every runtime topping has exactly one family; sauces and cheeses have none; families and groups are consistent", () => {
    for (const ingredient of INGREDIENTS) {
      const family = ingredientAttributeFamily(ingredient.id);
      if (ingredient.category === "topping") expect(family, ingredient.id).not.toBeNull();
      else expect(family, ingredient.id).toBeNull();
    }
    for (const id of TAXONOMY_INGREDIENT_IDS) expect(getIngredient(id)?.category, id).toBe("topping");
    expect(new Set(TAXONOMY_INGREDIENT_IDS).size).toBe(TAXONOMY_INGREDIENT_IDS.length);
    const groups = new Set(ATTRIBUTE_GROUPS.map((g) => g.id));
    for (const f of ATTRIBUTE_FAMILIES) expect(groups.has(f.group), f.id).toBe(true);
  });

  it("no family is a single-ingredient class in disguise beyond the runtime: egg/mushroom are merged into broader families", () => {
    expect(ingredientAttributeFamily("egg")).toBe("other");
    expect(ingredientAttributeFamily("mushroom")).toBe("vegetable");
    const labels = ATTRIBUTE_FAMILIES.map((f) => f.labelJa).join("|");
    for (const ingredient of INGREDIENTS) expect(labels.includes(ingredient.nameJa), ingredient.id).toBe(false);
  });

  it("unknown / hostile ids have no family and no group", () => {
    for (const id of ["future-truffle", "__proto__", "constructor", "", null, undefined, 42, ["ham"]]) {
      expect(ingredientAttributeFamily(id)).toBeNull();
      expect(ingredientAttributeGroup(id)).toBeNull();
    }
  });
});

describe("DH4-1 structure total count (OD-DH4-2)", () => {
  it("every target: the distinct ingredient count, deterministic, never 0, positive copy only", () => {
    for (const [i, id] of LADDER.entries()) {
      if (i === 0) {
        expect(structureTotalFact(id, { discoveredCount: 0 })).toBeNull();
        continue;
      }
      const fact = structureTotalFact(id, { discoveredCount: i })!;
      expect(fact).toEqual({ id: INGREDIENT_TOTAL_FACT_ID, total: distinct(recipe(id)).length });
      expect(structureTotalFact(id, { discoveredCount: i })).toEqual(fact);
      expect(fact.total).toBeGreaterThanOrEqual(1);
      const text = deductionHintTextJa(fact);
      expect(text).toBe(`このピザは全部で${fact.total}種類の材料を使うよ`);
      expect(text).not.toMatch(NEGATIVE);
    }
  });

  it("only the whole-recipe total exists: no per-category or remaining count fact", () => {
    const fact = structureTotalFact("capricciosa", { discoveredCount: 11 })!;
    expect(Object.keys(fact).sort()).toEqual(["id", "total"]);
  });

  it("not a target: unknown recipe, hostile id, the Dex-0 onboarding", () => {
    for (const id of ["nope", "__proto__", "", null, 7]) expect(structureTotalFact(id, { discoveredCount: 3 })).toBeNull();
    expect(structureTotalFact("margherita", { discoveredCount: 0 })).toBeNull();
    expect(structureTotalFact("margherita", { discoveredCount: 1 })).toEqual({ id: INGREDIENT_TOTAL_FACT_ID, total: 3 });
  });
});

describe("DH4-1 reserve attribute answer (OD-DH4-3/5/10)", () => {
  it("every target at its ladder state: an answer, k >= 2 for every non-existence level, never the reserve's name or id", () => {
    for (const [i, id] of LADDER.entries()) {
      if (i === 0) {
        expect(reserveAttributeAnswer(id, ctxAt(0))).toBeNull();
        continue;
      }
      const answer = reserveAttributeAnswer(id, ctxAt(i))!;
      const reserve = buildSelectableHintModel(id, { discoveredCount: i })!.reservedIngredientId!;
      expect(answer, id).not.toBeNull();
      if (answer.level !== "existence") expect(levelPool(id, i, answer)!.length, id).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
      const json = JSON.stringify(answer);
      const text = deductionHintTextJa(answer);
      expect(json, id).not.toContain(reserve);
      expect(text, id).not.toContain(getIngredient(reserve)!.nameJa);
      for (const ingredient of INGREDIENTS) expect(text, `${id} names ${ingredient.id}`).not.toContain(ingredient.nameJa);
      expect(text, id).not.toMatch(NEGATIVE);
      expect(Object.keys(answer).some((k) => /count|candidate|size|k$/i.test(k)), id).toBe(false);
    }
  });

  it("deterministic: repeated calls and any owned order or duplication give the same answer", () => {
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      const owned = ownedAtLadderStep(i);
      const a = reserveAttributeAnswer(id, ctxAt(i, owned));
      expect(reserveAttributeAnswer(id, ctxAt(i, owned))).toEqual(a);
      expect(reserveAttributeAnswer(id, ctxAt(i, [...owned].reverse()))).toEqual(a);
      expect(reserveAttributeAnswer(id, ctxAt(i, [...owned, ...owned, "tomato-sauce"]))).toEqual(a);
    }
  });

  it("fallback hierarchy: family -> group -> category -> existence, each chosen only when the finer level fails k >= 2", () => {
    const seen = new Set<string>();
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      const answer = reserveAttributeAnswer(id, ctxAt(i))!;
      const audit = reserveAttributeAudit(id, ctxAt(i))!;
      seen.add(answer.level);
      const idx = audit.levels.findIndex((l) => l.level === answer.level);
      const finer = answer.level === "existence" ? audit.levels : audit.levels.slice(0, idx);
      for (const l of finer) expect(l.privacyWorstCaseCandidates.length, `${id} ${l.level}`).toBeLessThan(MIN_ATTRIBUTE_CANDIDATES);
    }
    // On the shipped ladder the answers are family / category / existence (the audit fixture pins
    // which recipe lands where); the group level is exercised off-ladder below.
    expect([...seen].sort()).toEqual(["category", "existence", "family"]);
  });

  it("owned-set edge cases: empty, non-array, hostile and unknown ids never inflate k", () => {
    for (const owned of [[], "ham", null, undefined, 42, { 0: "ham" }]) {
      const answer = reserveAttributeAnswer("bambino", { discoveredCount: 9, ownedIngredientIds: owned });
      expect(answer).toEqual({ level: "existence", factId: "attr:existence" });
    }
    const withJunk = [...ownedAtLadderStep(9), "future-meat", "__proto__", "constructor", "", 12, null];
    expect(reserveAttributeAnswer("bambino", ctxAt(9, withJunk as string[]))).toEqual(reserveAttributeAnswer("bambino", ctxAt(9)));
    // Owning the recipe's own ingredients never adds a decoy (they are excluded, known or not).
    const meatLovers = distinct(recipe("meat-lovers"));
    expect(reserveAttributeAudit("meat-lovers", ctxAt(8, meatLovers))!.levels.every((l) => l.privacyWorstCaseCandidates.length === 1)).toBe(true);
  });

  it("progression safety: an answer given at a state keeps k >= 2 at every later ladder state (monotonic invariant)", () => {
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      const answer = reserveAttributeAnswer(id, ctxAt(i))!;
      if (answer.level === "existence") continue;
      for (let later = i; later < LADDER.length; later += 1) {
        const pool = levelPool(id, i, answer, ownedAtLadderStep(later))!;
        expect(pool.length, `${id} answered at ${i}, checked at ${later}`).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
      }
      // The later answer is the same level or finer, never coarser.
      const order = ["family", "group", "category", "existence"];
      const final = reserveAttributeAnswer(id, ctxAt(LADDER.length - 1, ownedAtLadderStep(LADDER.length - 1)))!;
      expect(order.indexOf(final.level), id).toBeLessThanOrEqual(order.indexOf(answer.level));
    }
  });

  it("knowledge safety: buying every other material fact of the recipe cannot shrink the answer's pool (decoys are outside the recipe)", () => {
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      const answer = reserveAttributeAnswer(id, ctxAt(i))!;
      if (answer.level === "existence") continue;
      const pool = levelPool(id, i, answer)!;
      const recipeIds = new Set(distinct(recipe(id)));
      const reserve = buildSelectableHintModel(id, { discoveredCount: i })!.reservedIngredientId!;
      expect(pool.filter((c) => c !== reserve).every((c) => !recipeIds.has(c)), id).toBe(true);
      expect(pool.includes(reserve), id).toBe(true);
    }
  });

  it("Rule W: the answer is always about the reserve, never about a sellable fact or the free key", () => {
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      const model = buildSelectableHintModel(id, { discoveredCount: i })!;
      const audit = reserveAttributeAudit(id, ctxAt(i))!;
      expect(audit.reserve).toBe(model.reservedIngredientId);
      expect(model.purchasableFacts.some((f) => f.ingredientId === audit.reserve), id).toBe(false);
      expect(model.freeFacts.some((f) => f.ingredientId === audit.reserve), id).toBe(false);
    }
  });

  it("group fallback: a family with no owned decoy but a group decoy answers at group level", () => {
    // hawaiian: reserve ham (meat). No other meat owned, one seafood owned -> 肉・魚介 (protein).
    const owned = ["tomato-sauce", "mozzarella", "basil", "pineapple", "ham", "tuna"];
    const answer = reserveAttributeAnswer("hawaiian", { discoveredCount: 10, ownedIngredientIds: owned })!;
    expect(answer).toEqual({ level: "group", group: "protein", factId: "attr:group:protein" });
    expect(deductionHintTextJa(answer)).toBe("まだわかっていない材料に、肉・魚介の仲間があるよ");
  });

  it("singleton taxonomy safety: a family with one owned member is never answered at family level", () => {
    // hawaiian: reserve ham (meat). With only ham owned among meats the family would name it.
    const owned = ["tomato-sauce", "mozzarella", "basil", "pineapple", "ham", "egg"];
    const answer = reserveAttributeAnswer("hawaiian", { discoveredCount: 10, ownedIngredientIds: owned })!;
    expect(answer.level).not.toBe("family");
    // One more owned meat outside the recipe makes the family answer safe.
    const safe = reserveAttributeAnswer("hawaiian", { discoveredCount: 10, ownedIngredientIds: [...owned, "bacon"] })!;
    expect(safe).toEqual({ level: "family", family: "meat", factId: "attr:family:meat" });
  });

  it("not a target / zero attribute: onboarding, unknown and hostile recipe ids answer nothing; the floor is existence", () => {
    expect(reserveAttributeAnswer("margherita", ctxAt(0))).toBeNull();
    for (const id of ["nope", "__proto__", "constructor", "", null, 3]) expect(reserveAttributeAnswer(id, ctxAt(5))).toBeNull();
    // A reserve with no decoy at any level still gets the existence floor, never an error.
    expect(reserveAttributeAnswer("quattro-formaggi", ctxAt(24))!.level).toBe("existence");
  });

  it("unknown / future ingredient: a recipe with a non-catalog ingredient fails closed; a non-topping reserve has no family levels", () => {
    const future: Recipe = { ...recipe("bambino"), id: "future-pizza", requiredIngredients: [
      ...recipe("bambino").requiredIngredients, { ingredientId: "future-truffle", minCount: 1 },
    ] } as unknown as Recipe;
    const recipes = [...RECIPES, future];
    expect(reserveAttributeAnswer("future-pizza", ctxAt(24, ownedAtLadderStep(24)), recipes)).toBeNull();
    expect(structureTotalFact("future-pizza", { discoveredCount: 24 }, recipes)).toBeNull();
    // A cheese reserve (bismarck: mozzarella) is only ever described by its category or existence.
    expect(reserveAttributeAudit("bismarck", ctxAt(1))!.levels.map((l) => l.level)).toEqual(["category"]);
    expect(reserveAttributeAudit("pizza-bianca", ctxAt(22))!.levels.map((l) => l.level)).toEqual(["category"]);
  });

  it("duplicate signature safety: repeated ingredient rows count once for the total and for exclusion", () => {
    const dup: Recipe = { ...recipe("bambino"), id: "dup-pizza", requiredIngredients: [
      ...recipe("bambino").requiredIngredients, ...recipe("bambino").requiredIngredients,
    ] } as unknown as Recipe;
    const recipes = [...RECIPES, dup];
    expect(structureTotalFact("dup-pizza", { discoveredCount: 9 }, recipes)!.total).toBe(structureTotalFact("bambino", { discoveredCount: 9 })!.total);
    expect(reserveAttributeAnswer("dup-pizza", ctxAt(9), recipes)).toEqual(reserveAttributeAnswer("bambino", ctxAt(9)));
  });
});

describe("DH4-1 near-miss combination (OD-DH4-7)", () => {
  const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
  const pizzaOf = (ids: readonly string[]): PizzaState => ({
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 2, y: 50 })),
    bakeResult: 70,
  });

  it("free near-miss (the reserve missing) + the purchased attribute never leaves a single candidate", () => {
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      const r = recipe(id);
      const reserve = buildSelectableHintModel(id, { discoveredCount: i })!.reservedIngredientId!;
      const onPizza = distinct(r).filter((x) => x !== reserve);
      const miss = classifyNearMiss(signatureOfPizza(pizzaOf(onPizza)), [r]);
      expect(miss, id).not.toBeNull();
      const answer = reserveAttributeAnswer(id, ctxAt(i))!;
      if (answer.level === "existence") continue;
      // What the player can still add: owned, not on the pizza, consistent with the paid answer.
      const addable = levelPool(id, i, answer)!.filter((c) => !onPizza.includes(c));
      expect(addable.length, `${id} ${miss!.kind}`).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
    }
  });

  it("near-miss copy stays fixed: this module never touches the near-miss copy or classifier state", () => {
    const src = Object.values(import.meta.glob<string>("./deductionHint.ts", { query: "?raw", import: "default", eager: true }))[0];
    expect(src.length).toBeGreaterThan(1000);
    expect(src).not.toMatch(/NEAR_MISS_COPY|resultNearMiss|classifyNearMiss/);
  });
});

describe("DH4-1 legacy total-count ownership (OD-DH4-8)", () => {
  it("every recipe x legacy level: owned exactly when the visible Hint 2.0 lines include the count line", () => {
    for (const r of RECIPES) {
      const steps = buildHintSteps(r, { discoveredCount: 1 });
      const countLevel = steps.find((s) => s.axis === "COUNT_CHEESE")!.level;
      for (let level = 0; level <= 4; level += 1) {
        const purchases = level ? { [r.id]: level } : {};
        const expected = level >= countLevel && level > 0;
        expect(legacyOwnsIngredientTotal(r.id, purchases), `${r.id} H${level}`).toBe(expected);
        expect(ingredientTotalOwned(r.id, { discoveryHintPurchases: purchases, discoveryHintFacts: {} }), `${r.id} H${level}`).toBe(expected);
      }
    }
  });

  it("the legacy ledger and grandfatheredSteps are read, never changed; the count line stays a display line", () => {
    const purchases = Object.freeze({ capricciosa: 3 });
    const facts = Object.freeze({});
    expect(legacyOwnsIngredientTotal("capricciosa", purchases)).toBe(true);
    const saved = selectableHintSavedState("capricciosa", { discoveryHintPurchases: purchases, discoveryHintFacts: facts })!;
    expect(saved.grandfatheredSteps.map((s) => s.textJa)).toEqual(["材料は全部で6種類。チーズを使うみたい"]);
    expect(saved.purchasedFactIds).toEqual([]);
  });

  it("a stored meta:ingredient-total id counts as owned, and never changes the Hint 3.0 material price or facts", () => {
    const save = { discoveryHintPurchases: {}, discoveryHintFacts: { capricciosa: [INGREDIENT_TOTAL_FACT_ID] } };
    expect(ingredientTotalOwned("capricciosa", save)).toBe(true);
    expect(ingredientTotalOwned("bambino", save)).toBe(false);
    const model = buildSelectableHintModel("capricciosa", { discoveredCount: 11 })!;
    expect(selectableHintPresentation(model, [INGREDIENT_TOTAL_FACT_ID], 100).nextPrice).toBe(5);
    const bought = purchaseSelectableHint({ model, purchasedFactIds: [INGREDIENT_TOTAL_FACT_ID], preferences: ["sauce"], expectedPaidCount: 0, pitzBalance: 100 });
    expect(bought).toMatchObject({ success: true, price: 5 });
  });

  it("hostile ledgers neither crash nor count", () => {
    for (const facts of [null, [], "x", { capricciosa: "meta:ingredient-total" }, { __proto__: [INGREDIENT_TOTAL_FACT_ID] }]) {
      expect(ingredientTotalOwned("capricciosa", { discoveryHintPurchases: null, discoveryHintFacts: facts })).toBe(false);
    }
    expect(ingredientTotalOwned("__proto__", { discoveryHintPurchases: {}, discoveryHintFacts: {} })).toBe(false);
  });
});

describe("DH4-1 fact ids survive the real save path", () => {
  it("every fact id this layer can produce is kept by loadSave (the persisted fact-id grammar)", () => {
    const ids = new Set<string>([INGREDIENT_TOTAL_FACT_ID]);
    for (const [i, id] of TARGETS.map((t, j) => [j + 1, t] as const)) {
      for (const owned of [ownedAtLadderStep(i), ownedAtLadderStep(LADDER.length - 1), []]) {
        ids.add(reserveAttributeAnswer(id, ctxAt(i, owned))!.factId);
      }
    }
    for (const f of ATTRIBUTE_FAMILIES) ids.add(`attr:family:${f.id}`);
    for (const g of ATTRIBUTE_GROUPS) ids.add(`attr:group:${g.id}`);
    for (const c of ["sauce", "cheese", "topping"]) ids.add(`attr:category:${c}`);
    ids.add("attr:existence");
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...createDefaultSave(), discoveryHintFacts: { capricciosa: [...ids] } }));
    const loaded = loadSave(storage);
    expect([...(loaded.discoveryHintFacts as Record<string, string[]>).capricciosa].sort()).toEqual([...ids].sort());
  });
});

describe("DH4-1 is unwired", () => {
  it("no production module imports the Deduction Hint layer or the taxonomy yet (only tests and testSupport)", () => {
    const sources = import.meta.glob<string>(["../../**/*.{ts,tsx}", "!../../**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true });
    const importers = Object.entries(sources)
      .filter(([path]) => !path.includes("/testSupport/"))
      .filter(([, text]) => /from\s+["'][^"']*(deductionHint|ingredientTaxonomy)["']/.test(text))
      .map(([path]) => path)
      .sort();
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    // DH4-2A (Issue #253) adds the guard and the request authority to the same unwired layer. They are
    // the only importers besides DH4-1 itself; no production module imports the layer
    // (deductionGuard.test.ts T-15 pins the same boundary for the DH4-2A modules).
    expect(importers).toEqual(["./deductionGuard.ts", "./deductionHint.ts", "./deductionRequest.ts"]);
  });
});

describe("DH4-1 ladder sanity", () => {
  it("the audit ladder is the shipped W1 ladder and every target is makeable from its owned set", () => {
    expect(LADDER).toHaveLength(W1_25_DISCOVERY_LADDER.steps.length + 1);
    for (const [i, id] of LADDER.entries()) {
      const owned = new Set(ownedAtLadderStep(i));
      expect(distinct(recipe(id)).every((x) => owned.has(x)), id).toBe(true);
    }
  });
});
