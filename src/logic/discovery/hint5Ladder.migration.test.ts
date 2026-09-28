import { describe, expect, it } from "vitest";
import { INGREDIENT_TOTAL_FACT_ID } from "./deductionHint";
import { TOPPING_TOTAL_FACT_ID } from "./deductionGuard";
import { legacyHintMapping } from "./hintFactMigration";
import { buildHint5Ladder, hint5Ownership, hint5Presentation, requestHint5Rung, type Hint5RequestInput } from "./hint5Ladder";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1: the read-time migration of existing ledgers
 * (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §9.1; OD-H5-E3 / E3b / M1). Nothing is
 * converted, rewritten or deleted: a request only ever returns ids to append.
 */

const own = (recipeId: string, stored: unknown, legacy: unknown = {}) => hint5Ownership(buildHint5Ladder(recipeId)!, stored, legacy);
const req = (recipeId: string, over: Partial<Hint5RequestInput>) =>
  requestHint5Rung({ recipeId, discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, expectedRungIndex: 1, pitzBalance: 1000, ...over });

describe("§9.1 mapping of stored facts", () => {
  it("ing:<sauce / cheese / key> settles that name rung", () => {
    expect(own("hawaiian", ["ing:tomato-sauce", "ing:mozzarella", "ing:pineapple"]).statuses).toEqual(["OWNED", "OWNED", "OWNED", "OPEN", "OPEN"]);
  });

  it("a partly known multi-cheese rung stays sold, reveals only the rest, and charges the kind price", () => {
    const o = own("parmigiana-pizza", ["ing:tomato-sauce", "ing:mozzarella"]);
    expect(o.statuses[1]).toBe("OPEN");
    expect(o.nextIndex).toBe(2);
    expect(req("parmigiana-pizza", { storedFactIds: ["ing:tomato-sauce", "ing:mozzarella"], expectedRungIndex: 2 })).toMatchObject({
      outcome: "ANSWERED",
      addFactIds: ["ing:parmigiano"],
      charge: 10,
    });
  });

  it("ing:<sub-topping> (a Hint 3.0 purchase) is ALREADY_KNOWN: never sold, charged 0, shown by name", () => {
    const stored = ["ing:tomato-sauce", "ing:mozzarella", "ing:pineapple", INGREDIENT_TOTAL_FACT_ID, "ing:ham"];
    const o = own("hawaiian", stored);
    expect(o.statuses[4]).toBe("ALREADY_KNOWN");
    expect(o.nextIndex).toBeNull();
    expect(req("hawaiian", { storedFactIds: stored, expectedRungIndex: 6 })).toEqual({ outcome: "LADDER_COMPLETE", addFactIds: [], charge: 0 });
    const view = hint5Presentation({ recipeId: "hawaiian", discoveredCount: 5, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 0 })!;
    expect(view.board[4]).toEqual({ rungIndex: 5, kind: "SUB_CLASS", ordinal: 1, knownIngredientId: "ham" });
  });

  it("meta:ingredient-total settles STRUCTURE; meta:topping-total alone does not", () => {
    expect(own("hawaiian", [INGREDIENT_TOTAL_FACT_ID]).statuses[3]).toBe("OWNED");
    expect(own("hawaiian", [TOPPING_TOTAL_FACT_ID]).statuses[3]).toBe("OPEN");
  });

  it("the legacy Economy 1.0 ledger grants the names its lines showed, and its count line settles STRUCTURE", () => {
    const granted = legacyHintMapping("hawaiian", { hawaiian: 3 })!.grantedFactIds;
    expect([...granted].sort()).toEqual(["ing:pineapple", "ing:tomato-sauce"]);
    const o = own("hawaiian", [], { hawaiian: 3 });
    expect(o.statuses).toEqual(["OWNED", "OPEN", "OWNED", "OWNED", "OPEN"]);
    expect(o.nextIndex).toBe(2);
  });

  it("attr:family:<f> about the Rule W reserve maps only when that reserve is a Hint 5.0 sub-topping with family f (E3 safe mapping)", () => {
    // hawaiian: the Rule W reserve is ham (meat), which is also its Hint 5.0 sub-topping.
    expect(own("hawaiian", ["attr:family:meat"]).statuses[4]).toBe("OWNED");
    expect(own("hawaiian", ["attr:family:vegetable"]).statuses[4]).toBe("OPEN");
    // margherita: the reserve (basil) is the Hint 5.0 key, not a sub-topping, so nothing maps.
    expect(own("margherita", ["attr:family:herb"]).statuses).toEqual(["OPEN", "OPEN", "OPEN", "OPEN"]);
  });

  it("E3b: coarse attr:group / attr:category grant nothing, and no request ever touches them", () => {
    for (const coarse of ["attr:group:protein", "attr:category:topping", "attr:existence"]) {
      const o = own("hawaiian", [coarse]);
      expect(o.statuses, coarse).toEqual(["OPEN", "OPEN", "OPEN", "OPEN", "OPEN"]);
      const r = req("hawaiian", { storedFactIds: [coarse] });
      expect(r.outcome === "ANSWERED" && r.addFactIds.some((id) => id.startsWith("attr:")), coarse).toBe(false);
    }
  });

  it("M1: the Hint 3.0 free key (never stored) grants nothing: the key-topping rung is still paid", () => {
    // pineapple is hawaiian's Hint 3.0 free key and its Hint 5.0 key topping; nothing stored -> OPEN.
    const o = own("hawaiian", ["ing:tomato-sauce", "ing:mozzarella"]);
    expect(o.statuses[2]).toBe("OPEN");
    expect(req("hawaiian", { storedFactIds: ["ing:tomato-sauce", "ing:mozzarella"], expectedRungIndex: 3 })).toMatchObject({ addFactIds: ["ing:pineapple"], charge: 10 });
  });
});

describe("unknown / future ids and forward compatibility (G12 / G13)", () => {
  const junk = ["tech:no-sauce", "shape:round:x", "cls:future-truffle", "cls:tuna", "ing:future-thing", "ing:tuna", "__proto__", "constructor", 5, null, { a: 1 }];

  it("unknown, future, foreign-recipe and hostile ids are ignored and never break the ladder", () => {
    const o = own("hawaiian", junk, { __proto__: 4, hawaiian: "x" });
    expect(o.statuses).toEqual(["OPEN", "OPEN", "OPEN", "OPEN", "OPEN"]);
    expect(own("hawaiian", "not-an-array").nextIndex).toBe(1);
    const r = req("hawaiian", { storedFactIds: junk });
    expect(r).toMatchObject({ outcome: "ANSWERED", addFactIds: ["ing:tomato-sauce"] });
  });

  it("a request only returns ids to APPEND: stored ids (known or not) are never echoed, rewritten or dropped by it", () => {
    const stored = ["tech:no-sauce", "attr:group:protein", "ing:tomato-sauce"];
    const r = req("hawaiian", { storedFactIds: stored, expectedRungIndex: 2 });
    expect(r).toMatchObject({ outcome: "ANSWERED", addFactIds: ["ing:mozzarella"] });
    expect(stored).toEqual(["tech:no-sauce", "attr:group:protein", "ing:tomato-sauce"]);
  });

  it("the ids a request adds stay inside the persisted fact grammar (so a previous build keeps them)", () => {
    const grammar = /^[a-z][a-z0-9-]{0,15}(?::[a-z0-9][a-z0-9_-]{0,63}){1,2}$/; // persistence.ts HINT_FACT_ID_PATTERN
    let stored: string[] = [];
    for (let i = 1; i <= 7; i += 1) {
      const r = req("capricciosa", { storedFactIds: stored, expectedRungIndex: i });
      expect(r.outcome).toBe("ANSWERED");
      if (r.outcome !== "ANSWERED") return;
      for (const id of r.addFactIds) expect(id).toMatch(grammar);
      stored = [...stored, ...r.addFactIds];
    }
  });
});
