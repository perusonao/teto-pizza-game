import { describe, expect, it } from "vitest";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { RECIPES, countsTowardLadder, type Recipe } from "../../data/recipes";
import { recipeKeyStep } from "../../state/recipeChapters";
import { POST_W1_RECIPE_IDS } from "../catalog/testSupport/catalogDerived";
import { buildHintSteps, hintKeyIngredientId } from "./hintSteps";
import {
  buildSelectableHintModel,
  HINT_CATEGORIES,
  hintFactId,
  MAX_HINT_BATCH,
  ownedPurchasedFacts,
  parseHintFactId,
  purchaseSelectableHint,
  reservedIngredientId,
  resolveHintPreferences,
  SELECTABLE_HINT_GUIDANCE,
  selectableHintBatchPrice,
  selectableHintNextPrice,
  selectableHintPresentation,
  selectableHintPriceCap,
  type HintCategory,
  type SelectableHintFact,
  type SelectableHintModel,
  type SelectableHintPresentation,
} from "./selectableHint";

/**
 * Discovery Hint 3.0 (Issue #238), H3-1: the Selectable Hint pure layer on the 25 runtime recipes.
 * Authority: docs/reports/TETO_DISCOVERY-HINT-3_SELECTABLE_Fresh-Design.md §20 / §22 / §23.
 */

const DEX1 = { discoveredCount: 1 };
/** OD-H3-17: the zero-purchasable-fact answer. */
const GUIDANCE = { success: false, reason: "GUIDANCE_ONLY", guidance: SELECTABLE_HINT_GUIDANCE, price: 0 } as const;
const PAID_TARGETS = RECIPES.filter((r) => r.id !== "margherita");
/** Fresh Design §3: unique by (cheese count, topping count) among the 25. */
const SLOT_COUNT_LEAK_RECIPES = ["quattro-formaggi", "pizza-bianca", "parmigiana-pizza", "pesto-tonno", "puttanesca-pizza"];

const distinct = (r: Recipe) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const model = (id: string, options = DEX1): SelectableHintModel => {
  const m = buildSelectableHintModel(id, options);
  if (!m) throw new Error(`no model for ${id}`);
  return m;
};
const ids = (facts: readonly SelectableHintFact[]) => facts.map((f) => f.ingredientId);
/** Hint 2.0's H4 withholds the ingredients it never names (discoveredCount 1). */
const currentH4Withheld = (r: Recipe) => {
  const named = new Set(buildHintSteps(r, DEX1).map((s) => s.namedIngredientId).filter(Boolean));
  return distinct(r).filter((id) => !named.has(id));
};
const fullCost = (m: SelectableHintModel) => selectableHintBatchPrice(0, m.purchasableFacts.length, m.priceCap);

/** Every sequence of `length` preferences. */
function sequences(length: number): HintCategory[][] {
  if (length === 0) return [[]];
  return sequences(length - 1).flatMap((s) => HINT_CATEGORIES.map((c) => [...s, c]));
}

/** Every composition of `m` into positive parts (the ways to split a batch of m). */
function compositions(m: number): number[][] {
  if (m === 0) return [[]];
  const out: number[][] = [];
  for (let first = 1; first <= m; first += 1) for (const rest of compositions(m - first)) out.push([first, ...rest]);
  return out;
}

// ---- privacy assertions (also run against mutants below) ----

/** The pre-purchase structure with the free key chip removed: must be the same for every target. */
function structureWithoutKey(p: SelectableHintPresentation): string {
  return JSON.stringify({ ...p, pitzBalance: 0, rows: p.rows.map((row) => ({ ...row, revealed: row.revealed.filter((c) => !c.free) })) });
}

const FORBIDDEN_KEY = /remain|avail|empty|complete|count|reserved|slot|total|left|more|max/i;

function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

/** FREE LEAK check over the pre-purchase presentation of every target: one shared structure, no
 *  structural field, and no unrevealed or reserved ingredient anywhere in it. */
function freeLeakViolations(present: (m: SelectableHintModel) => unknown): string[] {
  const violations: string[] = [];
  const structures = new Map<string, string[]>();
  for (const recipe of PAID_TARGETS) {
    const m = model(recipe.id);
    const p = present(m) as SelectableHintPresentation;
    const json = JSON.stringify(p);
    for (const key of allKeys(p)) if (key !== "paidCount" && FORBIDDEN_KEY.test(key)) violations.push(`${recipe.id}: field ${key}`);
    const hidden = [m.reservedIngredientId, ...ids(m.purchasableFacts)].filter((id): id is string => !!id);
    for (const id of hidden) if (json.includes(`"${id}"`) || json.includes(`ing:${id}`)) violations.push(`${recipe.id}: hidden ${id}`);
    const s = structureWithoutKey(p);
    structures.set(s, [...(structures.get(s) ?? []), recipe.id]);
  }
  if (structures.size !== 1) violations.push(`${structures.size} pre-purchase structures: ${[...structures.values()].map((v) => v.join("|")).join(" / ")}`);
  return violations;
}

/** Invariants of a preference resolver over every recipe and every preference sequence. */
function resolverViolations(resolve: typeof resolveHintPreferences): string[] {
  const violations: string[] = [];
  for (const recipe of PAID_TARGETS) {
    const m = model(recipe.id);
    const key = hintKeyIngredientId(recipe);
    for (const seq of sequences(Math.min(m.purchasableFacts.length + 1, 4))) {
      let owned: SelectableHintFact[] = [];
      for (const pref of seq) {
        const got = resolve(m, owned, [pref]);
        for (const f of got) {
          if (f.ingredientId === m.reservedIngredientId) violations.push(`${recipe.id}: reserved ${f.ingredientId}`);
          if (f.ingredientId === key) violations.push(`${recipe.id}: key sold ${f.ingredientId}`);
          if (owned.some((o) => o.ingredientId === f.ingredientId)) violations.push(`${recipe.id}: repeated ${f.ingredientId}`);
          if (!f.id.startsWith("ing:") || !distinct(recipe).includes(f.ingredientId)) violations.push(`${recipe.id}: not a positive fact ${f.id}`);
        }
        if (got.length === 0 && owned.length < m.purchasableFacts.length) violations.push(`${recipe.id}: nothing returned while facts remain`);
        owned = [...owned, ...got];
      }
    }
  }
  return violations;
}

// ---- fact model ----

describe("fact generation (all 25 recipes)", () => {
  it("builds a model for every runtime recipe; every fact is a real positive ingredient of it", () => {
    for (const recipe of RECIPES) {
      const m = model(recipe.id);
      const all = [...m.freeFacts, ...m.purchasableFacts];
      for (const f of all) {
        expect(f.id).toBe(hintFactId(f.ingredientId));
        expect(distinct(recipe)).toContain(f.ingredientId);
        expect(f.category).toBe(getIngredient(f.ingredientId)?.category);
      }
      expect(new Set(all.map((f) => f.id)).size).toBe(all.length);
    }
  });

  it("sells exactly distinct - (key ? 1 : 0) - 1 facts: no artificial fact, no count, no absence", () => {
    for (const recipe of RECIPES) {
      const m = model(recipe.id);
      const key = hintKeyIngredientId(recipe);
      expect(m.freeFacts.map((f) => f.ingredientId)).toEqual(key ? [key] : []);
      expect(m.purchasableFacts.length).toBe(distinct(recipe).length - (key ? 1 : 0) - 1);
      const everyId = [...m.freeFacts, ...m.purchasableFacts].map((f) => f.id);
      expect(everyId.every((id) => /^ing:[a-z0-9-]+$/.test(id))).toBe(true);
    }
  });

  it("is deterministic (same input, same model)", () => {
    for (const recipe of RECIPES) expect(buildSelectableHintModel(recipe.id, DEX1)).toEqual(buildSelectableHintModel(recipe.id, DEX1));
  });

  it("the purchasable order is per category (sauce, cheese, topping), then requiredIngredients order", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      const cats = m.purchasableFacts.map((f) => HINT_CATEGORIES.indexOf(f.category));
      expect(cats).toEqual([...cats].sort((a, b) => a - b));
      for (const c of HINT_CATEGORIES) {
        const declared = distinct(recipe).filter((id) => m.purchasableFacts.some((f) => f.ingredientId === id && f.category === c));
        expect(ids(m.purchasableFacts.filter((f) => f.category === c))).toEqual(declared);
      }
    }
  });

  it("fact ids are the ingredients themselves: re-ordering requiredIngredients never changes an id's meaning", () => {
    for (const recipe of PAID_TARGETS) {
      const reversed = { ...recipe, requiredIngredients: [...recipe.requiredIngredients].reverse() } as Recipe;
      const a = model(recipe.id);
      const b = buildSelectableHintModel(recipe.id, DEX1, [reversed])!;
      // Free + sold + reserved is always the same ingredient set. Which one is reserved (Rule W) and,
      // on a ladder-step tie (quattro-formaggi: fontina/gorgonzola, capricciosa: black-olive/oregano),
      // which one is the key follow the authored order -- the existing H4 / `hintKeyIngredientId`
      // authorities, unchanged. Either way the key is an ingredient of the recipe's own ladder step.
      const union = (m: SelectableHintModel) => [...ids(m.freeFacts), ...ids(m.purchasableFacts), m.reservedIngredientId].sort();
      expect(union(b)).toEqual(union(a));
      expect(union(a)).toEqual([...distinct(recipe)].sort());
      const stepOf = (id: string) => recipeKeyStep({ ...recipe, requiredIngredients: [{ ingredientId: id, minCount: 1 }] });
      expect(stepOf(ids(b.freeFacts)[0])).toBe(stepOf(ids(a.freeFacts)[0]));
      expect(stepOf(ids(a.freeFacts)[0])).toBe(recipeKeyStep(recipe));
      for (const f of b.purchasableFacts) expect(f.id).toBe(`ing:${f.ingredientId}`);
    }
  });

  it("fails closed for unknown or hostile recipe ids", () => {
    for (const bad of ["", "unknown-pizza", "__proto__", "constructor", "prototype", "toString", 7, null, undefined, {}, ["margherita"]]) {
      expect(buildSelectableHintModel(bad, DEX1)).toBeNull();
    }
    expect(purchaseSelectableHint({ model: null, purchasedFactIds: [], preferences: ["sauce"], expectedPaidCount: 0, pitzBalance: 999 })).toEqual({
      success: false,
      reason: "NOT_A_TARGET",
    });
  });
});

describe("Rule W (OD-H3-5)", () => {
  it("the reserved ingredient equals the ingredient current H4 withholds, for all 25", () => {
    for (const recipe of RECIPES) {
      expect([reservedIngredientId(recipe)], recipe.id).toEqual(currentH4Withheld(recipe));
      expect(model(recipe.id).reservedIngredientId).toBe(reservedIngredientId(recipe));
    }
  });

  it("the reserved ingredient is never the key and can never be bought, shown or accepted from a save", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      const reserved = m.reservedIngredientId!;
      expect(reserved).not.toBe(hintKeyIngredientId(recipe));
      expect(ids(m.purchasableFacts)).not.toContain(reserved);
      expect(ownedPurchasedFacts(m, [hintFactId(reserved)])).toEqual([]);
      const p = selectableHintPresentation(m, [hintFactId(reserved), ...m.purchasableFacts.map((f) => f.id)], 999);
      expect(JSON.stringify(p)).not.toContain(`"${reserved}"`);
    }
  });
});

describe("free key fact (OD-H3-6 / OD-H3-13)", () => {
  it("every paid target shows its key for free, including pizza-bianca (no per-recipe exception)", () => {
    for (const recipe of PAID_TARGETS) {
      const key = hintKeyIngredientId(recipe);
      expect(key, recipe.id).not.toBeNull();
      const p = selectableHintPresentation(model(recipe.id), [], 0);
      const chips = p.rows.flatMap((r) => r.revealed);
      expect(chips).toEqual([{ factId: hintFactId(key!), ingredientId: key, free: true }]);
      expect(p.rows.find((r) => r.category === getIngredient(key!)!.category)!.revealed).toHaveLength(1);
    }
  });

  it("a key id in the purchased list is not counted as a paid fact", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      expect(ownedPurchasedFacts(m, [hintFactId(hintKeyIngredientId(recipe)!)])).toEqual([]);
    }
  });

  it("the free key adds no hidden structure: without it every target looks the same before purchase", () => {
    expect(freeLeakViolations((m) => selectableHintPresentation(m, [], 100))).toEqual([]);
  });
});

describe("Dex 0 Margherita onboarding (OD-H3-8)", () => {
  it("every Margherita ingredient is free, nothing is reserved, and the result is not for the save", () => {
    const m = model("margherita", { discoveredCount: 0 });
    expect(m.onboarding).toBe(true);
    expect(m.reservedIngredientId).toBeNull();
    expect(ids(m.purchasableFacts).sort()).toEqual(["basil", "mozzarella", "tomato-sauce"]);
    let owned: string[] = [];
    for (const pref of ["topping", "sauce", "cheese"] as const) {
      const r = purchaseSelectableHint({ model: m, purchasedFactIds: owned, preferences: [pref], expectedPaidCount: 0, pitzBalance: 0 });
      if (!r.success) throw new Error(r.reason);
      expect(r).toMatchObject({ price: 0, nextPitzBalance: 0, persist: false });
      owned = [...r.nextPurchasedFactIds];
    }
    expect(owned).toHaveLength(3);
    expect(selectableHintPresentation(m, owned, 0)).toMatchObject({ nextPrice: 0, onboarding: true, affordable: true });
    expect(purchaseSelectableHint({ model: m, purchasedFactIds: owned, preferences: ["sauce"], expectedPaidCount: 0, pitzBalance: 0 })).toEqual(GUIDANCE);
  });

  it("only Margherita at Dex 0 is free; any other target at Dex 0 is priced", () => {
    expect(model("margherita").onboarding).toBe(false);
    expect(model("bismarck", { discoveredCount: 0 }).onboarding).toBe(false);
    expect(selectableHintNextPrice(model("bismarck", { discoveredCount: 0 }), 0)).toBe(5);
  });
});

// ---- category preference / fallback ----

describe("category preference and fallback (OD-H3-14)", () => {
  it("returns the preferred category's next fact when it has one", () => {
    const m = model("capricciosa"); // sells tomato-sauce, mozzarella, mushroom, ham
    expect(ids(resolveHintPreferences(m, [], ["topping"]))).toEqual(["mushroom"]);
    expect(ids(resolveHintPreferences(m, [], ["cheese"]))).toEqual(["mozzarella"]);
    expect(ids(resolveHintPreferences(m, [], ["topping", "topping"]))).toEqual(["mushroom", "ham"]);
  });

  it("falls back deterministically in sauce -> cheese -> topping order to a positive fact", () => {
    const m = model("marinara"); // sells tomato-sauce only
    expect(ids(resolveHintPreferences(m, [], ["topping"]))).toEqual(["tomato-sauce"]);
    expect(ids(resolveHintPreferences(m, [], ["cheese"]))).toEqual(["tomato-sauce"]);
    const t = model("pesto-tonno"); // key is the sauce; sells tuna, black-olive
    expect(ids(resolveHintPreferences(t, [], ["sauce"]))).toEqual(["tuna"]);
    expect(ids(resolveHintPreferences(t, [], ["cheese", "cheese"]))).toEqual(["tuna", "black-olive"]);
    for (const recipe of PAID_TARGETS) {
      const mm = model(recipe.id);
      for (const seq of sequences(3)) expect(resolveHintPreferences(mm, [], seq)).toEqual(resolveHintPreferences(mm, [], seq));
    }
  });

  it("never returns the reserved ingredient, the key, an owned fact, a repeat or a non-positive fact (every sequence)", () => {
    expect(resolverViolations(resolveHintPreferences)).toEqual([]);
  });

  it("a category with no matching fact is never reported as EMPTY: the result is a fact or nothing at all", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      for (const pref of HINT_CATEGORIES) {
        const r = purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: [pref], expectedPaidCount: 0, pitzBalance: 999 });
        if (m.purchasableFacts.length === 0) expect(r).toEqual(GUIDANCE);
        else expect(r.success).toBe(true);
        expect(JSON.stringify(r)).not.toMatch(/EMPTY|NONE|none:|COMPLETE/);
      }
    }
  });

  it("exhaustive: any preference sequence reveals all sellable facts, and only them, before the generic guidance", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      for (const seq of sequences(m.purchasableFacts.length)) {
        let owned: readonly string[] = [];
        let balance = 999;
        for (const pref of seq) {
          const r = purchaseSelectableHint({ model: m, purchasedFactIds: owned, preferences: [pref], expectedPaidCount: owned.length, pitzBalance: balance });
          if (!r.success) throw new Error(`${recipe.id} ${seq.join(",")}: ${r.reason}`);
          owned = r.nextPurchasedFactIds;
          balance = r.nextPitzBalance;
        }
        expect([...owned].sort()).toEqual(m.purchasableFacts.map((f) => f.id).sort());
        expect(999 - balance).toBe(fullCost(m));
        const after = purchaseSelectableHint({ model: m, purchasedFactIds: owned, preferences: ["sauce"], expectedPaidCount: owned.length, pitzBalance: balance });
        expect(after).toEqual(GUIDANCE);
      }
    }
  });
});

// ---- pricing ----

describe("ESC_PARITY pricing (OD-H3-4 / OD-H3-15)", () => {
  it("rungs are 5 / 10 / 20 / 40 and then 40", () => {
    expect([0, 1, 2, 3, 4, 5].map((paid) => selectableHintBatchPrice(paid, 1, 999))).toEqual([5, 10, 20, 40, 40, 40]);
    expect(selectableHintBatchPrice(0, 3, 999)).toBe(35);
  });

  it("split purchase == batch purchase for every recipe, paid count and split (no price bypass)", () => {
    for (const recipe of RECIPES) {
      const cap = model(recipe.id).priceCap;
      for (let paid = 0; paid <= 5; paid += 1) {
        for (let m = 1; m <= MAX_HINT_BATCH; m += 1) {
          const batch = selectableHintBatchPrice(paid, m, cap);
          for (const parts of compositions(m)) {
            let at = paid;
            let sum = 0;
            for (const part of parts) {
              sum += selectableHintBatchPrice(at, part, cap);
              at += part;
            }
            expect(sum).toBe(batch);
          }
        }
      }
    }
  });

  it("through the purchase rule: 3 facts at once cost 35, the same 3 one by one cost 35, and yield the same facts", () => {
    const m = model("capricciosa");
    const batch = purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["topping", "sauce", "cheese"], expectedPaidCount: 0, pitzBalance: 100 });
    let owned: readonly string[] = [];
    let spent = 0;
    for (const pref of ["topping", "sauce", "cheese"] as const) {
      const r = purchaseSelectableHint({ model: m, purchasedFactIds: owned, preferences: [pref], expectedPaidCount: owned.length, pitzBalance: 100 - spent });
      if (!r.success) throw new Error(r.reason);
      owned = r.nextPurchasedFactIds;
      spent += r.price;
    }
    if (!batch.success) throw new Error(batch.reason);
    expect(batch.price).toBe(35);
    expect(spent).toBe(35);
    expect([...batch.nextPurchasedFactIds].sort()).toEqual([...owned].sort());
  });

  it("the cap is the recipe's current full H1..H4 cost: 35 for the 3-level recipes, 75 for the 4-level ones", () => {
    for (const recipe of RECIPES) {
      const levels = buildHintSteps(recipe, DEX1).at(-1)!.level;
      expect(selectableHintPriceCap(recipe), recipe.id).toBe(levels === 3 ? 35 : 75);
      const m = model(recipe.id);
      expect(fullCost(m)).toBeLessThanOrEqual(m.priceCap);
      expect(selectableHintBatchPrice(0, 20, m.priceCap)).toBe(m.priceCap);
    }
    expect(RECIPES.filter((r) => selectableHintPriceCap(r) === 35).map((r) => r.id).sort()).toEqual(
      ["bismarck", "brazilian-catupiry-corn-pizza", "fugazza", "funghi", "genovese", "margherita", "marinara", "palmito-pizza", "pepperoni", "pizza-bianca", "porchetta-pizza", "salsiccia", "salsiccia-e-friarielli"].sort(),
    );
  });

  it("the cap never binds before a target is exhausted, so no displayed price can reveal it", () => {
    // Expansion Batch 1: veggie-supreme-pizza (7 distinct ingredients) is the first recipe with 5 purchasable facts:
    // the uncapped 5 + 10 + 20 + 40 + 40 = 115 exceeds its Hint 2.0 parity cap of 75, so its 5th fact is the one the cap
    // zeroes. The pricing rule is unchanged (a documented, known exception; see the Batch 1 result); every other recipe
    // keeps "the cap never binds before the target is exhausted".
    const capBinds: string[] = [];
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      const uncapped = Array.from({ length: m.purchasableFacts.length }, (_, paid) => selectableHintBatchPrice(paid, 1, Number.POSITIVE_INFINITY));
      if (uncapped.reduce((a, b) => a + b, 0) > m.priceCap) {
        capBinds.push(recipe.id);
        const spent = uncapped.reduce((total, _p, paid) => total + selectableHintNextPrice(m, paid), 0);
        expect(spent, `${recipe.id}: the capped total is exactly the cap`).toBe(m.priceCap);
        continue;
      }
      for (let paid = 0; paid < m.purchasableFacts.length; paid += 1) {
        expect(selectableHintNextPrice(m, paid), `${recipe.id} paid ${paid}`).toBe(uncapped[paid]);
      }
    }
    expect(capBinds).toEqual(["veggie-supreme-pizza"]);
  });

  it("measurement: the 24 paid targets' full unlock total (not asserted to 1480, not an economy authority)", () => {
    // The snapshot is of the credited W1 population (a branching recipe, and No.27 pesto-pollo / Expansion
    // pesto-gamberi / Wave 2 recipes behind the appended steps 25-28, are measured on their own).
    const perRecipe = Object.fromEntries(PAID_TARGETS.filter((r) => countsTowardLadder(r.id) && !POST_W1_RECIPE_IDS.includes(r.id)).map((r) => [r.id, fullCost(model(r.id))]));
    const total = Object.values(perRecipe).reduce((a, b) => a + b, 0);
    // Snapshot of today's data under OD-H3-4/5/6/7 (Result Report §9); re-measure when recipes change.
    expect(total).toBe(515);
    expect(perRecipe["pizza-bianca"]).toBe(0);
    expect(total).toBeLessThan(1480);
  });
});

// ---- purchase validation ----

describe("purchase validation", () => {
  const cap = model("capricciosa");

  it("already purchased facts are never charged again (a fact already owned is skipped)", () => {
    const first = purchaseSelectableHint({ model: cap, purchasedFactIds: [], preferences: ["topping"], expectedPaidCount: 0, pitzBalance: 100 });
    if (!first.success) throw new Error(first.reason);
    const second = purchaseSelectableHint({ model: cap, purchasedFactIds: first.nextPurchasedFactIds, preferences: ["topping"], expectedPaidCount: 1, pitzBalance: 95 });
    if (!second.success) throw new Error(second.reason);
    expect(first.revealed.map((f) => f.ingredientId)).toEqual(["mushroom"]);
    expect(second.revealed.map((f) => f.ingredientId)).toEqual(["ham"]);
    expect(second.price).toBe(10);
  });

  it("a double tap / stale event (wrong expectedPaidCount) is rejected and changes nothing", () => {
    const owned = ["ing:mushroom"];
    for (const stale of [0, 2, -1, Number.NaN]) {
      expect(purchaseSelectableHint({ model: cap, purchasedFactIds: owned, preferences: ["topping"], expectedPaidCount: stale, pitzBalance: 100 })).toEqual({
        success: false,
        reason: "STALE",
      });
    }
  });

  it("insufficient Pitz is decided on the requested batch, never on what is left", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["topping"], expectedPaidCount: 0, pitzBalance: 4 })).toEqual({
        success: false,
        reason: "INSUFFICIENT_PITZ",
      });
      expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["sauce", "cheese"], expectedPaidCount: 0, pitzBalance: 14 })).toEqual({
        success: false,
        reason: "INSUFFICIENT_PITZ",
      });
    }
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      expect(purchaseSelectableHint({ model: cap, purchasedFactIds: [], preferences: ["sauce"], expectedPaidCount: 0, pitzBalance: bad }).success).toBe(false);
    }
  });

  it("a batch larger than what is left charges only for the facts revealed", () => {
    const m = model("marinara"); // 1 sellable fact
    const r = purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["topping", "cheese", "sauce"], expectedPaidCount: 0, pitzBalance: 35 });
    if (!r.success) throw new Error(r.reason);
    expect(r.revealed.map((f) => f.ingredientId)).toEqual(["tomato-sauce"]);
    expect(r.price).toBe(5);
    expect(r.nextPitzBalance).toBe(30);
  });

  it("invalid preferences are rejected: empty, too many, unknown or hostile values", () => {
    for (const prefs of [[], Array(MAX_HINT_BATCH + 1).fill("sauce"), ["dough"], ["__proto__"], ["constructor"], [null], [0], "sauce", null, { 0: "sauce" }]) {
      expect(purchaseSelectableHint({ model: cap, purchasedFactIds: [], preferences: prefs, expectedPaidCount: 0, pitzBalance: 100 })).toEqual({
        success: false,
        reason: "INVALID_PREFERENCES",
      });
    }
  });

  it("purchased ids: duplicates collapse, unknown / future / hostile ids are ignored (fail closed)", () => {
    const hostile = ["__proto__", "constructor", "prototype", "ing:__proto__", "ing:constructor", "ing:", "ing:MUSHROOM", "ing:mushroom ", "tech:fold", "shape:square", "none:cheese", "meta:ingredient-count", 42, null, {}, ["ing:ham"]];
    const owned = ownedPurchasedFacts(cap, ["ing:mushroom", "ing:mushroom", "ing:ham", "ing:pineapple", ...hostile]);
    expect(ids(owned)).toEqual(["mushroom", "ham"]);
    expect(ownedPurchasedFacts(cap, "ing:mushroom")).toEqual([]);
    expect(ownedPurchasedFacts(cap, { 0: "ing:mushroom" })).toEqual([]);
    for (const h of hostile) expect(parseHintFactId(h) === null || parseHintFactId(h) === "constructor").toBe(true);
    const p = selectableHintPresentation(cap, ["ing:mushroom", ...hostile], 100);
    expect(p.paidCount).toBe(1);
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("a successful purchase records the ids in reveal order, deduplicated", () => {
    const r = purchaseSelectableHint({ model: cap, purchasedFactIds: ["ing:ham", "ing:ham"], preferences: ["topping", "sauce"], expectedPaidCount: 1, pitzBalance: 100 });
    if (!r.success) throw new Error(r.reason);
    expect(r.nextPurchasedFactIds).toEqual(["ing:tomato-sauce", "ing:mushroom", "ing:ham"]);
    expect(r.price).toBe(30);
    expect(r.persist).toBe(true);
  });
});

describe("legacy Hint Economy 1.0 progress (OD-H3-9: no rung roll-back, no re-charge)", () => {
  const nap = model("napoletana"); // sells tomato-sauce, mozzarella; key anchovy; cap 75
  const buy = (m: SelectableHintModel, owned: readonly string[], legacy: Parameters<typeof selectableHintPresentation>[3], balance = 999) => {
    const expected = selectableHintPresentation(m, owned, balance, legacy).paidCount;
    return purchaseSelectableHint({ model: m, purchasedFactIds: owned, preferences: ["cheese"], expectedPaidCount: expected, pitzBalance: balance, legacy });
  };

  it("old H1 (the key, now free): the next fact costs rung 2 (10), not 5, and the one after 20", () => {
    const legacy = { paidRungs: 1, grantedFactIds: [] };
    expect(selectableHintPresentation(nap, [], 100, legacy)).toMatchObject({ paidCount: 1, nextPrice: 10 });
    const first = buy(nap, [], legacy);
    if (!first.success) throw new Error(first.reason);
    expect(first.price).toBe(10);
    expect(selectableHintPresentation(nap, first.nextPurchasedFactIds, 100, legacy)).toMatchObject({ paidCount: 2, nextPrice: 20 });
  });

  it("old H3 (key + sauce + count/cheese line): the sauce is owned and never sold again; the next fact costs 40 (= today's H4)", () => {
    const legacy = { paidRungs: 3, grantedFactIds: ["ing:tomato-sauce"] };
    const p = selectableHintPresentation(nap, [], 100, legacy);
    expect(p).toMatchObject({ paidCount: 3, nextPrice: 40 });
    expect(p.rows[0].revealed.map((c) => c.ingredientId)).toEqual(["tomato-sauce"]);
    const r = purchaseSelectableHint({ model: nap, purchasedFactIds: [], preferences: ["sauce"], expectedPaidCount: 3, pitzBalance: 100, legacy });
    if (!r.success) throw new Error(r.reason);
    expect(r.revealed.map((f) => f.ingredientId)).toEqual(["mozzarella"]); // the sauce preference falls back: tomato is already owned
    expect(r.price).toBe(40);
    expect(r.nextPurchasedFactIds).toEqual(["ing:mozzarella"]); // grants stay derived, never copied into the new ledger
  });

  it("old H4: everything sellable is owned, the cap is reached, nothing is charged", () => {
    const legacy = { paidRungs: 4, grantedFactIds: nap.purchasableFacts.map((f) => f.id) };
    expect(selectableHintPresentation(nap, [], 0, legacy)).toMatchObject({ paidCount: 4, nextPrice: 0 });
    expect(buy(nap, [], legacy, 0)).toEqual(GUIDANCE);
  });

  it("a granted fact also present in the new ledger is not counted twice", () => {
    const legacy = { paidRungs: 2, grantedFactIds: ["ing:tomato-sauce"] };
    expect(selectableHintPresentation(nap, ["ing:tomato-sauce"], 0, legacy).paidCount).toBe(2);
    expect(selectableHintPresentation(nap, ["ing:tomato-sauce", "ing:mozzarella"], 0, legacy).paidCount).toBe(3);
  });

  it("hostile or out-of-range legacy input fails closed (rungs 0, grants ignored) and pollutes nothing", () => {
    for (const paidRungs of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3", null, {}, "__proto__"]) {
      expect(selectableHintPresentation(nap, [], 0, { paidRungs, grantedFactIds: [] }).paidCount).toBe(0);
    }
    expect(selectableHintPresentation(nap, [], 0, { paidRungs: 99, grantedFactIds: [] }).paidCount).toBe(4);
    const hostile = { paidRungs: 0, grantedFactIds: ["__proto__", "ing:__proto__", "ing:anchovy", "ing:oregano", "tech:fold", 7] };
    expect(selectableHintPresentation(nap, [], 0, hostile).rows.flatMap((r) => r.revealed.map((c) => c.ingredientId))).toEqual(["anchovy"]);
    expect(JSON.stringify(selectableHintPresentation(nap, [], 0, hostile))).not.toContain("oregano"); // the reserve stays hidden
  });

  it("without legacy progress the behaviour is exactly the fact-count rung", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      const all = m.purchasableFacts.map((f) => f.id);
      expect(selectableHintPresentation(m, all, 0, { paidRungs: 0, grantedFactIds: [] })).toEqual(selectableHintPresentation(m, all, 0));
    }
  });

  it("mutation: a rung derived from owned facts alone (the Codex P2 bug) is caught", () => {
    const rolledBack = (owned: number) => selectableHintBatchPrice(owned, 1, nap.priceCap); // ignores the legacy rung
    expect(rolledBack(0)).not.toBe(selectableHintPresentation(nap, [], 0, { paidRungs: 1, grantedFactIds: [] }).nextPrice);
  });
});

describe("OD-H3-17: zero purchasable facts -> generic guidance (no charge, no progress, no record)", () => {
  const bianca = model("pizza-bianca");
  /** A future recipe with the same shape as pizza-bianca (free key + reserve, nothing to sell),
   *  under another id: proves there is no recipe-id special case. */
  const FUTURE: Recipe = {
    id: "future-zero-fact" as Recipe["id"],
    nameJa: "",
    description: "",
    requiredIngredients: [
      { ingredientId: "pesto", minCount: 1 },
      { ingredientId: "cherry-tomato", minCount: 3 },
    ],
    bakeTarget: { start: 50, end: 70 },
    baseRewardPitz: 100,
  };
  const future = buildSelectableHintModel(FUTURE.id, DEX1, [FUTURE])!;
  const capricciosa = model("capricciosa");
  const exhausted = capricciosa.purchasableFacts.map((f) => f.id);
  const legacyH4 = { paidRungs: 4, grantedFactIds: model("napoletana").purchasableFacts.map((f) => f.id) };

  type Case = { name: string; m: SelectableHintModel; owned: readonly string[]; legacy?: Parameters<typeof selectableHintPresentation>[3] };
  const CASES: Case[] = [
    { name: "pizza-bianca", m: bianca, owned: [] },
    { name: "future zero-fact recipe", m: future, owned: [] },
    { name: "capricciosa, everything bought", m: capricciosa, owned: exhausted },
    { name: "napoletana, legacy H4", m: model("napoletana"), owned: [], legacy: legacyH4 },
  ];
  const request = (c: Case, purchase = purchaseSelectableHint, prefs: HintCategory[] = ["topping"]) =>
    purchase({ model: c.m, purchasedFactIds: c.owned, preferences: prefs, expectedPaidCount: selectableHintPresentation(c.m, c.owned, 0, c.legacy).paidCount, pitzBalance: 50, legacy: c.legacy });

  /** Everything OD-H3-17 requires of the zero-fact answer, for one purchase implementation. */
  function zeroFactViolations(purchase: typeof purchaseSelectableHint): string[] {
    const v: string[] = [];
    for (const c of CASES) {
      for (const prefs of sequences(2)) {
        const r = request(c, purchase, prefs);
        const json = JSON.stringify(r);
        if (json !== JSON.stringify(GUIDANCE)) v.push(`${c.name} ${prefs}: not the generic guidance: ${json}`);
        if (r.success) v.push(`${c.name}: success on a zero-fact request`);
        if ("price" in r && r.price !== 0) v.push(`${c.name}: charged ${r.price}`);
        if (c.m.reservedIngredientId && json.includes(c.m.reservedIngredientId)) v.push(`${c.name}: reserved ingredient returned`);
        if (/ing:|none|empty|remain|count|left|sauce|cheese|topping|[1-9]/i.test(json)) v.push(`${c.name}: structural content ${json}`);
      }
    }
    return v;
  }

  it("1. pizza-bianca has zero purchasable facts (and a free key and a reserve)", () => {
    expect(bianca.purchasableFacts).toEqual([]);
    expect(ids(bianca.freeFacts)).toEqual(["rosemary"]);
    expect(bianca.reservedIngredientId).toBe("olive-oil");
  });

  it("2. the request charges 0 Pitz and says only the generic guidance", () => {
    for (const c of CASES) {
      const r = request(c);
      expect(r, c.name).toEqual(GUIDANCE);
      expect(r).not.toHaveProperty("nextPitzBalance");
    }
  });

  it("3-5. paid count, legacy progress and purchased facts are unchanged (inputs untouched, nothing to record)", () => {
    for (const c of CASES) {
      const owned = Object.freeze([...c.owned]);
      const legacy = c.legacy && Object.freeze({ ...c.legacy, grantedFactIds: Object.freeze([...(c.legacy.grantedFactIds as string[])]) });
      const before = selectableHintPresentation(c.m, owned, 50, legacy);
      const r = purchaseSelectableHint({ model: c.m, purchasedFactIds: owned, preferences: ["sauce"], expectedPaidCount: before.paidCount, pitzBalance: 50, legacy });
      expect(r).toEqual(GUIDANCE);
      expect(r).not.toHaveProperty("nextPurchasedFactIds");
      expect(r).not.toHaveProperty("persist");
      expect(selectableHintPresentation(c.m, owned, 50, legacy)).toEqual(before);
      expect(owned).toEqual(c.owned);
    }
  });

  it("6. a repeated request is idempotent", () => {
    for (const c of CASES) {
      const results = Array.from({ length: 5 }, () => request(c));
      for (const r of results) expect(r).toEqual(results[0]);
      expect(selectableHintPresentation(c.m, c.owned, 50, c.legacy).paidCount).toBe(selectableHintPresentation(c.m, c.owned, 0, c.legacy).paidCount);
    }
  });

  it("7-10, 13. no negative fact, no reserve, no count, no category absence: the serialization carries no hidden identity", () => {
    expect(zeroFactViolations(purchaseSelectableHint)).toEqual([]);
    for (const c of CASES) {
      const json = JSON.stringify([request(c), selectableHintPresentation(c.m, c.owned, 50, c.legacy)]);
      expect(json).not.toContain(`"${c.m.reservedIngredientId}"`);
      expect(json).not.toMatch(/none:|EMPTY|COMPLETE|remaining|absent/);
    }
  });

  it("11. hostile or stale requests stay fail closed, exactly as for any other target", () => {
    for (const m of [bianca, future, model("bismarck")]) {
      expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["topping"], expectedPaidCount: 1, pitzBalance: 50 })).toEqual({ success: false, reason: "STALE" });
      expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["topping"], expectedPaidCount: 0, pitzBalance: 4 })).toEqual({ success: false, reason: "INSUFFICIENT_PITZ" });
      expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["__proto__"], expectedPaidCount: 0, pitzBalance: 50 })).toEqual({ success: false, reason: "INVALID_PREFERENCES" });
      expect(purchaseSelectableHint({ model: m, purchasedFactIds: ["ing:__proto__", "tech:fold"], preferences: ["sauce"], expectedPaidCount: 0, pitzBalance: Number.NaN })).toEqual({ success: false, reason: "INSUFFICIENT_PITZ" });
    }
  });

  it("12. a future zero-fact recipe behaves exactly like pizza-bianca (no recipe-id special case)", () => {
    expect(future.purchasableFacts).toEqual([]);
    expect(future.freeFacts).toHaveLength(1);
    expect(future.reservedIngredientId).not.toBeNull();
    expect(structureWithoutKey(selectableHintPresentation(future, [], 50))).toBe(structureWithoutKey(selectableHintPresentation(bianca, [], 50)));
    for (const prefs of sequences(2)) {
      expect(purchaseSelectableHint({ model: future, purchasedFactIds: [], preferences: prefs, expectedPaidCount: 0, pitzBalance: 50 })).toEqual(
        purchaseSelectableHint({ model: bianca, purchasedFactIds: [], preferences: prefs, expectedPaidCount: 0, pitzBalance: 50 }),
      );
    }
  });

  it("14. mutation: a zero-fact path that returns the reserved ingredient is caught", () => {
    const leaky: typeof purchaseSelectableHint = (input) => {
      const r = purchaseSelectableHint(input);
      const m = input.model;
      if (!r.success && r.reason === "GUIDANCE_ONLY" && m?.reservedIngredientId) {
        const fact = { id: hintFactId(m.reservedIngredientId), ingredientId: m.reservedIngredientId, category: getIngredient(m.reservedIngredientId)!.category };
        return { success: true, revealed: [fact], price: 0, nextPurchasedFactIds: [fact.id], nextPitzBalance: input.pitzBalance, persist: true };
      }
      return r;
    };
    expect(zeroFactViolations(leaky).some((v) => v.includes("reserved ingredient returned"))).toBe(true);
  });

  it("15. mutation: a zero-fact request that charges 5 Pitz is caught", () => {
    const charging: typeof purchaseSelectableHint = (input) => {
      const r = purchaseSelectableHint(input);
      return !r.success && r.reason === "GUIDANCE_ONLY" ? ({ ...r, price: 5 } as unknown as typeof r) : r;
    };
    expect(zeroFactViolations(charging).some((v) => v.includes("charged 5"))).toBe(true);
  });

  it("mutation: other zero-fact breakages are caught too (negative fact, count, success)", () => {
    const negative: typeof purchaseSelectableHint = (input) => {
      const r = purchaseSelectableHint(input);
      return !r.success && r.reason === "GUIDANCE_ONLY" ? ({ ...r, guidance: "none:cheese" } as unknown as typeof r) : r;
    };
    const counting: typeof purchaseSelectableHint = (input) => {
      const r = purchaseSelectableHint(input);
      return !r.success && r.reason === "GUIDANCE_ONLY" ? ({ ...r, remaining: 0, ingredients: 2 } as unknown as typeof r) : r;
    };
    expect(zeroFactViolations(negative).length).toBeGreaterThan(0);
    expect(zeroFactViolations(counting).length).toBeGreaterThan(0);
  });
});

// ---- privacy ----

describe("privacy: FREE LEAK rejected (OD-H3-16)", () => {
  it("before purchase every paid target has one identical structure (key stripped)", () => {
    expect(freeLeakViolations((m) => selectableHintPresentation(m, [], 0))).toEqual([]);
    expect(freeLeakViolations((m) => selectableHintPresentation(m, [], 1000))).toEqual([]);
  });

  it("pizza-bianca: zero paid facts, safely, and its pre-purchase structure is the shared one", () => {
    const m = model("pizza-bianca");
    expect(m.purchasableFacts).toEqual([]);
    const shared = structureWithoutKey(selectableHintPresentation(model("capricciosa"), [], 50));
    expect(structureWithoutKey(selectableHintPresentation(m, [], 50))).toBe(shared);
    expect(selectableHintPresentation(m, [], 50)).toMatchObject({ nextPrice: 5, affordable: true, preferences: HINT_CATEGORIES });
    expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["topping"], expectedPaidCount: 0, pitzBalance: 50 })).toEqual(GUIDANCE);
  });

  it("puttanesca and all 5 slot-count leak recipes share the pre-purchase structure of every other target", () => {
    const shared = structureWithoutKey(selectableHintPresentation(model("bismarck"), [], 0));
    for (const id of SLOT_COUNT_LEAK_RECIPES) expect(structureWithoutKey(selectableHintPresentation(model(id), [], 0)), id).toBe(shared);
  });

  it("real topping / cheese / ingredient counts are not in the presentation: 3 rows and 3 preferences for every target", () => {
    const shapes = new Set(PAID_TARGETS.map((r) => distinct(r).length));
    expect(shapes.size).toBeGreaterThan(1); // the data does vary...
    for (const recipe of PAID_TARGETS) {
      const p = selectableHintPresentation(model(recipe.id), [], 0);
      expect(p.rows.map((r) => r.category)).toEqual(["sauce", "cheese", "topping"]); // ...the presentation does not
      expect(p.preferences).toEqual(["sauce", "cheese", "topping"]);
      expect(Object.keys(p).sort()).toEqual(["affordable", "kind", "nextPrice", "onboarding", "paidCount", "pitzBalance", "preferences", "rows"]);
      for (const row of p.rows) expect(Object.keys(row).sort()).toEqual(["category", "revealed"]);
    }
  });

  it("no topping ①②③: chips carry no position and are ordered by the ingredient catalog, not by purchase or recipe order", () => {
    const m = model("meat-lovers");
    const all = m.purchasableFacts.map((f) => f.id);
    const a = selectableHintPresentation(m, all, 0);
    const b = selectableHintPresentation(m, [...all].reverse(), 0);
    expect(b).toEqual(a);
    const catalog = INGREDIENTS.map((i) => i.id);
    for (const row of a.rows) {
      const order = row.revealed.map((c) => catalog.indexOf(c.ingredientId));
      expect(order).toEqual([...order].sort((x, y) => x - y));
      for (const chip of row.revealed) expect(Object.keys(chip).sort()).toEqual(["factId", "free", "ingredientId"]);
    }
    expect(JSON.stringify(a)).not.toMatch(/[①②③④⑤]|index|position|slot/);
  });

  it("the exact remaining fact count is not exposed at any paid count", () => {
    for (let paid = 0; paid <= 1; paid += 1) {
      const views = PAID_TARGETS.filter((r) => model(r.id).purchasableFacts.length > paid).map((r) => {
        const m = model(r.id);
        const p = selectableHintPresentation(m, m.purchasableFacts.slice(0, paid).map((f) => f.id), 100);
        return JSON.stringify({ nextPrice: p.nextPrice, paidCount: p.paidCount, affordable: p.affordable, keys: Object.keys(p) });
      });
      expect(new Set(views).size, `paid ${paid}`).toBe(1);
    }
  });
});

describe("privacy: PAID INFERENCE allowed (OD-H3-16)", () => {
  it("after paying for every fact, the player may learn there is nothing more (generic guidance), never a negative fact", () => {
    for (const recipe of PAID_TARGETS) {
      const m = model(recipe.id);
      if (m.purchasableFacts.length === 0) continue;
      const all = m.purchasableFacts.map((f) => f.id);
      const r = purchaseSelectableHint({ model: m, purchasedFactIds: all, preferences: ["topping"], expectedPaidCount: all.length, pitzBalance: 999 });
      expect(r).toEqual(GUIDANCE);
      const p = selectableHintPresentation(m, all, 999);
      expect(p.rows.flatMap((row) => row.revealed).length).toBe(all.length + 1); // everything paid + the key, never the reserve
      expect(JSON.stringify(p)).not.toContain(`"${m.reservedIngredientId}"`);
    }
  });

  it("paid facts are shown with the key in their own rows; the reserve stays hidden", () => {
    const m = model("puttanesca-pizza");
    const p = selectableHintPresentation(m, m.purchasableFacts.map((f) => f.id), 0);
    expect(p.rows.map((r) => r.revealed.map((c) => c.ingredientId))).toEqual([["tomato-sauce"], [], ["anchovy", "black-olive", "capers"]]);
    expect(m.reservedIngredientId).toBe("garlic");
  });
});

// ---- mutation / adversarial: the privacy checks must catch a broken implementation ----

describe("mutation tests: privacy and pricing checks detect breakage", () => {
  const good = (m: SelectableHintModel) => selectableHintPresentation(m, [], 100);

  it("baseline passes", () => {
    expect(freeLeakViolations(good)).toEqual([]);
    expect(resolverViolations(resolveHintPreferences)).toEqual([]);
  });

  const presentationMutants: Record<string, (m: SelectableHintModel) => unknown> = {
    "remaining count field": (m) => ({ ...good(m), remaining: m.purchasableFacts.length }),
    "per-row availability flag": (m) => ({ ...good(m), rows: good(m).rows.map((r) => ({ ...r, hasMore: m.purchasableFacts.some((f) => f.category === r.category) })) }),
    "empty categories omitted": (m) => ({ ...good(m), rows: good(m).rows.filter((r) => m.purchasableFacts.some((f) => f.category === r.category) || r.revealed.length > 0) }),
    "preferences filtered by availability": (m) => ({ ...good(m), preferences: HINT_CATEGORIES.filter((c) => m.purchasableFacts.some((f) => f.category === c)) }),
    "disabled when nothing to buy": (m) => ({ ...good(m), affordable: m.purchasableFacts.length > 0 }),
    "price shows the cap": (m) => ({ ...good(m), nextPrice: m.priceCap }),
    "reserved ingredient leaked": (m) => ({ ...good(m), rows: good(m).rows.map((r, i) => (i === 0 ? { ...r, revealed: [...r.revealed, { factId: `ing:${m.reservedIngredientId}`, ingredientId: m.reservedIngredientId, free: false }] } : r)) }),
    "unrevealed fact pre-rendered as hidden": (m) => ({ ...good(m), hidden: m.purchasableFacts.map((f) => f.id) }),
    "slot placeholders per real ingredient": (m) => ({ ...good(m), rows: good(m).rows.map((r) => ({ ...r, revealed: [...r.revealed, ...m.purchasableFacts.filter((f) => f.category === r.category).map(() => ({ factId: "ing:unknown", ingredientId: "?", free: false }))] })) }),
  };

  for (const [name, mutant] of Object.entries(presentationMutants)) {
    it(`FREE LEAK check catches: ${name}`, () => {
      expect(freeLeakViolations(mutant).length).toBeGreaterThan(0);
    });
  }

  const resolverMutants: Record<string, typeof resolveHintPreferences> = {
    "fallback returns the reserved ingredient": (m, owned, prefs) => {
      const got = resolveHintPreferences(m, owned, prefs);
      return got.length > 0 ? got : [{ id: `ing:${m.reservedIngredientId}`, ingredientId: m.reservedIngredientId!, category: "topping" }];
    },
    "returns an already owned fact": (m, owned, prefs) => (owned.length > 0 ? [owned[0]] : resolveHintPreferences(m, owned, prefs)),
    "sells the key": (m, owned, prefs) => {
      const key = m.freeFacts[0];
      return key && !owned.some((o) => o.ingredientId === key.ingredientId) ? [key] : resolveHintPreferences(m, owned, prefs);
    },
    "no fallback (strict category)": (m, owned, prefs) => {
      const taken = new Set(owned.map((f) => f.ingredientId));
      return prefs.flatMap((p) => m.purchasableFacts.filter((f) => f.category === p && !taken.has(f.ingredientId)).slice(0, 1));
    },
    "returns an absence fact": (m, owned, prefs) => {
      const got = resolveHintPreferences(m, owned, prefs);
      return got.length > 0 ? got : [{ id: "ing:none-cheese" as const, ingredientId: "none-cheese", category: "cheese" }];
    },
  };

  for (const [name, mutant] of Object.entries(resolverMutants)) {
    it(`resolver check catches: ${name}`, () => {
      expect(resolverViolations(mutant).length).toBeGreaterThan(0);
    });
  }

  it("Rule W check catches a 'first instead of last' reserve", () => {
    const firstInstead = (r: Recipe) => {
      const key = hintKeyIngredientId(r);
      for (const c of ["topping", "cheese", "sauce"]) {
        const cands = distinct(r).filter((id) => id !== key && getIngredient(id)?.category === c);
        if (cands.length) return cands[0];
      }
      return distinct(r)[0];
    };
    expect(RECIPES.filter((r) => [firstInstead(r)].join() !== currentH4Withheld(r).join()).length).toBeGreaterThan(0);
  });

  it("bypass check catches batch-size pricing (1=5, 2=15, 3=30, 4=50)", () => {
    const bySize = (_paid: number, count: number) => [0, 5, 15, 30, 50, 90, 140][count];
    const split = bySize(0, 1) + bySize(1, 1) + bySize(2, 1);
    expect(split).not.toBe(bySize(0, 3));
  });
});
