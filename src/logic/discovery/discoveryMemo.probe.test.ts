import { describe, expect, it } from "vitest";
import { getIngredient } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { buildHint5Ladder, hint5Presentation, requestHint5Rung, subToppingClass } from "./hint5Ladder";
import { discoveryMemoOf, type DiscoveryMemo } from "./discoveryMemo";

/**
 * Regression probe (from the P3-2 Fresh Audit's fact-display matrix): every production recipe is walked
 * through the REAL Hint 5.0 purchase authority one rung at a time, and the memo built from the real
 * `hint5Presentation` is checked against the ladder. It keeps the audit's 151-state probe and 547-pair
 * metamorphic invariant as a stable test, so a change to the ladder, the presentation or the memo that
 * leaks or drops a fact fails here.
 */
const DISCOVERED_COUNT = 5; // past the Dex-0 onboarding

function presentationOf(recipeId: string, stored: readonly string[], legacy: unknown = {}) {
  return hint5Presentation({ recipeId, discoveredCount: DISCOVERED_COUNT, storedFactIds: stored, legacyPurchases: legacy, pitzBalance: 100000 });
}
function memoFor(recipeId: string, stored: readonly string[], legacy: unknown = {}): DiscoveryMemo | null {
  const presentation = presentationOf(recipeId, stored, legacy);
  return discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation });
}

interface State {
  recipeId: string;
  prefix: number;
  stored: string[];
  memo: DiscoveryMemo;
  content: string; // the completed facts, derived from the LADDER (not from the memo)
}

const states: State[] = [];
for (const recipe of RECIPES) {
  const ladder = buildHint5Ladder(recipe.id)!;
  let stored: string[] = [];
  for (let prefix = 0; ; prefix += 1) {
    const memo = memoFor(recipe.id, stored)!;
    const completed = ladder.rungs.slice(0, prefix);
    const content = JSON.stringify([
      completed.map((r) => [r.kind, r.kind === "SUB_CLASS" ? subToppingClass(r.subjectIds[0]) : r.subjectIds, r.ordinal]),
      prefix === ladder.rungs.length,
    ]);
    states.push({ recipeId: recipe.id, prefix, stored: [...stored], memo, content });
    const next = presentationOf(recipe.id, stored)!.next;
    if (!next) break;
    const r = requestHint5Rung({ recipeId: recipe.id, discoveredCount: DISCOVERED_COUNT, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: next.rungIndex, pitzBalance: 100000 });
    if (r.outcome !== "ANSWERED" && r.outcome !== "ALREADY_KNOWN") throw new Error(`${recipe.id}: ${r.outcome}`);
    stored = [...stored, ...r.addFactIds.filter((id) => !stored.includes(id))];
  }
}

describe("Discovery memo probe — every rung of every production recipe, through the real authority", () => {
  it("covers every recipe and every prefix of its ladder", () => {
    const expected = RECIPES.reduce((n, r) => n + buildHint5Ladder(r.id)!.rungs.length + 1, 0);
    expect(states).toHaveLength(expected);
    expect(expected).toBeGreaterThanOrEqual(151);
  });

  it("the memo shows exactly the bought rungs, with the ladder's own content, in order", () => {
    for (const s of states) {
      const ladder = buildHint5Ladder(s.recipeId)!;
      const completed = ladder.rungs.slice(0, s.prefix);
      const fixed = s.memo.rows.slice(0, 4);
      for (const [i, kind] of (["SAUCE", "CHEESE", "KEY_TOPPING", "STRUCTURE"] as const).entries()) {
        const rung = completed.find((r) => r.kind === kind);
        const row = fixed[i];
        if (!rung) {
          expect(row, `${s.recipeId}@${s.prefix} ${kind}`).toMatchObject({ status: "UNKNOWN" });
        } else if (kind === "STRUCTURE") {
          expect(row).toMatchObject({ kind: "structure", status: "KNOWN" });
        } else if (rung.subjectIds.length === 0) {
          expect(row, `${s.recipeId}@${s.prefix} ${kind}`).toMatchObject({ status: "NONE" });
          expect(kind).not.toBe("SAUCE");
        } else {
          expect(row, `${s.recipeId}@${s.prefix} ${kind}`).toMatchObject({ status: "KNOWN", ingredientIds: rung.subjectIds });
        }
      }
      const subs = s.memo.rows.filter((r) => r.kind === "subToppingFamily");
      const boughtSubs = completed.filter((r) => r.kind === "SUB_CLASS");
      expect(subs.map((r) => (r as { ordinal: number }).ordinal), `${s.recipeId}@${s.prefix}`).toEqual(boughtSubs.map((r) => r.ordinal));
      expect(subs.map((r) => (r as { family: string }).family)).toEqual(boughtSubs.map((r) => subToppingClass(r.subjectIds[0])));
      const allDone = s.prefix === ladder.rungs.length;
      expect(s.memo.completion === "COMPLETE", `${s.recipeId}@${s.prefix}`).toBe(allDone);
    }
  });

  it("no family row before STRUCTURE, and never a slot for an unbought rung", () => {
    for (const s of states) {
      const ladder = buildHint5Ladder(s.recipeId)!;
      const structureIndex = ladder.rungs.findIndex((r) => r.kind === "STRUCTURE");
      const subCount = s.memo.rows.filter((r) => r.kind === "subToppingFamily").length;
      if (s.prefix <= structureIndex) expect(subCount, `${s.recipeId}@${s.prefix}`).toBe(0);
      else expect(subCount).toBe(s.prefix - (structureIndex + 1));
    }
  });

  it("the serialised memo holds no unbought id or name, no sub-topping id, no recipe identity, no ledger string, no offer", () => {
    for (const s of states) {
      const recipe = RECIPES.find((r) => r.id === s.recipeId)!;
      const ladder = buildHint5Ladder(s.recipeId)!;
      const completedIds = new Set(ladder.rungs.slice(0, s.prefix).flatMap((r) => r.subjectIds));
      const json = JSON.stringify(s.memo);
      for (const id of ladder.rungs.flatMap((r) => r.subjectIds)) {
        if (completedIds.has(id)) continue;
        expect(json, `${s.recipeId}@${s.prefix}: ${id}`).not.toContain(`"${id}"`);
        const name = getIngredient(id)?.nameJa;
        if (name) expect(json).not.toContain(name);
      }
      if (!completedIds.has(recipe.id)) expect(json).not.toContain(`"${recipe.id}"`); // pepperoni's key topping is also a recipe id
      expect(json).not.toContain(recipe.nameJa);
      expect(json).not.toContain(recipe.description.slice(0, 12));
      expect(json).not.toMatch(/cls:|h5:|ing:|meta:|attr:|Pitz|price|next|candidate/);
    }
  });

  it("nothing bought: the memo is byte-identical for every production recipe (FREE LEAK)", () => {
    const empties = states.filter((s) => s.prefix === 0).map((s) => JSON.stringify(s.memo));
    expect(empties).toHaveLength(RECIPES.length);
    expect(new Set(empties).size).toBe(1);
  });

  it("the same completed content gives the same memo, for every pair of recipes and prefixes (metamorphic)", () => {
    let pairs = 0;
    const byRecipe = new Map<string, State[]>();
    for (const s of states) byRecipe.set(s.recipeId, [...(byRecipe.get(s.recipeId) ?? []), s]);
    const ids = [...byRecipe.keys()];
    for (let a = 0; a < ids.length; a += 1) {
      for (let b = a + 1; b < ids.length; b += 1) {
        const sa = byRecipe.get(ids[a])!;
        const sb = byRecipe.get(ids[b])!;
        for (let k = 0; k < Math.min(sa.length, sb.length); k += 1) {
          if (sa[k].content !== sb[k].content) continue;
          pairs += 1;
          expect(JSON.stringify(sa[k].memo), `${ids[a]} vs ${ids[b]} @${k}`).toBe(JSON.stringify(sb[k].memo));
        }
      }
    }
    expect(pairs).toBeGreaterThanOrEqual(500);
  });

  it("the memo does not depend on the recipe identity: it is a function of the presentation facts alone", () => {
    for (const s of states) {
      const presentation = presentationOf(s.recipeId, s.stored)!;
      const projected = { board: presentation.board, legacyKnownIngredientIds: presentation.legacyKnownIngredientIds, completeText: presentation.completeText, onboarding: presentation.onboarding };
      expect(JSON.stringify(discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation: projected }))).toBe(JSON.stringify(s.memo));
    }
  });

  it("a card that leaves DISCOVERABLE shows nothing, and the same ledger rebuilds the same memo when it returns", () => {
    for (const s of states.filter((x) => x.prefix > 0)) {
      const presentation = presentationOf(s.recipeId, s.stored)!;
      for (const cardState of ["DISCOVERED", "KNOWN_BUT_MISSING_MATERIAL", "UNKNOWN"] as const) {
        expect(discoveryMemoOf({ cardState, hint5Enabled: true, presentation })).toBeNull();
      }
      expect(JSON.stringify(discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation }))).toBe(JSON.stringify(s.memo));
    }
  });

  it("the Dex-0 onboarding and a non-target have no memo", () => {
    const onboarding = hint5Presentation({ recipeId: "margherita", discoveredCount: 0, storedFactIds: [], legacyPurchases: {}, pitzBalance: 0 });
    expect(discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation: onboarding })).toBeNull();
    const none = hint5Presentation({ recipeId: "no-such-recipe", discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, pitzBalance: 0 });
    expect(none).toBeNull();
    expect(discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation: none })).toBeNull();
  });
});

describe("Discovery memo probe — legacy names and forged ledgers, through the real presentation", () => {
  const withSubs = RECIPES.filter((r) => buildHint5Ladder(r.id)!.rungs.some((x) => x.kind === "SUB_CLASS"));

  it("an owned legacy ing: name is an earlier-hint row, completes no rung and leaves the fixed rows UNKNOWN (D-2)", () => {
    for (const recipe of withSubs) {
      const sub = buildHint5Ladder(recipe.id)!.rungs.find((x) => x.kind === "SUB_CLASS")!.subjectIds[0];
      const m = memoFor(recipe.id, [`ing:${sub}`])!;
      expect(m.rows.filter((r) => r.kind === "legacyIngredient")).toEqual([{ kind: "legacyIngredient", ingredientId: sub }]);
      expect(m.rows.slice(0, 4).every((r) => "status" in r && r.status === "UNKNOWN")).toBe(true);
      expect(JSON.stringify(m)).toEqual(JSON.stringify(memoFor(recipe.id, [`ing:${sub}`])));
    }
  });

  it("forged cls: records without a bought STRUCTURE draw no family row", () => {
    for (const recipe of withSubs) {
      const forged = buildHint5Ladder(recipe.id)!.rungs.filter((x) => x.kind === "SUB_CLASS").map((x) => `cls:${x.subjectIds[0]}`);
      for (const extra of [[], ["h5:sauce"], ["h5:sauce", "h5:cheese", "h5:key"]]) {
        expect(memoFor(recipe.id, [...extra, ...forged])!.rows.some((r) => r.kind === "subToppingFamily"), recipe.id).toBe(false);
      }
    }
  });

  it("older Economy 1.0 purchases and Hint 4.0 facts add no free text and no family or structure row", () => {
    const legacyPurchases = Object.fromEntries(RECIPES.map((r) => [r.id, 4]));
    for (const recipe of RECIPES) {
      const m = memoFor(recipe.id, ["meta:ingredient-total", "attr:group:protein", "attr:family:meat"], legacyPurchases)!;
      const json = JSON.stringify(m);
      expect(json).not.toMatch(/使わない|みたい|全部で|なかま/);
      expect(m.rows.some((r) => r.kind === "subToppingFamily")).toBe(false);
      for (const r of m.rows) expect(["sauce", "cheese", "keyTopping", "structure", "legacyIngredient"]).toContain(r.kind);
    }
  });

  it("hostile ledgers and legacy ledgers never throw and never add a fact row", () => {
    const stored: unknown[] = [null, undefined, 0, "h5:sauce", {}, [1, 2], ["__proto__", "constructor"], ["h5:future", "cls:", "cls:__proto__", "ing:", "x".repeat(5000)], Array.from({ length: 3000 }, (_, i) => `ing:unknown-${i}`)];
    for (const s of stored) {
      for (const legacy of [undefined, null, 5, [], { capricciosa: "9" }]) {
        const presentation = hint5Presentation({ recipeId: "capricciosa", discoveredCount: 5, storedFactIds: s, legacyPurchases: legacy, pitzBalance: 0 });
        const m = discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation });
        expect(m).not.toBeNull();
        expect(m!.rows.slice(0, 4).every((r) => "status" in r && r.status === "UNKNOWN")).toBe(true);
        expect(m!.rows.some((r) => r.kind === "subToppingFamily" || r.kind === "complete")).toBe(false);
      }
    }
  });
});
