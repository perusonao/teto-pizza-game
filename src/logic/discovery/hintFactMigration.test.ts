import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../../data/recipes";
import { buildHintSteps, hintKeyIngredientId } from "./hintSteps";
import { legacyHintMapping, selectableHintSavedState, type LegacyHintMapping } from "./hintFactMigration";
import {
  buildSelectableHintModel,
  HINT_CATEGORIES,
  purchaseSelectableHint,
  resolveHintPreferences,
  selectableHintBatchPrice,
  selectableHintPresentation,
  type HintCategory,
  type SelectableHintModel,
} from "./selectableHint";

/**
 * Discovery Hint 3.0 (Issue #238), H3-2: the legacy Economy 1.0 level (H0..H4) read as Selectable
 * Hint progress, on all 25 runtime recipes. OD-H3-9: nothing already seen is lost, nothing already
 * seen is sold again, and the price ladder never rolls back.
 */

const DEX1 = { discoveredCount: 1 };
const LEVELS = [0, 1, 2, 3, 4] as const;
const model = (id: string): SelectableHintModel => buildSelectableHintModel(id, DEX1)!;
const lastLevel = (r: Recipe) => buildHintSteps(r, DEX1).at(-1)!.level;
const mapping = (id: string, level: number): LegacyHintMapping => legacyHintMapping(id, level === 0 ? {} : { [id]: level })!;
const chipIds = (m: SelectableHintModel, owned: readonly string[], legacy: LegacyHintMapping["legacy"]) =>
  selectableHintPresentation(m, owned, 0, legacy).rows.flatMap((r) => r.revealed.map((c) => c.ingredientId));

function sequences(length: number): HintCategory[][] {
  if (length === 0) return [[]];
  return sequences(length - 1).flatMap((s) => HINT_CATEGORIES.map((c) => [...s, c]));
}

describe("legacy mapping reads what the Hint 2.0 sheet really showed (25 recipes x H0..H4)", () => {
  it("visible lines are exactly buildHintSteps up to the (clamped) level; granted facts are exactly the ingredients they named", () => {
    for (const recipe of RECIPES) {
      for (const level of LEVELS) {
        const m = mapping(recipe.id, level);
        const clamped = Math.min(level, lastLevel(recipe));
        expect(m.legacyLevel, `${recipe.id} H${level}`).toBe(clamped);
        const steps = buildHintSteps(recipe, DEX1).filter((s) => s.level <= clamped);
        expect(m.visibleSteps).toEqual(steps);
        const named = steps.map((s) => s.namedIngredientId).filter((id): id is string => !!id);
        expect(m.grantedFactIds).toEqual(named.map((id) => `ing:${id}`));
        expect(m.progressOnlySteps).toEqual(steps.filter((s) => s.level > 0 && !s.namedIngredientId));
        expect(m.legacy).toEqual({ paidRungs: clamped, grantedFactIds: m.grantedFactIds });
      }
    }
  });

  it("no information lost: every ingredient an old level showed is shown again (as the free key or an owned fact)", () => {
    let lost = 0;
    for (const recipe of RECIPES) {
      const sm = model(recipe.id);
      for (const level of LEVELS) {
        const m = mapping(recipe.id, level);
        const shown = chipIds(sm, [], m.legacy);
        for (const fact of m.grantedFactIds) if (!shown.includes(fact.slice(4))) lost += 1;
      }
    }
    expect(lost).toBe(0);
  });

  it("the reserved ingredient (Rule W) is never granted: legacy never named it, so the n-1 protection holds after migration", () => {
    for (const recipe of RECIPES) {
      const reserved = model(recipe.id).reservedIngredientId;
      for (const level of LEVELS) expect(mapping(recipe.id, level).grantedFactIds, `${recipe.id} H${level}`).not.toContain(`ing:${reserved}`);
    }
  });

  it("lines that named no ingredient (count/cheese, coarse sauce) create no fact: kept as paid progress only", () => {
    for (const recipe of RECIPES) {
      const m = mapping(recipe.id, 4);
      for (const step of m.progressOnlySteps) expect(["COUNT_CHEESE", "SAUCE"]).toContain(step.axis);
      expect(m.grantedFactIds.every((id) => /^ing:[a-z0-9-]+$/.test(id))).toBe(true);
    }
    // pizza-bianca H2 is the coarse 「トマトじゃない」 line: progress, never a "not tomato" fact.
    expect(mapping("pizza-bianca", 2).progressOnlySteps.map((s) => s.axis)).toEqual(["SAUCE"]);
    expect(mapping("pizza-bianca", 3).grantedFactIds).toEqual(["ing:rosemary"]);
  });

  it("unknown / hostile recipe ids and malformed or hostile ledgers fail closed", () => {
    for (const bad of ["unknown-pizza", "__proto__", "constructor", "prototype", 3, null, undefined]) expect(legacyHintMapping(bad, {})).toBeNull();
    for (const ledger of [null, undefined, [], "x", 5, { napoletana: -1 }, { napoletana: 1.5 }, { napoletana: "3" }, { napoletana: Number.NaN }]) {
      expect(legacyHintMapping("napoletana", ledger)!.legacyLevel).toBe(0);
    }
    const hostile = JSON.parse('{"__proto__": {"napoletana": 4}, "constructor": 4}');
    expect(legacyHintMapping("napoletana", hostile)!.legacyLevel).toBe(0);
    expect(({} as Record<string, unknown>).napoletana).toBeUndefined();
  });

  it("a future level above the recipe's max is clamped, like purchasedHintLevel", () => {
    expect(mapping("napoletana", 9).legacyLevel).toBe(4);
    expect(mapping("bismarck", 9).legacyLevel).toBe(3);
  });

  it("the migration is a pure derived view: repeated reads are identical and the inputs are untouched", () => {
    const purchases = Object.freeze({ napoletana: 3, capricciosa: 2 });
    const save = Object.freeze({ discoveryHintPurchases: purchases, discoveryHintFacts: Object.freeze({ napoletana: Object.freeze(["ing:mozzarella"]) }) });
    const a = selectableHintSavedState("napoletana", save);
    const b = selectableHintSavedState("napoletana", save);
    expect(b).toEqual(a);
    expect(a).toEqual({ purchasedFactIds: ["ing:mozzarella"], legacy: { paidRungs: 3, grantedFactIds: ["ing:anchovy", "ing:tomato-sauce"] } });
    expect(save.discoveryHintPurchases).toEqual({ napoletana: 3, capricciosa: 2 });
  });
});

describe("price ladder continues where the legacy buyer left it (no roll-back)", () => {
  it("75-cap recipe (napoletana): old H1 -> next 10, H2 -> 20, H3 -> 40, H4 -> nothing charged", () => {
    const nap = model("napoletana");
    const next = LEVELS.map((l) => selectableHintPresentation(nap, [], 0, mapping("napoletana", l).legacy).nextPrice);
    expect(next).toEqual([5, 10, 20, 40, 0]);
  });

  it("35-cap recipe (bismarck): old H1 -> 10, H2 -> 20, H3 (everything) -> nothing charged", () => {
    const bis = model("bismarck");
    expect([0, 1, 2, 3].map((l) => selectableHintPresentation(bis, [], 0, mapping("bismarck", l).legacy).nextPrice)).toEqual([5, 10, 20, 0]);
  });

  it("for every recipe and level the next price is the next rung of the same ladder, capped", () => {
    for (const recipe of RECIPES) {
      const sm = model(recipe.id);
      for (const level of LEVELS) {
        const m = mapping(recipe.id, level);
        expect(selectableHintPresentation(sm, [], 0, m.legacy).nextPrice, `${recipe.id} H${level}`).toBe(selectableHintBatchPrice(m.legacyLevel, 1, sm.priceCap));
      }
    }
  });

  it("legacy + Hint 3.0 purchases never pay more in total than today's full cost (35/75)", () => {
    for (const recipe of RECIPES.filter((r) => r.id !== "margherita")) {
      const sm = model(recipe.id);
      for (const level of LEVELS) {
        const m = mapping(recipe.id, level);
        const legacySpent = selectableHintBatchPrice(0, m.legacyLevel, sm.priceCap);
        const rest = selectableHintBatchPrice(m.legacyLevel, 10, sm.priceCap);
        expect(legacySpent + rest, `${recipe.id} H${level}`).toBeLessThanOrEqual(sm.priceCap);
      }
    }
  });
});

describe("no double charge", () => {
  it("exhaustive: after migration no preference sequence ever sells a fact the old level already showed", () => {
    let duplicates = 0;
    for (const recipe of RECIPES.filter((r) => r.id !== "margherita")) {
      const sm = model(recipe.id);
      for (const level of LEVELS) {
        const m = mapping(recipe.id, level);
        const granted = new Set(m.grantedFactIds);
        for (const seq of sequences(3)) {
          let owned: readonly string[] = [];
          for (const pref of seq) {
            const r = purchaseSelectableHint({ model: sm, purchasedFactIds: owned, preferences: [pref], expectedPaidCount: selectableHintPresentation(sm, owned, 0, m.legacy).paidCount, pitzBalance: 999, legacy: m.legacy });
            if (!r.success) continue;
            duplicates += r.revealed.filter((f) => granted.has(f.id)).length;
            owned = r.nextPurchasedFactIds;
          }
        }
      }
    }
    expect(duplicates).toBe(0);
  });

  it("legacy + an already-owned Hint 3.0 fact: the fact is not sold again and not counted twice", () => {
    const nap = model("napoletana");
    const legacy = mapping("napoletana", 2).legacy; // anchovy (key), tomato-sauce
    const p = selectableHintPresentation(nap, ["ing:tomato-sauce", "ing:mozzarella"], 0, legacy);
    expect(p.paidCount).toBe(3); // 2 legacy rungs + mozzarella; the granted sauce adds no rung
    expect(resolveHintPreferences(nap, [], ["sauce"]).map((f) => f.id)).toEqual(["ing:tomato-sauce"]);
    const r = purchaseSelectableHint({ model: nap, purchasedFactIds: ["ing:mozzarella"], preferences: ["sauce"], expectedPaidCount: 3, pitzBalance: 999, legacy });
    expect(r).toEqual({ success: false, reason: "GUIDANCE_ONLY", guidance: "THINK_WITH_KNOWN_HINTS", price: 0 });
  });

  it("an unknown / future fact id in the ledger is not counted toward the price (fail closed) but is returned as stored", () => {
    const state = selectableHintSavedState("napoletana", { discoveryHintPurchases: { napoletana: 1 }, discoveryHintFacts: { napoletana: ["tech:fold", "finish:basil-oil", "ing:mozzarella"] } })!;
    expect(state.purchasedFactIds).toEqual(["tech:fold", "finish:basil-oil", "ing:mozzarella"]);
    const p = selectableHintPresentation(model("napoletana"), state.purchasedFactIds, 0, state.legacy);
    expect(p.paidCount).toBe(2); // legacy 1 + mozzarella; the two future facts add nothing
    expect(p.nextPrice).toBe(20);
  });
});

describe("mutation: the migration checks catch broken mappings", () => {
  it("a mapping that grants N facts for level N ('H3 = 3 facts') is caught by the value check", () => {
    const naive = (recipe: Recipe, level: number) => model(recipe.id).purchasableFacts.slice(0, level).map((f) => f.id);
    const mismatches = RECIPES.filter((r) => LEVELS.some((l) => naive(r, l).join() !== mapping(r.id, l).grantedFactIds.filter((id) => id !== `ing:${hintKeyIngredientId(r)}`).join()));
    expect(mismatches.length).toBeGreaterThan(0);
  });

  it("a mapping that resets paid progress (paidRungs 0) is caught by the ladder check", () => {
    const nap = model("napoletana");
    const reset = { ...mapping("napoletana", 3).legacy, paidRungs: 0 };
    expect(selectableHintPresentation(nap, [], 0, reset).nextPrice).not.toBe(40);
  });

  it("a mapping that forgets granted facts would re-sell them (caught by the duplicate check)", () => {
    const nap = model("napoletana");
    const forgot = { paidRungs: 2, grantedFactIds: [] };
    const r = purchaseSelectableHint({ model: nap, purchasedFactIds: [], preferences: ["sauce"], expectedPaidCount: 2, pitzBalance: 999, legacy: forgot });
    expect(r.success && r.revealed.map((f) => f.id)).toEqual(["ing:tomato-sauce"]); // tomato was shown by the old H2
  });
});
