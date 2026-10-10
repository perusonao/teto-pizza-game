import { describe, expect, it } from "vitest";
import { getIngredient } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { KEY_FREE_RECIPES } from "../testSupport/hintRoles";
import {
  HINT5_RUNG_MARKER,
  HINT5_RUNG_PRICE,
  buildHint5Ladder,
  hint5ClassFactId,
  hint5Ownership,
  hint5Presentation,
  requestHint5Rung,
} from "./hint5Ladder";

/**
 * Hint 5.0 PR-B: permanent tests for the save-compatibility claims of the key-free BASE migration spec
 * (docs/decisions/TETO_HINT-5_BASE-RUNG_OWNER-DECISIONS.md section 4.1 M-1..M-3 and section 4.3 rollback), run against
 * the CURRENT build (the BASE rung does not exist yet; nothing here implements it). The rules are re-derived
 * from recipe data inside this file, independent of the ladder code, and compared with the real old ladder.
 *
 * When PR-D adds BASE behind a flag, these stay green with the flag OFF, and are the reference the flag-ON
 * migration tests are compared with.
 */

const ids = (r: Recipe) => [...new Set(r.requiredIngredients.map((x) => x.ingredientId))];
const hasCategory = (r: Recipe, category: string) => ids(r).some((id) => getIngredient(id)?.category === category);

/** Applicable BASE markers, derived from recipe data (M-1; never stored). */
function applicableMarkers(r: Recipe): string[] {
  return [...(hasCategory(r, "sauce") ? ["h5:sauce"] : []), ...(hasCategory(r, "cheese") ? ["h5:cheese"] : [])];
}
const baseStatus = (r: Recipe, stored: readonly string[]): "COMPLETED" | "OPEN" | "PARTIAL" => {
  const applicable = applicableMarkers(r);
  const present = applicable.filter((m) => stored.includes(m)).length;
  return present === applicable.length ? "COMPLETED" : present === 0 ? "OPEN" : "PARTIAL";
};
/** The facts a BASE purchase writes: the names of every sauce / cheese plus every applicable marker (spec section 2). */
function baseFacts(r: Recipe): string[] {
  const names = ids(r).filter((id) => ["sauce", "cheese"].includes(getIngredient(id)!.category)).map((id) => `ing:${id}`);
  return [...names, ...applicableMarkers(r)];
}

const input = (recipeId: string, stored: string[], expectedRungIndex: number, pitzBalance = 1000) => ({
  recipeId,
  discoveredCount: 5,
  storedFactIds: stored,
  legacyPurchases: {},
  expectedRungIndex,
  pitzBalance,
});

/** Every reachable ledger of the REAL old ladder: the real `requestHint5Rung`, rung by rung. */
function reachableLedgers(recipeId: string): string[][] {
  const states: string[][] = [[]];
  let ledger: string[] = [];
  for (let guard = 0; guard < 30; guard++) {
    const view = hint5Presentation(input(recipeId, ledger, 0))!;
    if (!view.next) break;
    const res = requestHint5Rung(input(recipeId, ledger, view.next.rungIndex));
    if (res.outcome !== "ANSWERED" && res.outcome !== "ALREADY_KNOWN") throw new Error(`${recipeId}: ${res.outcome}`);
    ledger = [...ledger, ...res.addFactIds.filter((f) => !ledger.includes(f))];
    states.push(ledger);
  }
  return states;
}

describe("section 4.1: M-1..M-3 agree with every reachable state of the real old ladder (30 key-free recipes)", () => {
  it("the population is the 30 key-free recipes: sauce + cheese 12, cheese only 12, sauce only 6", () => {
    expect(KEY_FREE_RECIPES).toHaveLength(30);
    const klass = (r: Recipe) => `${hasCategory(r, "sauce") ? "sauce" : ""}+${hasCategory(r, "cheese") ? "cheese" : ""}`;
    const count = (k: string) => KEY_FREE_RECIPES.filter((r) => klass(r) === k).length;
    expect({ both: count("sauce+cheese"), cheeseOnly: count("+cheese"), sauceOnly: count("sauce+"), neither: count("+") }).toEqual({
      both: 12,
      cheeseOnly: 12,
      sauceOnly: 6,
      neither: 0,
    });
  });

  it("0 violations: BASE is COMPLETED exactly when the old SAUCE / CHEESE rungs are, and STRUCTURE / SUB_CLASS never exist before it", () => {
    let partials = 0;
    for (const r of KEY_FREE_RECIPES) {
      const ladder = buildHint5Ladder(r.id)!;
      for (const ledger of reachableLedgers(r.id)) {
        const own = hint5Ownership(ladder, ledger, {});
        const oldBaseDone = ladder.rungs.every((x, i) => (x.kind === "SAUCE" || x.kind === "CHEESE" ? own.statuses[i] === "COMPLETED" : true));
        const status = baseStatus(r, ledger);
        expect(status === "COMPLETED", `${r.id} [${ledger.join(",")}]`).toBe(oldBaseDone);
        if (status === "PARTIAL") {
          partials += 1;
          // the only reachable partial: sauce + cheese recipe with h5:sauce but not h5:cheese
          expect(ledger.includes("h5:sauce") && !ledger.includes("h5:cheese"), r.id).toBe(true);
        }
        if (status !== "COMPLETED") {
          expect(ledger.some((f) => f === HINT5_RUNG_MARKER.STRUCTURE || f.startsWith("cls:")), `${r.id} progress before BASE`).toBe(false);
        }
      }
    }
    expect(partials).toBe(12); // one partial state per sauce + cheese recipe
  });

  it("single-marker recipes (cheese only, sauce only) can never be PARTIAL", () => {
    for (const r of KEY_FREE_RECIPES.filter((x) => applicableMarkers(x).length === 1)) {
      for (const ledger of reachableLedgers(r.id)) expect(baseStatus(r, ledger), r.id).not.toBe("PARTIAL");
    }
  });
});

describe("section 4.2: saved keys of the key-free recipes", () => {
  it("every fact the old ladder writes is one of the existing key kinds (ing: / h5: / cls: / meta:), and the walk is deterministic", () => {
    for (const r of KEY_FREE_RECIPES) {
      const facts = reachableLedgers(r.id).at(-1)!;
      for (const f of facts) expect(f, r.id).toMatch(/^(ing:[a-z0-9-]+|h5:(sauce|cheese|key|structure)|cls:[a-z0-9-]+|meta:[a-z-]+)$/);
      expect(reachableLedgers(r.id).at(-1), r.id).toEqual(facts);
    }
  });

  it("reading a ledger never mutates it (loading a save changes nothing)", () => {
    for (const r of KEY_FREE_RECIPES) {
      const ledger = Object.freeze([...reachableLedgers(r.id).at(-1)!]) as string[];
      const before = JSON.stringify(ledger);
      hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: ledger, legacyPurchases: {}, pitzBalance: 0 });
      hint5Ownership(buildHint5Ladder(r.id)!, ledger, {});
      expect(JSON.stringify(ledger), r.id).toBe(before);
    }
  });
});

describe("section 4.3: rollback to the pre-BASE build keeps working with the facts a BASE purchase writes", () => {
  it("the old ladder offers STRUCTURE next, charges nothing for sauce / cheese, and the remaining total is the old remaining total", () => {
    for (const r of KEY_FREE_RECIPES) {
      const ladder = buildHint5Ladder(r.id)!;
      const baseRungs = ladder.rungs.filter((x) => x.kind === "SAUCE" || x.kind === "CHEESE");
      const facts = baseFacts(r);
      const own = hint5Ownership(ladder, facts, {});
      const next = ladder.rungs[own.nextIndex! - 1];
      expect(next.kind, r.id).toBe("STRUCTURE");
      expect(own.nextIndex, r.id).toBe(baseRungs.length + 1);
      expect(hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: facts, legacyPurchases: {}, pitzBalance: 5 })!.next).toMatchObject({
        kind: "STRUCTURE",
        price: HINT5_RUNG_PRICE.STRUCTURE,
        affordable: true,
      });

      // walk to the end with the old ladder: total charged == the old total minus the SAUCE / CHEESE prices
      let ledger = [...facts];
      let charged = 0;
      for (let guard = 0; guard < 30; guard++) {
        const view = hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: ledger, legacyPurchases: {}, pitzBalance: 1000 })!;
        if (!view.next) break;
        const res = requestHint5Rung(input(r.id, ledger, view.next.rungIndex));
        if (res.outcome !== "ANSWERED") throw new Error(`${r.id}: ${res.outcome}`);
        charged += res.charge;
        ledger = [...ledger, ...res.addFactIds.filter((f) => !ledger.includes(f))];
      }
      const oldTotal = ladder.rungs.reduce((sum, x) => sum + HINT5_RUNG_PRICE[x.kind], 0);
      const basePrices = baseRungs.reduce((sum, x) => sum + HINT5_RUNG_PRICE[x.kind], 0);
      expect(charged, r.id).toBe(oldTotal - basePrices);
    }
  });

  it("documented examples: remaining after BASE is brazilian-calabresa 25, pesto-gamberi 20, pesto-pollo 15", () => {
    const remaining = (id: string) => {
      const ladder = buildHint5Ladder(id)!;
      return ladder.rungs.filter((x) => x.kind === "STRUCTURE" || x.kind === "SUB_CLASS").reduce((s, x) => s + HINT5_RUNG_PRICE[x.kind], 0);
    };
    expect([remaining("brazilian-calabresa"), remaining("pesto-gamberi"), remaining("pesto-pollo")]).toEqual([25, 20, 15]);
  });

  it("a credited remainder (legacy partial completed) writes the same facts as a BASE purchase", () => {
    for (const r of KEY_FREE_RECIPES.filter((x) => applicableMarkers(x).length === 2)) {
      const partial = reachableLedgers(r.id).find((l) => baseStatus(r, l) === "PARTIAL")!;
      const remainder = baseFacts(r).filter((f) => !partial.includes(f));
      expect([...new Set([...partial, ...remainder])].sort(), r.id).toEqual([...new Set([...partial, ...baseFacts(r)])].sort());
      const own = hint5Ownership(buildHint5Ladder(r.id)!, [...partial, ...remainder], {});
      expect(buildHint5Ladder(r.id)!.rungs[own.nextIndex! - 1].kind, r.id).toBe("STRUCTURE");
    }
  });

  it("progress after BASE (h5:structure, cls:) stays valid on top of the BASE facts (M-6)", () => {
    for (const r of KEY_FREE_RECIPES) {
      const subs = buildHint5Ladder(r.id)!.rungs.filter((x) => x.kind === "SUB_CLASS");
      const ledger = [...baseFacts(r), HINT5_RUNG_MARKER.STRUCTURE, ...subs.map((x) => hint5ClassFactId(x.subjectIds[0]))];
      expect(hint5Ownership(buildHint5Ladder(r.id)!, ledger, {}).nextIndex, r.id).toBeNull();
    }
    expect(RECIPES.length).toBeGreaterThan(0);
  });
});
