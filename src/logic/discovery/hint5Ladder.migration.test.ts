import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { INGREDIENT_TOTAL_FACT_ID, legacyOwnsIngredientTotal } from "./deductionHint";
import { TOPPING_TOTAL_FACT_ID } from "./deductionGuard";
import { legacyHintMapping } from "./hintFactMigration";
import {
  buildHint5Ladder,
  hint5Ownership,
  hint5Presentation,
  HINT5_RUNG_MARKER,
  requestHint5Rung,
  type Hint5RequestInput,
  type Hint5RequestResult,
} from "./hint5Ladder";

/**
 * Discovery Hint 5.0 (Issue #292): existing ledgers under OD-H5-M3 (round 5)
 * (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §9, H5-2 Result §5).
 *
 * - Legacy facts never complete a rung, so the pre-purchase view is the same with or without them.
 * - At request time only:
 *   - ALL known -> ALREADY_KNOWN, 0 Pitz, only the completion record stored;
 *   - PARTIALLY known / NONE known -> the normal P-C price.
 * - Nothing is converted, rewritten or deleted (E3). A request only returns ids to append.
 */

const req = (recipeId: string, over: Partial<Hint5RequestInput> = {}) =>
  requestHint5Rung({ recipeId, discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, expectedRungIndex: 1, pitzBalance: 1000, ...over });
const view = (recipeId: string, stored: unknown, legacy: unknown = {}, pitzBalance = 1000) =>
  hint5Presentation({ recipeId, discoveredCount: 5, storedFactIds: stored, legacyPurchases: legacy, pitzBalance })!;
/** The view without the player's own-name archive (the one part that may show their legacy names). */
const preView = (recipeId: string, stored: unknown, legacy: unknown = {}, pitzBalance = 1000) => {
  const { legacyKnownIngredientIds: _archive, ...rest } = view(recipeId, stored, legacy, pitzBalance);
  return rest;
};

/** Walks the ladder from `stored`, returning each outcome (and the ledger after it). */
function walk(recipeId: string, stored: string[], legacy: unknown = {}): { results: Hint5RequestResult[]; stored: string[] } {
  const results: Hint5RequestResult[] = [];
  let ledger = [...stored];
  for (let guard = 0; guard < 20; guard += 1) {
    const next = view(recipeId, ledger, legacy).next;
    if (!next) break;
    const r = req(recipeId, { storedFactIds: ledger, legacyPurchases: legacy, expectedRungIndex: next.rungIndex });
    results.push(r);
    if (r.outcome !== "ANSWERED" && r.outcome !== "ALREADY_KNOWN") break;
    ledger = [...ledger, ...r.addFactIds.filter((id) => !ledger.includes(id))];
  }
  return { results, stored: ledger };
}

describe("M3: legacy facts never change the pre-purchase view", () => {
  const cases: [string, string[], unknown][] = [
    ["hawaiian", ["ing:tomato-sauce", "ing:mozzarella", "ing:pineapple", INGREDIENT_TOTAL_FACT_ID, "ing:ham"], {}],
    ["parmigiana-pizza", ["ing:mozzarella"], {}], // L1 (a partial multi-cheese rung)
    ["hawaiian", ["ing:mozzarella"], {}], // L2 (a complete single-cheese rung)
    ["capricciosa", ["ing:ham"], {}], // L3 (a known non-key topping)
    ["quattro-formaggi", ["ing:mozzarella", "ing:parmigiano"], { "quattro-formaggi": 1 }], // L1 + a legacy grant
    ["hawaiian", [], { hawaiian: 4 }], // Economy 1.0 legacy ledger only
    ["hawaiian", ["attr:family:meat", "attr:group:protein", "meta:topping-total"], {}],
  ];

  it("next rung, its kind and label, its price, whether it can be bought, and the board: identical to a fresh ledger", () => {
    for (const [recipeId, stored, legacy] of cases) {
      expect(preView(recipeId, stored, legacy), `${recipeId} ${stored.join(",")}`).toEqual(preView(recipeId, [], {}));
      expect(preView(recipeId, stored, legacy, 0), recipeId).toEqual(preView(recipeId, [], {}, 0));
    }
  });

  it("no rung is completed by a legacy fact, and the offered price is never 0 because something is known", () => {
    for (const [recipeId, stored, legacy] of cases) {
      const own = hint5Ownership(buildHint5Ladder(recipeId)!, stored, legacy);
      expect(own.statuses.includes("COMPLETED"), recipeId).toBe(false);
      expect(view(recipeId, stored, legacy).next).toMatchObject({ rungIndex: 1, kind: "SAUCE", price: 10 });
    }
  });

  it("the archive shows the player's own names only, and it never depends on the target (a foreign id is shown as stored)", () => {
    expect(view("hawaiian", ["ing:mozzarella", "ing:tuna"]).legacyKnownIngredientIds).toEqual(["mozzarella", "tuna"]);
    expect(view("hawaiian", ["ing:not-an-ingredient", "__proto__"]).legacyKnownIngredientIds).toEqual([]);
  });
});

describe("M3 with the round-6 「なし」 rungs (OD-H5-P4-CHEESE / P4b)", () => {
  const NO_CHEESE = ["marinara", "fugazza", "pizza-bianca", "pesto-tonno", "puttanesca-pizza"];
  /** The lowest Economy 1.0 level whose lines include the count line (「…チーズは使わないみたい」). */
  const countLevel = (id: string) => [1, 2, 3, 4].find((level) => legacyOwnsIngredientTotal(id, { [id]: level }))!;

  it("ALL known: a legacy count line that said 「チーズは使わないみたい」 completes the empty CHEESE rung for 0 Pitz, only after the request", () => {
    for (const id of NO_CHEESE) {
      const legacy = { [id]: countLevel(id) };
      expect(countLevel(id), id).toBeDefined();
      // Before the request: the same 「チーズ」 rung at 10 Pitz as a fresh save.
      expect(preView(id, ["h5:sauce"], legacy), id).toEqual(preView(id, ["h5:sauce"], {}));
      expect(view(id, ["h5:sauce"], legacy).next, id).toMatchObject({ rungIndex: 2, kind: "CHEESE", price: 10 });
      expect(req(id, { storedFactIds: ["h5:sauce"], legacyPurchases: legacy, expectedRungIndex: 2 }), id).toEqual({
        outcome: "ALREADY_KNOWN",
        rungIndex: 2,
        kind: "CHEESE",
        addFactIds: [HINT5_RUNG_MARKER.CHEESE],
        charge: 0,
        persist: true,
      });
      // Below the normal price it is refused like any other request.
      expect(req(id, { storedFactIds: ["h5:sauce"], legacyPurchases: legacy, expectedRungIndex: 2, pitzBalance: 9 }), id).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
    }
  });

  it("NONE known: without that line (fresh, `meta:ingredient-total`, names, a lower legacy level) the empty CHEESE rung costs 10", () => {
    for (const id of NO_CHEESE) {
      const recipe = RECIPES.find((r) => r.id === id)!;
      const names = recipe.requiredIngredients.map((x) => `ing:${x.ingredientId}`);
      const lower = countLevel(id) > 1 ? [{ [id]: countLevel(id) - 1 }] : [];
      for (const [stored, legacy] of [[["h5:sauce"], {}], [["h5:sauce", INGREDIENT_TOTAL_FACT_ID, ...names], {}], ...lower.map((l) => [["h5:sauce"], l])] as [string[], unknown][]) {
        expect(req(id, { storedFactIds: stored, legacyPurchases: legacy, expectedRungIndex: 2 }), `${id} ${JSON.stringify(legacy)}`).toMatchObject({
          outcome: "ANSWERED",
          kind: "CHEESE",
          addFactIds: [HINT5_RUNG_MARKER.CHEESE],
          charge: 10,
        });
      }
    }
  });

  it("OD-H5-P4b: no legacy fact makes the empty KEY_TOPPING rung already known (always 10)", () => {
    const all = ["ing:olive-oil", "ing:mozzarella", "ing:gorgonzola", "ing:parmigiano", "ing:fontina", INGREDIENT_TOTAL_FACT_ID, "meta:topping-total", "attr:family:meat"];
    for (const legacy of [{}, { "quattro-formaggi": 1 }, { "quattro-formaggi": 4 }]) {
      const r = req("quattro-formaggi", { storedFactIds: ["h5:sauce", "h5:cheese", ...all], legacyPurchases: legacy, expectedRungIndex: 3 });
      expect(r, JSON.stringify(legacy)).toEqual({ outcome: "ANSWERED", rungIndex: 3, kind: "KEY_TOPPING", addFactIds: ["h5:key"], charge: 10, persist: true });
    }
  });

  it("「なし」 is never in a pre-purchase view, and appears only on the COMPLETED rung", () => {
    for (const id of [...NO_CHEESE, "quattro-formaggi"]) {
      const { results, stored } = walk(id, []);
      expect(results.every((r) => r.outcome === "ANSWERED"), id).toBe(true);
      for (let k = 0; k < stored.length; k += 1) {
        const v = view(id, stored.slice(0, k));
        for (const e of v.board) if ("none" in e && e.none) expect(stored.slice(0, k), id).toContain(e.kind === "CHEESE" ? "h5:cheese" : "h5:key");
      }
      const emptyKind = id === "quattro-formaggi" ? "KEY_TOPPING" : "CHEESE";
      const before = view(id, stored.filter((s) => s !== (emptyKind === "CHEESE" ? "h5:cheese" : "h5:key")));
      expect(before.board.some((e) => "none" in e && e.none), id).toBe(false);
      expect(view(id, stored).board.filter((e) => "none" in e && e.none).map((e) => e.kind), id).toEqual([emptyKind]);
    }
  });
});

describe("M3 at request time: ALL / PARTIAL / NONE known", () => {
  it("ALL known (name rung): 0 Pitz, ALREADY_KNOWN, only the completion record is stored (no name stored twice)", () => {
    const r = req("hawaiian", { storedFactIds: ["ing:tomato-sauce"] });
    expect(r).toEqual({ outcome: "ALREADY_KNOWN", rungIndex: 1, kind: "SAUCE", addFactIds: [HINT5_RUNG_MARKER.SAUCE], charge: 0, persist: true });
  });

  it("PARTIAL known (parmigiana: mozzarella known, parmigiano not): the normal price, and the whole rung is disclosed", () => {
    const stored = ["ing:tomato-sauce", HINT5_RUNG_MARKER.SAUCE, "ing:mozzarella"];
    expect(view("parmigiana-pizza", stored).next).toMatchObject({ rungIndex: 2, kind: "CHEESE", price: 10 });
    expect(req("parmigiana-pizza", { storedFactIds: stored, expectedRungIndex: 2 })).toEqual({
      outcome: "ANSWERED",
      rungIndex: 2,
      kind: "CHEESE",
      addFactIds: ["ing:parmigiano", HINT5_RUNG_MARKER.CHEESE],
      charge: 10,
      persist: true,
    });
    const after = view("parmigiana-pizza", [...stored, "ing:parmigiano", HINT5_RUNG_MARKER.CHEESE]);
    expect(after.board[1]).toEqual({ rungIndex: 2, kind: "CHEESE", ingredientIds: ["mozzarella", "parmigiano"], none: false });
  });

  it("NONE known: the normal price", () => {
    expect(req("parmigiana-pizza", { storedFactIds: ["h5:sauce"], expectedRungIndex: 2 })).toMatchObject({
      outcome: "ANSWERED",
      addFactIds: ["ing:mozzarella", "ing:parmigiano", HINT5_RUNG_MARKER.CHEESE],
      charge: 10,
    });
  });

  it("the 0-Pitz completion needs an affordable request: with a balance below the normal price it is refused like any other", () => {
    expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce"], pitzBalance: 9 })).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
    expect(req("hawaiian", { storedFactIds: [], pitzBalance: 9 })).toEqual({ outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" });
  });

  it("a fully known hawaiian (all names + total + the sub name): every rung completes for 0 Pitz, nothing is sold twice", () => {
    const stored = ["ing:tomato-sauce", "ing:mozzarella", "ing:pineapple", INGREDIENT_TOTAL_FACT_ID, "ing:ham"];
    const { results, stored: after } = walk("hawaiian", stored);
    expect(results.map((r) => r.outcome)).toEqual(["ALREADY_KNOWN", "ALREADY_KNOWN", "ALREADY_KNOWN", "ALREADY_KNOWN", "ALREADY_KNOWN"]);
    expect(results.every((r) => r.outcome === "ALREADY_KNOWN" && r.charge === 0)).toBe(true);
    expect(after).toEqual([...stored, "h5:sauce", "h5:cheese", "h5:key", "h5:structure", "cls:ham"]);
    // The completed board now shows the classification (the name stays in the archive).
    const final = view("hawaiian", after);
    expect(final.next).toBeNull();
    expect(final.board[4]).toMatchObject({ kind: "SUB_CLASS", classView: { family: "meat" } });
    // The archive keeps only what the board does not show: the sub-topping name (ham).
    expect(final.legacyKnownIngredientIds).toEqual(["ham"]);
  });

  it("STRUCTURE: meta:ingredient-total or the legacy count line -> 0 Pitz; meta:topping-total alone -> the normal price", () => {
    const upToStructure = ["h5:sauce", "h5:cheese", "h5:key"];
    expect(req("hawaiian", { storedFactIds: [...upToStructure, INGREDIENT_TOTAL_FACT_ID], expectedRungIndex: 4 })).toMatchObject({ outcome: "ALREADY_KNOWN", addFactIds: ["h5:structure"] });
    expect(req("hawaiian", { storedFactIds: upToStructure, legacyPurchases: { hawaiian: 3 }, expectedRungIndex: 4 })).toMatchObject({ outcome: "ALREADY_KNOWN", charge: 0 });
    expect(req("hawaiian", { storedFactIds: [...upToStructure, TOPPING_TOTAL_FACT_ID], expectedRungIndex: 4 })).toMatchObject({
      outcome: "ANSWERED",
      addFactIds: [INGREDIENT_TOTAL_FACT_ID, "h5:structure"],
      charge: 5,
    });
  });

  it("the Economy 1.0 ledger counts as known at request time only (sauce + key names, count line)", () => {
    expect([...legacyHintMapping("hawaiian", { hawaiian: 3 })!.grantedFactIds].sort()).toEqual(["ing:pineapple", "ing:tomato-sauce"]);
    const { results } = walk("hawaiian", [], { hawaiian: 3 });
    expect(results.map((r) => `${r.outcome}:${"charge" in r ? r.charge : "-"}`)).toEqual(["ALREADY_KNOWN:0", "ANSWERED:10", "ALREADY_KNOWN:0", "ALREADY_KNOWN:0", "ANSWERED:5"]);
  });

  it("attr:family:<f> about the Rule W reserve = the sub-topping with family f: ALL known at request time; a mismatch or a coarse answer is not (E3b)", () => {
    const fixed = ["h5:sauce", "h5:cheese", "h5:key", "h5:structure"];
    expect(req("hawaiian", { storedFactIds: [...fixed, "attr:family:meat"], expectedRungIndex: 5 })).toMatchObject({ outcome: "ALREADY_KNOWN", addFactIds: ["cls:ham"], charge: 0 });
    for (const other of ["attr:family:vegetable", "attr:group:protein", "attr:category:topping", "attr:existence"]) {
      expect(req("hawaiian", { storedFactIds: [...fixed, other], expectedRungIndex: 5 }), other).toMatchObject({ outcome: "ANSWERED", charge: 5 });
    }
  });

  it("M1: the Hint 3.0 free key (never stored) counts for nothing: the key rung costs the normal price", () => {
    expect(req("hawaiian", { storedFactIds: ["h5:sauce", "h5:cheese"], expectedRungIndex: 3 })).toMatchObject({ outcome: "ANSWERED", addFactIds: ["ing:pineapple", "h5:key"], charge: 10 });
  });
});

describe("unknown / future ids and forward compatibility (G12 / G13)", () => {
  const junk = ["tech:no-sauce", "shape:round:x", "cls:future-truffle", "cls:tuna", "ing:future-thing", "__proto__", "constructor", "h5:future-rung", 5, null, { a: 1 }];

  it("unknown, future, foreign-recipe and hostile ids never complete a rung or break the ladder", () => {
    const o = hint5Ownership(buildHint5Ladder("hawaiian")!, junk, { __proto__: 4, hawaiian: "x" });
    expect(o.statuses).toEqual(["OPEN", "OPEN", "OPEN", "OPEN", "OPEN"]);
    expect(hint5Ownership(buildHint5Ladder("hawaiian")!, "not-an-array", {}).nextIndex).toBe(1);
    expect(req("hawaiian", { storedFactIds: junk })).toMatchObject({ outcome: "ANSWERED", addFactIds: ["ing:tomato-sauce", "h5:sauce"] });
  });

  it("a request only returns ids to APPEND: stored ids are never echoed, rewritten or dropped", () => {
    const stored = ["tech:no-sauce", "attr:group:protein", "ing:tomato-sauce"];
    expect(req("hawaiian", { storedFactIds: stored })).toMatchObject({ outcome: "ALREADY_KNOWN", addFactIds: ["h5:sauce"] });
    expect(stored).toEqual(["tech:no-sauce", "attr:group:protein", "ing:tomato-sauce"]);
  });

  it("every id a request adds stays inside the persisted fact grammar (so a previous build keeps it)", () => {
    const grammar = /^[a-z][a-z0-9-]{0,15}(?::[a-z0-9][a-z0-9_-]{0,63}){1,2}$/; // persistence.ts HINT_FACT_ID_PATTERN
    const { results, stored } = walk("capricciosa", []);
    expect(results).toHaveLength(7);
    for (const id of stored) expect(id).toMatch(grammar);
  });
});
