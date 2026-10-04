import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { createDefaultSave, loadSave, SAVE_STORAGE_KEY } from "../../state/persistence";
import {
  attributeAnswerForReserve,
  INGREDIENT_TOTAL_FACT_ID,
  MIN_ATTRIBUTE_CANDIDATES,
  reserveAttributeAnswer,
} from "./deductionHint";
import {
  guardedAnswerForParts,
  guardedReserveAttributeAnswer,
  hypotheticalParts,
  hypotheticalReserves,
  partitionAllowsDh41,
  privacyPartitionUniverse,
  strictAnswerForParts,
  structureAnswer,
  targetReserveParts,
  TOPPING_TOTAL_FACT_ID,
  toppingClauseAllowed,
  toppingClauseAllowedForParts,
} from "./deductionGuard";
import {
  ALL_INGREDIENT_IDS,
  forcedIngredients,
  inversionCandidates,
  ladderTargets,
  observeDh41,
  observeGuarded,
  observeGuardedWithClause,
  ownedAt,
  partsOf,
  reachableKnownSets,
  recipeCounts,
  sweepStates,
} from "./testSupport/deductionInversion";
import { dh42aHypotheses } from "./testSupport/deductionGuardDh42a";

/**
 * Discovery Hint 4.0 DH4-2A (Issue #253): the partition guard, TC-G and the structure answer.
 * Authority: OD-DH4-2-1..13 and the DH4-2A Implementation Plan test matrix (T-01..T-09, T-15).
 * The pinned numbers equal the DH4-2 audit JSON (`finalGate`, audit commit 2f0ffaa).
 */
const LADDER = W1_25_DISCOVERY_LADDER;
const STATES = sweepStates(LADDER);
const TARGETS = ladderTargets(LADDER).slice(1);
const ctxAt = (step: number, owned: readonly unknown[] = ownedAt(step, LADDER)) => ({ discoveredCount: step, ownedIngredientIds: owned });

/** The 29 states where DH4-1 alone lets a guard-aware player name the reserve (audit §5.3). */
const DH41_LEAKS: Record<string, { steps: [number, number]; named: string }> = {
  bismarck: { steps: [2, 4], named: "mozzarella" },
  funghi: { steps: [3, 4], named: "mozzarella" },
  "breakfast-pizza": { steps: [11, 24], named: "egg" },
  "meat-lovers": { steps: [16, 24], named: "sausage" },
  "quattro-formaggi": { steps: [24, 24], named: "fontina" },
};

describe("DH4-2A sweep universe", () => {
  it("is the audited 300 target x ladder-inventory states, every target makeable from its owned set", () => {
    expect(STATES).toHaveLength(300);
    expect(TARGETS).toHaveLength(24);
    for (const s of STATES) {
      const parts = partsOf(s);
      expect(parts, s.recipeId).not.toBeNull();
      expect(parts.recipeIngredientIds.every((id) => s.owned.includes(id)), `${s.recipeId}@${s.step}`).toBe(true);
    }
    // The frozen W1 ladder (24 steps) owns every ingredient except the appended-step chicken (No.27) and shrimp (Expansion Slice 1).
    expect(new Set(ownedAt(24, LADDER))).toEqual(new Set(ALL_INGREDIENT_IDS.filter((id) => id !== "chicken" && id !== "shrimp")));
  });
});

describe("T-01 DH4-1 parity: attributeAnswerForReserve is the unchanged DH4-1 rule", () => {
  it("equals reserveAttributeAnswer for all 300 states and for the all-owned catalog", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      const extracted = attributeAnswerForReserve({ recipeIngredientIds: parts.recipeIngredientIds, reserveId: parts.reserveId, ownedIngredientIds: s.owned });
      expect(extracted, `${s.recipeId}@${s.step}`).toEqual(reserveAttributeAnswer(s.recipeId, ctxAt(s.step, s.owned)));
    }
  });

  it("the real reserve is always one of the hypotheses, and its hypothetical parts are the real parts", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      expect(hypotheticalReserves(parts)).toContain(parts.reserveId);
      expect(new Set(hypotheticalParts(parts, parts.reserveId).recipeIngredientIds)).toEqual(new Set(parts.recipeIngredientIds));
    }
  });
});

describe("T-02 / T-05 inversion: the answer level never names the reserve", () => {
  it("reproduces the old leak: DH4-1 alone names the reserve in exactly 29 of 300 states (5 recipes)", () => {
    const leaks = STATES.filter((s) => inversionCandidates(partsOf(s), observeDh41, dh42aHypotheses).length < MIN_ATTRIBUTE_CANDIDATES);
    expect(leaks).toHaveLength(29);
    const byRecipe = new Map<string, number[]>();
    for (const s of leaks) byRecipe.set(s.recipeId, [...(byRecipe.get(s.recipeId) ?? []), s.step]);
    expect([...byRecipe.keys()].sort()).toEqual(Object.keys(DH41_LEAKS).sort());
    for (const [recipeId, { steps, named }] of Object.entries(DH41_LEAKS)) {
      const expected = Array.from({ length: steps[1] - steps[0] + 1 }, (_, i) => steps[0] + i);
      expect(byRecipe.get(recipeId), recipeId).toEqual(expected);
      for (const s of leaks.filter((l) => l.recipeId === recipeId)) expect(inversionCandidates(partsOf(s), observeDh41, dh42aHypotheses)).toEqual([named]);
    }
  });

  it("the partition guard: 0 of 300 states name the reserve, with and without the topping clause", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      expect(inversionCandidates(parts, observeGuarded).length, `${s.recipeId}@${s.step}`).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
      expect(inversionCandidates(parts, observeGuardedWithClause).length, `${s.recipeId}@${s.step} +clause`).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
    }
  });

  it("each of the 29 old leak states is now answered without isolating the named ingredient", () => {
    for (const [recipeId, { steps, named }] of Object.entries(DH41_LEAKS)) {
      for (let step = steps[0]; step <= steps[1]; step += 1) {
        const cands = inversionCandidates(partsOf({ recipeId, targetIndex: 0, step, owned: ownedAt(step, LADDER) }), observeGuarded);
        expect(cands, `${recipeId}@${step}`).toContain(named);
        expect(cands.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("full ownership (every catalog ingredient, in acquisition order) is also 0", () => {
    TARGETS.forEach((recipeId, i) => {
      const parts = targetReserveParts(recipeId, ctxAt(i + 1, ALL_INGREDIENT_IDS))!;
      expect(inversionCandidates(parts, observeGuardedWithClause).length, recipeId).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("T-03 the guard decides from W / H only", () => {
  it("every hypothetical reserve of a state takes the same branch (DH4-1 or strict)", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      const branch = partitionAllowsDh41(parts);
      for (const x of hypotheticalReserves(parts)) expect(partitionAllowsDh41(hypotheticalParts(parts, x)), `${s.recipeId}@${s.step} x=${x}`).toBe(branch);
    }
  });

  it("every hypothetical reserve sees the same W and the same TC-G sides", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      const w = new Set(privacyPartitionUniverse(parts));
      for (const x of hypotheticalReserves(parts)) {
        expect(new Set(privacyPartitionUniverse(hypotheticalParts(parts, x))), `${s.recipeId}@${s.step} x=${x}`).toEqual(w);
      }
    }
  });
});

describe("T-04 pinned levels (hardened guard, DH4-2B Pre-Implementation Gate; the DH4-2A audit finalGate had existence 144 · category 155 · group 1)", () => {
  const levels = (answers: (string | undefined)[]) => {
    const out: Record<string, number> = {};
    for (const a of answers) out[a!] = (out[a!] ?? 0) + 1;
    return out;
  };
  it("the 300-state sweep: existence 123 · category 164 · group 13", () => {
    expect(levels(STATES.map((s) => guardedAnswerForParts(partsOf(s))?.level))).toEqual({ existence: 123, category: 164, group: 13 });
  });
  it("ladder-owned and all owned are identical (the key rule): category 12 · group 1 · existence 11", () => {
    expect(levels(TARGETS.map((id, i) => guardedReserveAttributeAnswer(id, ctxAt(i + 1))?.level))).toEqual({ category: 12, group: 1, existence: 11 });
    expect(levels(TARGETS.map((id, i) => guardedReserveAttributeAnswer(id, ctxAt(i + 1, ALL_INGREDIENT_IDS))?.level))).toEqual({ category: 12, group: 1, existence: 11 });
  });
  it("the strict fallback is never finer than the DH4-1 answer it replaces would allow (family never forced)", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      if (!partitionAllowsDh41(parts)) expect(guardedAnswerForParts(parts)).toEqual(strictAnswerForParts(parts));
    }
  });
});

describe("T-06 determinism and hostile input", () => {
  it("T1a: an acquisition order that cannot be trusted is never guessed -- not a target (fail closed)", () => {
    for (const s of STATES.filter((_, i) => i % 7 === 0)) {
      const hostile = [
        [...s.owned].reverse(), // a starter after a non-starter
        [...s.owned, s.owned[s.owned.length - 1]], // a duplicate
        [...s.owned, "__proto__"], // a non-catalog id
        [...s.owned, 42 as never], // a non-string
      ];
      for (const owned of hostile) {
        expect(guardedReserveAttributeAnswer(s.recipeId, ctxAt(s.step, owned)), `${s.recipeId}@${s.step}`).toBeNull();
        expect(structureAnswer(s.recipeId, ctxAt(s.step, owned))).toBeNull();
        expect(toppingClauseAllowed(s.recipeId, ctxAt(s.step, owned))).toBe(false);
      }
    }
  });
  it("T1a: re-ordering what was bought after the target became makeable never changes the answer or TC-G", () => {
    for (const s of STATES.filter((_, i) => i % 7 === 0)) {
      const parts = targetReserveParts(s.recipeId, ctxAt(s.step, s.owned))!;
      const cut = s.owned.indexOf(parts.keyId!) + 1;
      const reordered = [...s.owned.slice(0, cut), ...s.owned.slice(cut).reverse()];
      expect(guardedReserveAttributeAnswer(s.recipeId, ctxAt(s.step, reordered))).toEqual(guardedReserveAttributeAnswer(s.recipeId, ctxAt(s.step, s.owned)));
      expect(toppingClauseAllowed(s.recipeId, ctxAt(s.step, reordered))).toBe(toppingClauseAllowed(s.recipeId, ctxAt(s.step, s.owned)));
    }
  });
  it("not a target: unknown / hostile recipe ids, the Dex-0 onboarding, non-array owned, an unmakeable recipe", () => {
    for (const id of ["nope", "__proto__", 7, null, undefined]) {
      expect(guardedReserveAttributeAnswer(id, ctxAt(5))).toBeNull();
      expect(structureAnswer(id, ctxAt(5))).toBeNull();
      expect(toppingClauseAllowed(id, ctxAt(5))).toBe(false);
    }
    expect(guardedReserveAttributeAnswer("margherita", { discoveredCount: 0, ownedIngredientIds: ALL_INGREDIENT_IDS })).toBeNull();
    // A hint target is DISCOVERABLE (every ingredient owned). Anything else is not a target and gets
    // no answer at all (DH4-2B Pre-Implementation Gate, P3 reserve-owned precondition).
    expect(guardedReserveAttributeAnswer("bismarck", { discoveredCount: 1, ownedIngredientIds: "egg" })).toBeNull();
    expect(structureAnswer("bismarck", { discoveredCount: 1, ownedIngredientIds: "egg" })).toBeNull();
    const reserve = targetReserveParts("capricciosa", ctxAt(24, ALL_INGREDIENT_IDS))!.reserveId;
    const withoutReserve = ALL_INGREDIENT_IDS.filter((id) => id !== reserve);
    expect(targetReserveParts("capricciosa", ctxAt(24, withoutReserve))).toBeNull();
    expect(guardedReserveAttributeAnswer("capricciosa", ctxAt(24, withoutReserve))).toBeNull();
    expect(toppingClauseAllowed("capricciosa", ctxAt(24, withoutReserve))).toBe(false);
  });
});

describe("T-07 output shape: no name, no id, no count; the id survives the save path", () => {
  const INGREDIENT_IDS = INGREDIENTS.map((i) => i.id);
  it("every guarded answer is a positive fact id without an ingredient id and without count keys", () => {
    for (const s of STATES) {
      const a = guardedAnswerForParts(partsOf(s))!;
      expect(a.factId).toMatch(/^attr:(existence|family:[a-z]+|group:[a-z]+|category:(sauce|cheese|topping))$/);
      expect(INGREDIENT_IDS.some((id) => a.factId.split(":").includes(id))).toBe(false);
      expect(Object.keys(a).some((k) => /count|candidate|size|pool|k$/i.test(k))).toBe(false);
    }
  });
  it("loadSave keeps every fact id this layer can produce", () => {
    const ids = new Set<string>([INGREDIENT_TOTAL_FACT_ID, TOPPING_TOTAL_FACT_ID]);
    for (const s of STATES) ids.add(guardedAnswerForParts(partsOf(s))!.factId);
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...createDefaultSave(), discoveryHintFacts: { capricciosa: [...ids] } }));
    const loaded = loadSave(storage);
    expect([...(loaded.discoveryHintFacts as Record<string, string[]>).capricciosa].sort()).toEqual([...ids].sort());
  });
});

describe("T-08 TC-G: the topping clause (OD-DH4-2-1)", () => {
  it("is never allowed for a zero-topping recipe, at any state", () => {
    for (const s of STATES.filter((st) => recipeCounts(st.recipeId).toppings === 0)) expect(toppingClauseAllowedForParts(partsOf(s))).toBe(false);
    expect(STATES.some((s) => recipeCounts(s.recipeId).toppings === 0)).toBe(true);
  });
  it("never for T = 0 even when every H side has >= 2 members (a future-catalog shape, synthetic parts)", () => {
    // A zero-topping pizza (tomato sauce + fontina + mozzarella; fontina, the last ladder material, is
    // the key, so nothing owned is ruled out by the key rule; reserve mozzarella) with everything owned:
    // H has cheeses and toppings, each side >= 2, so only the T rule keeps 「トッピング0」 from being told.
    const parts = { recipeIngredientIds: ["tomato-sauce", "fontina", "mozzarella"], reserveId: "mozzarella", keyId: "fontina", owned: [...ALL_INGREDIENT_IDS] };
    const sides = new Map<string, number>();
    for (const id of privacyPartitionUniverse(parts)) sides.set(getIngredient(id)!.category, (sides.get(getIngredient(id)!.category) ?? 0) + 1);
    expect([...sides.keys()].sort()).toEqual(["cheese", "sauce", "topping"]);
    expect([...sides.values()].every((n) => n >= 2)).toBe(true);
    expect(toppingClauseAllowedForParts(parts)).toBe(false);
    // P2-2 (H-only): the same known part with a topping reserve is NOT told either, because a cheese
    // hypothesis in H would have T = 0. So a missing clause never implies 「トッピング0」.
    expect(toppingClauseAllowedForParts({ ...parts, recipeIngredientIds: ["tomato-sauce", "fontina", "mozzarella", "basil"], reserveId: "basil" })).toBe(false);
    // With a topping in the known part every hypothesis has T >= 1: told.
    expect(toppingClauseAllowedForParts({ ...parts, recipeIngredientIds: ["tomato-sauce", "fontina", "mozzarella", "basil", "egg"], reserveId: "egg" })).toBe(true);
  });
  it("pinned: passes for 13/24 at the ladder state and 13/24 with everything owned (DH4-2A: 11 / 23)", () => {
    expect(TARGETS.filter((id, i) => toppingClauseAllowed(id, ctxAt(i + 1))).length).toBe(13);
    // With everything owned DH4-2A counted ingredients unlocked after the key as decoys; the key rule
    // rules them out, so the inventory beyond the key step no longer changes the decision.
    expect(TARGETS.filter((id, i) => toppingClauseAllowed(id, ctxAt(i + 1, ALL_INGREDIENT_IDS))).length).toBe(13);
  });
  it("P2-2: the decision is H-only — identical for every hypothesis in H, so a missing clause never implies 「トッピング0」", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      const told = toppingClauseAllowedForParts(parts);
      for (const x of hypotheticalReserves(parts)) expect(toppingClauseAllowedForParts(hypotheticalParts(parts, x)), `${s.recipeId}@${s.step} x=${x}`).toBe(told);
    }
  });
});

describe("T-09 structure answer (D-prime)", () => {
  it("every target and state: the exact distinct total, the clause only when TC-G passes, never 0", () => {
    for (const s of STATES) {
      const answer = structureAnswer(s.recipeId, ctxAt(s.step, s.owned))!;
      const counts = recipeCounts(s.recipeId);
      expect(answer.total).toBe(counts.total);
      expect(answer.total).toBeGreaterThanOrEqual(2);
      const allowed = toppingClauseAllowed(s.recipeId, ctxAt(s.step, s.owned));
      expect(answer.factIds).toEqual(allowed ? [INGREDIENT_TOTAL_FACT_ID, TOPPING_TOTAL_FACT_ID] : [INGREDIENT_TOTAL_FACT_ID]);
      expect(answer.toppingTotal).toBe(allowed ? counts.toppings : null);
      if (answer.toppingTotal !== null) expect(answer.toppingTotal).toBeGreaterThanOrEqual(1);
    }
  });
  it("carries no remaining count and no per-category count", () => {
    const a = structureAnswer("capricciosa", ctxAt(24, ALL_INGREDIENT_IDS))!;
    expect(Object.keys(a).sort()).toEqual(["factIds", "toppingTotal", "total"]);
    expect(a.factIds.every((id) => /^meta:(ingredient|topping)-total$/.test(id))).toBe(true);
  });
});

describe("Combined inference (OD-DH4-2-1 / 2): total + optional clause + guarded attribute", () => {
  it("never forces the reserve in any of the 300 states x every reachable purchase state (N via bought total or ADD_ONE)", () => {
    const materialNamed = new Set<string>();
    for (const s of STATES) {
      const parts = partsOf(s);
      const counts = recipeCounts(s.recipeId);
      const facts = { N: counts.total, ...(toppingClauseAllowedForParts(parts) ? { T: counts.toppings } : {}) };
      const attribute = guardedAnswerForParts(parts)!;
      const sellable = parts.recipeIngredientIds.filter((id) => id !== parts.reserveId);
      for (const known of reachableKnownSets(s)) {
        for (const extra of [{}, { A: attribute }]) {
          const forced = forcedIngredients(s.owned, known, { ...facts, ...extra });
          const base = forcedIngredients(s.owned, known, extra);
          expect(forced.has(parts.reserveId) && !base.has(parts.reserveId), `${s.recipeId}@${s.step} known=${[...known]}`).toBe(false);
          if ([...forced].some((id) => !base.has(id) && sellable.includes(id) && !known.has(id))) materialNamed.add(s.recipeId);
        }
      }
    }
    // Economy note (audit §4.2): the clause can stand in for an unbought mozzarella fact early on.
    expect([...materialNamed].sort()).toEqual(["breakfast-pizza", "melanzane-pizza", "parmigiana-pizza"]);
  });

  it("raw topping counts (no TC-G) would name the reserve: the guard is load-bearing", () => {
    const named = new Set<string>();
    for (const s of STATES) {
      const parts = partsOf(s);
      const counts = recipeCounts(s.recipeId);
      const known = new Set(parts.recipeIngredientIds.filter((id) => id !== parts.reserveId));
      if (forcedIngredients(s.owned, known, { N: counts.total, T: counts.toppings }).has(parts.reserveId)) named.add(s.recipeId);
    }
    expect([...named].sort()).toEqual(["bismarck", "funghi", "quattro-formaggi"]);
  });
});

describe("T-15 wiring boundary (DH4-2B)", () => {
  it("DH4-2B boundary: the only production importer of the Deduction Hint layer is the hint state module", () => {
    const sources = import.meta.glob<string>(["../../**/*.{ts,tsx}", "!../../**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true });
    const own = /\/(deductionHint|deductionGuard|deductionRequest|deductionFlag|ingredientTaxonomy)\.ts$|\/testSupport\//;
    const importers = Object.entries(sources)
      .filter(([path]) => !own.test(path))
      .filter(([, text]) => /(from\s+|import\s*\(\s*)["'][^"']*(deductionHint|deductionGuard|deductionRequest|deductionFlag|ingredientTaxonomy)["']/.test(text))
      .map(([path]) => path);
    // DH4-2B wires the layer through src/state/discoveryHint.ts only (the reducer calls it there);
    // the UI (DH4-2C) reads the view model, never the layer.
    // Hint 5.0 H5-1 (Issue #292, Final Design §14) adds two sanctioned read-only readers. They are
    // unwired: no production module imports them (hint5Production.gate.test.ts).
    // Ingredient Category Tabs 1.0 Phase 1: ingredientShelf.ts reads the family ids only (unwired UI shelf authority).
    expect([...importers].sort()).toEqual([
      "../../data/hintClassDisplay.ts",
      "../../data/ingredientShelf.ts",
      "../../state/discoveryHint.ts",
      "./hint5Ladder.ts",
    ]);
    expect(Object.keys(sources).some((p) => p.endsWith("/App.tsx"))).toBe(true);
  });

  it("taxonomy is read, never guessed: family-less reserves (sauce / cheese) never get family or group answers", () => {
    for (const s of STATES) {
      const parts = partsOf(s);
      const a = guardedAnswerForParts(parts)!;
      if (getIngredient(parts.reserveId)!.category !== "topping") expect(["category", "existence"]).toContain(a.level);
    }
    expect(RECIPES.length).toBe(28);
  });
});
