import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { INGREDIENTS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { INGREDIENT_TOTAL_FACT_ID, legacyOwnsIngredientTotal } from "./deductionHint";
import { guardedReserveAttributeAnswer, structureAnswer, TOPPING_TOTAL_FACT_ID } from "./deductionGuard";
import {
  deductionKnownLines,
  deductionOwnership,
  parseAttributeFactId,
  requestDeductionHint,
  type DeductionRequestInput,
} from "./deductionRequest";
import { ALL_INGREDIENT_IDS, ladderTargets, ownedAt, sweepStates } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 4.0 DH4-2A (Issue #253): the 構成 / 特徴 request authority and the known-fact lines.
 * Authority: OD-DH4-2-1..13 and the DH4-2A Implementation Plan (T-10..T-14).
 */
const LADDER = W1_25_DISCOVERY_LADDER;
const STATES = sweepStates(LADDER);
const TARGETS = ladderTargets(LADDER).slice(1);
const ctxAt = (step: number, owned: readonly unknown[] = ownedAt(step, LADDER)) => ({ discoveredCount: step, ownedIngredientIds: owned });

function input(over: Partial<DeductionRequestInput> & Pick<DeductionRequestInput, "family" | "recipeId" | "context">): DeductionRequestInput {
  return { storedFactIds: [], legacyPurchases: {}, requestPrice: 5, paidCount: 0, expectedPaidCount: 0, pitzBalance: 100, ...over };
}

describe("T-10 order of evaluation: refusals never depend on what is left", () => {
  it("family, target, price, STALE and balance are decided before any answer, identically for every target", () => {
    for (const s of STATES.filter((_, i) => i % 5 === 0)) {
      const ctx = ctxAt(s.step, s.owned);
      for (const family of ["structure", "attribute"] as const) {
        const base = { family, recipeId: s.recipeId, context: ctx };
        expect(requestDeductionHint(input({ ...base, pitzBalance: 4 }))).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
        expect(requestDeductionHint(input({ ...base, expectedPaidCount: 1 }))).toEqual({ outcome: "REJECTED", reason: "STALE" });
        for (const bad of [-1, 1.5, Number.NaN, Infinity]) expect(requestDeductionHint(input({ ...base, requestPrice: bad }))).toEqual({ outcome: "REJECTED", reason: "INVALID_PRICE" });
        // Even a fully owned family refuses on the balance first: the refusal is the same for everyone.
        const owned = [INGREDIENT_TOTAL_FACT_ID, TOPPING_TOTAL_FACT_ID, "attr:category:topping"];
        expect(requestDeductionHint(input({ ...base, storedFactIds: owned, pitzBalance: 4 }))).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
      }
    }
  });
  it("invalid family / not a target", () => {
    for (const family of ["material", "technique", "", null, 1, "__proto__"]) {
      expect(requestDeductionHint(input({ family, recipeId: "funghi", context: ctxAt(3) }))).toEqual({ outcome: "REJECTED", reason: "INVALID_FAMILY" });
    }
    for (const recipeId of ["nope", "__proto__", 3, null]) {
      expect(requestDeductionHint(input({ family: "structure", recipeId, context: ctxAt(3) }))).toEqual({ outcome: "REJECTED", reason: "NOT_A_TARGET" });
    }
    expect(requestDeductionHint(input({ family: "attribute", recipeId: "margherita", context: { discoveredCount: 0, ownedIngredientIds: ALL_INGREDIENT_IDS } }))).toEqual({
      outcome: "REJECTED",
      reason: "NOT_A_TARGET",
    });
  });
  it("a price is never chosen here: the charge is exactly the caller's price, or 0", () => {
    for (const price of [0, 5, 10, 40, 999]) {
      const r = requestDeductionHint(input({ family: "structure", recipeId: "capricciosa", context: ctxAt(11), requestPrice: price, pitzBalance: 1000 }));
      expect(r).toMatchObject({ outcome: "ANSWERED", charge: price });
    }
  });
});

describe("T-11 existence-only (OD-DH4-2-4): charge 0, nothing stored, input untouched", () => {
  it("every state whose guarded answer is existence", () => {
    let seen = 0;
    for (const s of STATES) {
      const ctx = ctxAt(s.step, s.owned);
      if (guardedReserveAttributeAnswer(s.recipeId, ctx)!.level !== "existence") continue;
      seen += 1;
      const stored = Object.freeze(["ing:tomato-sauce", INGREDIENT_TOTAL_FACT_ID]);
      const legacy = Object.freeze({});
      const snapshot = JSON.stringify([stored, legacy]);
      const r = requestDeductionHint(input({ family: "attribute", recipeId: s.recipeId, context: ctx, storedFactIds: stored, legacyPurchases: legacy }));
      expect(r).toEqual({ outcome: "EXISTENCE_ONLY", family: "attribute", addFactIds: [], charge: 0 });
      expect(JSON.stringify([stored, legacy])).toBe(snapshot);
    }
    expect(seen).toBe(144);
  });
  it("a stored attr:existence (hostile save) is not a purchase: the family is still requestable", () => {
    const r = requestDeductionHint(input({ family: "attribute", recipeId: "capricciosa", context: ctxAt(24, ALL_INGREDIENT_IDS), storedFactIds: ["attr:existence"] }));
    expect(r.outcome).toBe("ANSWERED");
    expect(deductionOwnership("capricciosa", ["attr:existence"], {}).attributeOwned).toBe(false);
  });
});

describe("T-12 single-shot families and legacy ownership", () => {
  it("attribute: ANSWERED once, then ALREADY_OWNED at charge 0", () => {
    for (const s of STATES) {
      const ctx = ctxAt(s.step, s.owned);
      const first = requestDeductionHint(input({ family: "attribute", recipeId: s.recipeId, context: ctx }));
      if (first.outcome !== "ANSWERED") continue;
      expect(first.addFactIds).toEqual([guardedReserveAttributeAnswer(s.recipeId, ctx)!.factId]);
      const again = requestDeductionHint(input({ family: "attribute", recipeId: s.recipeId, context: ctx, storedFactIds: first.addFactIds }));
      expect(again).toEqual({ outcome: "ALREADY_OWNED", family: "attribute", addFactIds: [], charge: 0 });
    }
  });
  it("structure: total (+ clause when TC-G passes) once; afterwards GUIDANCE_ONLY or ALREADY_OWNED at charge 0", () => {
    for (const s of STATES) {
      const ctx = ctxAt(s.step, s.owned);
      const expected = structureAnswer(s.recipeId, ctx)!.factIds;
      const first = requestDeductionHint(input({ family: "structure", recipeId: s.recipeId, context: ctx }));
      expect(first).toEqual({ outcome: "ANSWERED", family: "structure", addFactIds: expected, charge: 5 });
      const again = requestDeductionHint(input({ family: "structure", recipeId: s.recipeId, context: ctx, storedFactIds: expected }));
      expect(again.outcome).toBe(expected.length === 2 ? "ALREADY_OWNED" : "GUIDANCE_ONLY");
      expect(again).toMatchObject({ addFactIds: [], charge: 0 });
    }
  });
  it("a later inventory can add the clause for a total owner (charged once), never the total again", () => {
    // capricciosa: the clause fails at its ladder step and passes with everything owned.
    const stored = [INGREDIENT_TOTAL_FACT_ID];
    expect(requestDeductionHint(input({ family: "structure", recipeId: "capricciosa", context: ctxAt(11), storedFactIds: stored })).outcome).toBe("GUIDANCE_ONLY");
    expect(requestDeductionHint(input({ family: "structure", recipeId: "capricciosa", context: ctxAt(24, ALL_INGREDIENT_IDS), storedFactIds: stored }))).toEqual({
      outcome: "ANSWERED",
      family: "structure",
      addFactIds: [TOPPING_TOTAL_FACT_ID],
      charge: 5,
    });
  });
  it("legacy 「材料は全部で○種類」 (OD-DH4-8): the total is owned and never resold, for all 25 x H0..H4", () => {
    for (const recipe of RECIPES) {
      const index = ladderTargets(LADDER).indexOf(recipe.id);
      if (index <= 0) continue;
      for (const level of [0, 1, 2, 3, 4]) {
        const purchases = level ? { [recipe.id]: level } : {};
        const legacy = legacyOwnsIngredientTotal(recipe.id, purchases);
        for (const owned of [ownedAt(index, LADDER), ALL_INGREDIENT_IDS]) {
          const r = requestDeductionHint(input({ family: "structure", recipeId: recipe.id, context: ctxAt(index, owned), legacyPurchases: purchases }));
          if (r.outcome === "ANSWERED") expect(r.addFactIds.includes(INGREDIENT_TOTAL_FACT_ID), `${recipe.id} H${level}`).toBe(!legacy);
          if (legacy) expect(r.outcome === "ANSWERED" ? r.addFactIds : [], `${recipe.id} H${level}`).not.toContain(INGREDIENT_TOTAL_FACT_ID);
          expect(deductionKnownLines(recipe.id, ctxAt(index, owned), [], purchases).legacyStructure).toBe(legacy);
        }
      }
    }
    expect(RECIPES.some((r) => legacyOwnsIngredientTotal(r.id, { [r.id]: 4 }))).toBe(true);
  });
  it("a legacy line grants nothing else: no clause, no attribute", () => {
    const own = deductionOwnership("capricciosa", [], { capricciosa: 4 });
    expect(own).toEqual({ structureTotalOwned: true, structureTotalFromLegacyOnly: true, toppingClauseOwned: false, attributeOwned: false });
  });
});

describe("T-13 no double fact, no material fact", () => {
  it("addFactIds never contains an ing: id or an id already stored; the two families are disjoint", () => {
    for (const s of STATES.filter((_, i) => i % 3 === 0)) {
      const ctx = ctxAt(s.step, s.owned);
      const st = requestDeductionHint(input({ family: "structure", recipeId: s.recipeId, context: ctx }));
      const at = requestDeductionHint(input({ family: "attribute", recipeId: s.recipeId, context: ctx }));
      const sIds = st.outcome === "ANSWERED" ? st.addFactIds : [];
      const aIds = at.outcome === "ANSWERED" ? at.addFactIds : [];
      expect([...sIds, ...aIds].some((id) => id.startsWith("ing:"))).toBe(false);
      expect(sIds.every((id) => id.startsWith("meta:"))).toBe(true);
      expect(aIds.every((id) => id.startsWith("attr:") && id !== "attr:existence")).toBe(true);
      expect(new Set([...sIds, ...aIds]).size).toBe(sIds.length + aIds.length);
    }
  });
});

describe("T-14 known-fact lines: positive, own facts only, never 0", () => {
  const NAMES = INGREDIENTS.map((i) => i.nameJa);
  const RECIPE_NAMES = RECIPES.map((r) => r.nameJa);
  it("only what is stored is shown, with no name, level label, 「？」, remaining count or 0", () => {
    for (const s of STATES) {
      const ctx = ctxAt(s.step, s.owned);
      const structure = structureAnswer(s.recipeId, ctx)!;
      const attr = guardedReserveAttributeAnswer(s.recipeId, ctx)!;
      const stored = [...structure.factIds, ...(attr.level === "existence" ? [] : [attr.factId])];
      const lines = deductionKnownLines(s.recipeId, ctx, stored, {});
      expect(lines.structure).toHaveLength(structure.factIds.length);
      expect(lines.structure[0]).toBe(`このピザは全部で${structure.total}種類の材料を使うよ`);
      if (structure.toppingTotal !== null) expect(lines.structure[1]).toBe(`トッピングは${structure.toppingTotal}種類使うよ`);
      expect(lines.attribute).toHaveLength(attr.level === "existence" ? 0 : 1);
      for (const line of [...lines.structure, ...lines.attribute]) {
        expect(line).not.toMatch(/[？?]|残り|あと|0種類|family|group|category|existence/);
        for (const n of [...NAMES, ...RECIPE_NAMES]) expect(line.includes(n), `${line} / ${n}`).toBe(false);
      }
      expect(deductionKnownLines(s.recipeId, ctx, [], {})).toEqual({ structure: [], attribute: [], legacyStructure: false });
    }
  });
  it("a hostile stored clause for a zero-topping recipe never prints 0; junk ids are ignored", () => {
    const lines = deductionKnownLines("quattro-formaggi", ctxAt(24), [TOPPING_TOTAL_FACT_ID, "attr:family:__proto__", "attr:category:dessert", 7], {});
    expect(lines).toEqual({ structure: [], attribute: [], legacyStructure: false });
    expect(parseAttributeFactId("attr:existence")).toBeNull();
    expect(parseAttributeFactId("attr:family:meat")).toEqual({ level: "family", family: "meat", factId: "attr:family:meat" });
  });
  it("the result carries no recipe id, reserve, candidate count or availability field", () => {
    const lines = deductionKnownLines("capricciosa", ctxAt(24, ALL_INGREDIENT_IDS), [INGREDIENT_TOTAL_FACT_ID], {});
    expect(Object.keys(lines).sort()).toEqual(["attribute", "legacyStructure", "structure"]);
    expect(TARGETS).toHaveLength(24);
  });
});
