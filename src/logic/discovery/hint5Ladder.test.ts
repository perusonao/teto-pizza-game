import { describe, expect, it } from "vitest";
import { RECIPE_HINT_ROLES } from "../../data/recipeHintRoles";
import { RECIPES } from "../../data/recipes";
import { INGREDIENT_TOTAL_FACT_ID } from "./deductionHint";
import {
  buildHint5Ladder,
  hint5ClassFactId,
  hint5EmptyFixedRungs,
  hint5Ownership,
  hint5Presentation,
  hint5ReservedRungs,
  HINT5_FIXED_RUNG_KINDS,
  HINT5_LADDER_COMPLETE_TEXT,
  HINT5_RUNG_PRICE,
  parseHint5ClassFactId,
  requestHint5Rung,
  type Hint5RequestInput,
} from "./hint5Ladder";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1: ladder generation, the P-C price and the request authority
 * (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §5, §10, §13).
 */

const base = (recipeId: string, over: Partial<Hint5RequestInput> = {}): Hint5RequestInput => ({
  recipeId,
  discoveredCount: 5,
  storedFactIds: [],
  legacyPurchases: {},
  expectedRungIndex: 1,
  pitzBalance: 1000,
  ...over,
});

/** Buys every rung in order, returning the stored ids, total charge and the outcomes. */
function buyAll(recipeId: string, discoveredCount = 5) {
  let stored: string[] = [];
  let spent = 0;
  const outcomes: string[] = [];
  for (let guard = 0; guard < 20; guard += 1) {
    const next = hint5Presentation({ recipeId, discoveredCount, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 1000 })!.next;
    if (!next) break;
    const r = requestHint5Rung(base(recipeId, { discoveredCount, storedFactIds: stored, expectedRungIndex: next.rungIndex }));
    outcomes.push(r.outcome);
    if (r.outcome !== "ANSWERED") break;
    expect(r.charge).toBe(next.price);
    spent += r.charge;
    stored = [...stored, ...r.addFactIds];
  }
  return { stored, spent, outcomes };
}

describe("ladder generation (§5)", () => {
  it("every recipe has the 4 fixed rungs first, then one SUB_CLASS per authored sub-topping, in authored order", () => {
    for (const r of RECIPES) {
      const ladder = buildHint5Ladder(r.id)!;
      expect(ladder.rungs.slice(0, 4).map((x) => x.kind), r.id).toEqual(HINT5_FIXED_RUNG_KINDS);
      const subs = ladder.rungs.slice(4);
      expect(subs.map((x) => x.kind).every((k) => k === "SUB_CLASS"), r.id).toBe(true);
      expect(subs.map((x) => x.subjectIds[0]), r.id).toEqual(RECIPE_HINT_ROLES[r.id].hintSubToppingOrder);
      expect(subs.map((x) => x.ordinal), r.id).toEqual(subs.map((_, i) => i + 1));
      expect(ladder.rungs.map((x) => x.index), r.id).toEqual(ladder.rungs.map((_, i) => i + 1));
    }
  });

  it("one rung reveals every sauce / every cheese (R1): quattro-formaggi's 4 cheeses are one rung", () => {
    const q = buildHint5Ladder("quattro-formaggi")!;
    expect(q.rungs[1]).toMatchObject({ kind: "CHEESE", subjectIds: ["mozzarella", "gorgonzola", "parmigiano", "fontina"] });
    expect(q.rungs[2]).toMatchObject({ kind: "KEY_TOPPING", subjectIds: [] });
    expect(buildHint5Ladder("parmigiana-pizza")!.rungs[1].subjectIds).toEqual(["mozzarella", "parmigiano"]);
  });

  it("G20 / P3: a recipe with 0 sub-toppings has exactly 4 rungs, then the generic completion", () => {
    const zero = RECIPES.filter((r) => RECIPE_HINT_ROLES[r.id].hintSubToppingOrder.length === 0).map((r) => r.id);
    expect(zero.sort()).toEqual(["bismarck", "funghi", "genovese", "margherita", "pepperoni", "pizza-bianca", "quattro-formaggi", "salsiccia"]);
    for (const id of zero) expect(buildHint5Ladder(id)!.rungs, id).toHaveLength(4);
    const done = buyAll("pepperoni");
    expect(done.outcomes).toEqual(["ANSWERED", "ANSWERED", "ANSWERED", "ANSWERED"]);
    const view = hint5Presentation({ recipeId: "pepperoni", discoveredCount: 5, storedFactIds: done.stored, legacyPurchases: {}, pitzBalance: 0 })!;
    expect(view.next).toBeNull();
    expect(view.completeText).toBe(HINT5_LADDER_COMPLETE_TEXT);
  });

  it("sub-topping counts match the authority (0 x 8, 1 x 12, 2 x 1, 3 x 4)", () => {
    const counts = new Map<number, number>();
    for (const r of RECIPES) {
      const n = RECIPE_HINT_ROLES[r.id].hintSubToppingOrder.length;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect([...counts].sort()).toEqual([[0, 8], [1, 12], [2, 1], [3, 4]]);
  });

  it("G19: empty fixed rungs are exactly the round-6 P4-CHEESE / P4b set (5 no-cheese, 1 no-topping); no empty SAUCE", () => {
    const empty = RECIPES.map((r) => [r.id, hint5EmptyFixedRungs(r.id)!] as const).filter(([, e]) => e.length > 0);
    expect(Object.fromEntries(empty)).toEqual({
      marinara: ["CHEESE"],
      "quattro-formaggi": ["KEY_TOPPING"],
      fugazza: ["CHEESE"],
      "pizza-bianca": ["CHEESE"],
      "pesto-tonno": ["CHEESE"],
      "puttanesca-pizza": ["CHEESE"],
    });
  });
});

describe("P-C pricing (OD-H5-E1 / E2) — G-PRICE", () => {
  it("the price table is P-C", () => {
    expect(HINT5_RUNG_PRICE).toEqual({ SAUCE: 10, CHEESE: 10, KEY_TOPPING: 10, STRUCTURE: 5, SUB_CLASS: 5 });
  });

  it("the offered price depends on the rung kind only, for every recipe and rung (empty CHEESE / KEY rungs included); no cap truncates it", () => {
    for (const r of RECIPES) {
      const done = buyAll(r.id);
      const ladder = buildHint5Ladder(r.id)!;
      expect(done.outcomes.every((o) => o === "ANSWERED"), r.id).toBe(true);
      expect(done.spent, r.id).toBe(ladder.rungs.reduce((s, x) => s + HINT5_RUNG_PRICE[x.kind], 0));
    }
    expect(buyAll("pepperoni").spent).toBe(35);
    expect(buyAll("hawaiian").spent).toBe(40);
    expect(buyAll("capricciosa").spent).toBe(50);
    expect(buyAll("meat-lovers").spent).toBe(50);
    // Round 6: the empty rung is paid (no cap, OD-H5-E2).
    expect(buyAll("marinara").spent).toBe(40);
    expect(buyAll("quattro-formaggi").spent).toBe(35);
  });

  it("G21: the Dex-0 Margherita onboarding is free and never persisted", () => {
    const first = requestHint5Rung(base("margherita", { discoveredCount: 0 }));
    expect(first).toMatchObject({ outcome: "ANSWERED", charge: 0, persist: false });
    expect(hint5Presentation({ recipeId: "margherita", discoveredCount: 0, storedFactIds: [], legacyPurchases: {}, pitzBalance: 0 })!.next).toMatchObject({ price: 0, affordable: true });
    expect(buyAll("margherita", 0).spent).toBe(0);
    // Margherita at Dex >= 1 is priced like every other target.
    expect(requestHint5Rung(base("margherita"))).toMatchObject({ outcome: "ANSWERED", charge: 10, persist: true });
  });
});

describe("request authority (§5, H5-INV-6)", () => {
  it("answers each rung with the right fact kind plus its completion record: ing: names + h5:<rung>, meta:ingredient-total + h5:structure, cls:<id>", () => {
    const steps = [];
    let stored: string[] = [];
    for (let i = 1; i <= 5; i += 1) {
      const r = requestHint5Rung(base("hawaiian", { storedFactIds: stored, expectedRungIndex: i }));
      steps.push(r);
      if (r.outcome === "ANSWERED") stored = [...stored, ...r.addFactIds];
    }
    expect(steps.map((s) => (s.outcome === "ANSWERED" ? s.addFactIds : s.outcome))).toEqual([
      ["ing:tomato-sauce", "h5:sauce"],
      ["ing:mozzarella", "h5:cheese"],
      ["ing:pineapple", "h5:key"],
      [INGREDIENT_TOTAL_FACT_ID, "h5:structure"],
      ["cls:ham"],
    ]);
    expect(steps.map((s) => (s.outcome === "ANSWERED" ? s.charge : -1))).toEqual([10, 10, 10, 5, 5]);
    expect(parseHint5ClassFactId(hint5ClassFactId("ham"))).toBe("ham");
    for (const bad of ["cls:", "cls:Ham", "cls:__proto__", "ing:ham", 7, null]) expect(parseHint5ClassFactId(bad)).toBeNull();
  });

  it("G9: a stale or double request (wrong expectedRungIndex) is refused and charges nothing", () => {
    for (const expectedRungIndex of [0, 2, 5, "1", null, undefined, 1.5]) {
      expect(requestHint5Rung(base("hawaiian", { expectedRungIndex }))).toEqual({ outcome: "REJECTED", reason: "STALE" });
    }
    // A double tap: the first request settles rung 1, so the echoed index 1 is now stale.
    const first = requestHint5Rung(base("hawaiian"));
    expect(first.outcome).toBe("ANSWERED");
    const stored = first.outcome === "ANSWERED" ? [...first.addFactIds] : [];
    expect(requestHint5Rung(base("hawaiian", { storedFactIds: stored }))).toEqual({ outcome: "REJECTED", reason: "STALE" });
  });

  it("G9: insufficient Pitz is refused uniformly (same result for every target at the same rung) and charges nothing", () => {
    for (const r of RECIPES) {
      expect(requestHint5Rung(base(r.id, { pitzBalance: 9 })), r.id).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
      expect(requestHint5Rung(base(r.id, { pitzBalance: Number.NaN })), r.id).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
    }
    const atStructure = buyAll("hawaiian").stored.slice(0, 6); // rungs 1-3 bought
    expect(requestHint5Rung(base("hawaiian", { storedFactIds: atStructure, expectedRungIndex: 4, pitzBalance: 4 }))).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
    expect(requestHint5Rung(base("hawaiian", { storedFactIds: atStructure, expectedRungIndex: 4, pitzBalance: 5 }))).toMatchObject({ outcome: "ANSWERED", charge: 5 });
  });

  it("G10 (round 6, OD-H5-P4-CHEESE): an empty CHEESE rung is a normal paid rung answered 「なし」 (completion record only)", () => {
    const r = requestHint5Rung(base("marinara", { storedFactIds: ["ing:tomato-sauce", "h5:sauce"], expectedRungIndex: 2 }));
    expect(r).toEqual({ outcome: "ANSWERED", rungIndex: 2, kind: "CHEESE", addFactIds: ["h5:cheese"], charge: 10, persist: true });
    const after = hint5Presentation({ recipeId: "marinara", discoveredCount: 5, storedFactIds: ["ing:tomato-sauce", "h5:sauce", "h5:cheese"], legacyPurchases: {}, pitzBalance: 0 })!;
    expect(after.board[1]).toEqual({ rungIndex: 2, kind: "CHEESE", ingredientIds: [], none: true });
    expect(after.next).toMatchObject({ rungIndex: 3, kind: "KEY_TOPPING", price: 10 });
    // Never answered twice (reload-safe).
    expect(requestHint5Rung(base("marinara", { storedFactIds: ["ing:tomato-sauce", "h5:sauce", "h5:cheese"], expectedRungIndex: 2 }))).toEqual({ outcome: "REJECTED", reason: "STALE" });
  });

  it("G10 (round 6, OD-H5-P4b): an empty KEY_TOPPING rung is a normal paid rung answered 「なし」; quattro-formaggi completes its ladder", () => {
    const q = requestHint5Rung(base("quattro-formaggi", { storedFactIds: ["h5:sauce", "h5:cheese"], expectedRungIndex: 3 }));
    expect(q).toEqual({ outcome: "ANSWERED", rungIndex: 3, kind: "KEY_TOPPING", addFactIds: ["h5:key"], charge: 10, persist: true });
    const { stored, spent, outcomes } = buyAll("quattro-formaggi");
    expect(outcomes).toEqual(["ANSWERED", "ANSWERED", "ANSWERED", "ANSWERED"]);
    expect(spent).toBe(35);
    expect(stored.filter((id) => id.startsWith("h5:"))).toEqual(["h5:sauce", "h5:cheese", "h5:key", "h5:structure"]);
    const final = hint5Presentation({ recipeId: "quattro-formaggi", discoveredCount: 5, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 0 })!;
    expect(final.board.find((e) => e.kind === "KEY_TOPPING")).toEqual({ rungIndex: 3, kind: "KEY_TOPPING", ingredientIds: [], none: true });
    expect(final.next).toBeNull();
  });

  it("G10 (OD-H5-P4-SAUCE reserved): an empty SAUCE rung stays RESERVED (no charge, no fact, not skipped, never 「なし」); a complete ladder charges nothing", () => {
    // A hypothetical sauceless marinara (no runtime recipe is sauceless: G7 / the RESERVED gate).
    const sauceless = RECIPES.map((r) => (r.id === "marinara" ? { ...r, requiredIngredients: r.requiredIngredients.filter((x) => x.ingredientId !== "tomato-sauce") } : r));
    expect(hint5ReservedRungs("marinara", sauceless)).toEqual(["SAUCE"]);
    const r = requestHint5Rung(base("marinara"), sauceless);
    expect(r).toEqual({ outcome: "RESERVED_EMPTY_RUNG", rungIndex: 1, kind: "SAUCE", addFactIds: [], charge: 0 });
    // A stray `h5:sauce` never completes it, and nothing is skipped.
    const view = hint5Presentation({ recipeId: "marinara", discoveredCount: 5, storedFactIds: ["h5:sauce"], legacyPurchases: {}, pitzBalance: 100 }, sauceless)!;
    expect(view.board).toEqual([]);
    expect(view.next).toMatchObject({ rungIndex: 1, kind: "SAUCE", price: 10 });
    expect(requestHint5Rung(base("marinara", { expectedRungIndex: 2 }), sauceless)).toEqual({ outcome: "REJECTED", reason: "STALE" });
    const done = buyAll("hawaiian").stored;
    expect(requestHint5Rung(base("hawaiian", { storedFactIds: done, expectedRungIndex: 6 }))).toEqual({ outcome: "LADDER_COMPLETE", addFactIds: [], charge: 0 });
  });

  it("RESERVED gate (M2 condition 3): no runtime recipe has a rung that could only be RESERVED", () => {
    for (const r of RECIPES) expect(hint5ReservedRungs(r.id), r.id).toEqual([]);
  });

  it("NOT_A_TARGET: unknown or hostile recipe ids", () => {
    for (const recipeId of ["future-pizza", "__proto__", "constructor", "", null, 42, ["hawaiian"]]) {
      expect(requestHint5Rung(base(recipeId as string))).toEqual({ outcome: "REJECTED", reason: "NOT_A_TARGET" });
      expect(hint5Presentation({ recipeId, discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, pitzBalance: 100 })).toBeNull();
    }
  });

  it("settled rungs are never sold again: ownership is recomputed from the ledger (reload-safe, no recharge)", () => {
    const done = buyAll("capricciosa").stored;
    const own = hint5Ownership(buildHint5Ladder("capricciosa")!, done, {});
    expect(own.nextIndex).toBeNull();
    expect(own.statuses.every((s) => s === "COMPLETED")).toBe(true);
    // Reloaded (a copy through JSON), the same ledger gives the same result.
    expect(hint5Ownership(buildHint5Ladder("capricciosa")!, JSON.parse(JSON.stringify(done)), {})).toEqual(own);
  });
});
