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

describe("DH4-2B Pre-Implementation Gate: request mutation gaps X5 / X8 / X16 / X15 and preconditions", () => {
  const base = { family: "attribute" as const, recipeId: "capricciosa", context: ctxAt(24, ALL_INGREDIENT_IDS) };
  it("X5: a request that is both STALE and unaffordable is STALE (STALE is decided before the balance)", () => {
    for (const family of ["structure", "attribute"] as const) {
      expect(requestDeductionHint(input({ ...base, family, expectedPaidCount: 1, pitzBalance: 0 }))).toEqual({ outcome: "REJECTED", reason: "STALE" });
    }
  });
  it("X8: a balance exactly equal to the price is enough; one less is not", () => {
    expect(requestDeductionHint(input({ ...base, requestPrice: 5, pitzBalance: 5 }))).toMatchObject({ outcome: "ANSWERED", charge: 5 });
    expect(requestDeductionHint(input({ ...base, requestPrice: 5, pitzBalance: 4 }))).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
    expect(requestDeductionHint(input({ ...base, requestPrice: 0, pitzBalance: 0 }))).toMatchObject({ outcome: "ANSWERED", charge: 0 });
  });
  it("X16: a NaN / infinite / non-number balance is refused, even at price 0", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity, "100" as unknown as number, undefined as unknown as number]) {
      for (const requestPrice of [0, 5]) {
        expect(requestDeductionHint(input({ ...base, requestPrice, pitzBalance: bad }))).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
      }
    }
  });
  it("X15: a legacy-only total is owned (never resold) but is not a stored 構成 line; it is the archive flag", () => {
    const lines = deductionKnownLines("capricciosa", ctxAt(24, ALL_INGREDIENT_IDS), [], { capricciosa: 4 });
    expect(lines).toEqual({ structure: [], attribute: [], legacyStructure: true });
    const both = deductionKnownLines("capricciosa", ctxAt(24, ALL_INGREDIENT_IDS), [INGREDIENT_TOTAL_FACT_ID], { capricciosa: 4 });
    expect(both.structure).toHaveLength(1);
    expect(both.legacyStructure).toBe(false);
  });
  it("an unmakeable recipe (the reserve-owned / DISCOVERABLE precondition) is NOT_A_TARGET before anything else", () => {
    const reserve = guardedReserveAttributeAnswer("capricciosa", ctxAt(24, ALL_INGREDIENT_IDS)) && RECIPES.find((r) => r.id === "capricciosa")!.requiredIngredients.map((r) => r.ingredientId);
    for (const missing of reserve || []) {
      const context = ctxAt(24, ALL_INGREDIENT_IDS.filter((id) => id !== missing));
      for (const family of ["structure", "attribute"] as const) {
        expect(requestDeductionHint(input({ family, recipeId: "capricciosa", context, pitzBalance: 0, expectedPaidCount: 3 }))).toEqual({ outcome: "REJECTED", reason: "NOT_A_TARGET" });
      }
    }
  });
  it("deductionOwnership reads the injected recipe list (legacy mapping), like the rest of the request path", () => {
    const custom = RECIPES.map((r) => (r.id === "capricciosa" ? { ...r, id: "custom-pizza" as never } : r));
    expect(deductionOwnership("custom-pizza", [], { "custom-pizza": 4 }).structureTotalOwned).toBe(false);
    expect(deductionOwnership("custom-pizza", [], { "custom-pizza": 4 }, custom).structureTotalOwned).toBe(true);
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
    expect(seen).toBe(123); // DH4-2A: 144; the hardened guard (DH4-2B Pre-Implementation Gate) answers more
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
    // On the runtime the clause decision of a target no longer moves with the inventory (H only holds
    // ingredients unlocked no later than the key, and a DISCOVERABLE target already owns them all). A
    // synthetic recipe keyed on the last ladder material (fontina) shows the rule: with only the
    // starters and its own ingredients the topping side of H is 1; with everything owned it passes.
    const ids = ["tomato-sauce", "mozzarella", "fontina", "basil", "ham"];
    const recipe = { ...RECIPES[1], id: "synthetic-late-key" as never, requiredIngredients: ids.map((ingredientId) => ({ ingredientId, amount: 1 })) as never };
    const few = [...new Set([...ownedAt(0, LADDER), ...ids])];
    const stored = [INGREDIENT_TOTAL_FACT_ID];
    const ask = (owned: readonly string[]) =>
      requestDeductionHint(input({ family: "structure", recipeId: recipe.id, context: { discoveredCount: 5, ownedIngredientIds: owned }, storedFactIds: stored }), [recipe]);
    expect(ask(few).outcome).toBe("GUIDANCE_ONLY");
    expect(ask(ALL_INGREDIENT_IDS)).toEqual({ outcome: "ANSWERED", family: "structure", addFactIds: [TOPPING_TOTAL_FACT_ID], charge: 5 });
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
