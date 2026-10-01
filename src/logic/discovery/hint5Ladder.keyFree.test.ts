import { describe, expect, it } from "vitest";
import { type Recipe, RECIPES } from "../../data/recipes";
import { KEYED_RECIPES } from "../testSupport/keyedRecipes";
import type { HintRoles } from "../../data/recipeHintRoles";
import {
  HINT5_RUNG_MARKER,
  buildHint5Ladder,
  hint5EmptyFixedRungs,
  isKeyFreeHintRoles,
  hint5Presentation,
  hint5ReservedRungs,
  hint5RungLabelJa,
  hint5ClassFactId,
  HINT5_RUNG_PRICE,
  requestHint5Rung,
} from "./hint5Ladder";

// Discovery 3.0 PR-3 (OD-D3-19 Migration A, OD-D3-21): key-free Hint authoring.

/** Every observable ladder output of the 25 production recipes, in progressively completed states.
 *  The golden file was generated from `main` BEFORE the key-free change (Migration A: byte-equal). */
function productionSnapshot(): string {
  const out: unknown[] = [];
  // Keyed production recipes only: the golden is the pre-key-free output. A key-free production recipe is not in it
  // (nothing it could be compared against); it is covered by the key-free fixtures below.
  for (const r of KEYED_RECIPES) {
    const ladder = buildHint5Ladder(r.id);
    const completed: string[] = [];
    const states: unknown[] = [];
    for (let n = 0; n <= (ladder?.rungs.length ?? 0); n++) {
      if (n > 0) {
        const rung = ladder!.rungs[n - 1];
        completed.push(rung.kind === "SUB_CLASS" ? hint5ClassFactId(rung.subjectIds[0]) : HINT5_RUNG_MARKER[rung.kind]);
      }
      const input = { recipeId: r.id, discoveredCount: 5, storedFactIds: [...completed], legacyPurchases: [], pitzBalance: 100 };
      states.push({
        n,
        presentation: hint5Presentation(input),
        request: requestHint5Rung({ ...input, expectedRungIndex: n + 1 }),
      });
    }
    out.push({ id: r.id, ladder, empty: hint5EmptyFixedRungs(r.id), reserved: hint5ReservedRungs(r.id), states });
  }
  return JSON.stringify(out, null, 1) + "\n";
}

describe("A. the 25 production recipes: Hint 5.0 output is unchanged", () => {
  it("matches the pre-change golden snapshot", async () => {
    await expect(productionSnapshot()).toMatchFileSnapshot("./__golden__/hint5.production25.json");
  });
});

// ---- B-G: synthetic key-free fixtures (no production recipe is key-free) ------------------------

type Req = { ingredientId: string; minCount: number };
const fixture = (id: string, reqs: Req[]): Recipe =>
  ({ id, nameJa: id, description: "", requiredIngredients: reqs, bakeTarget: { start: 60, end: 80 }, baseRewardPitz: 100 }) as unknown as Recipe;
const KEY_FREE: HintRoles = { keyFree: true };
const build = (r: Recipe) => buildHint5Ladder(r.id, [...RECIPES, r], { [r.id]: KEY_FREE });
const kinds = (r: Recipe) => build(r)!.rungs.map((x) => x.kind);

const FULL = fixture("kf-full", [
  { ingredientId: "tomato-sauce", minCount: 1 },
  { ingredientId: "mozzarella", minCount: 2 },
  { ingredientId: "sausage", minCount: 2 },
  { ingredientId: "onion", minCount: 2 },
]);
const NO_CHEESE = fixture("kf-no-cheese", [
  { ingredientId: "tomato-sauce", minCount: 1 },
  { ingredientId: "sausage", minCount: 2 },
  { ingredientId: "onion", minCount: 2 },
]);
const NO_SAUCE = fixture("kf-no-sauce", [
  { ingredientId: "mozzarella", minCount: 2 },
  { ingredientId: "sausage", minCount: 2 },
  { ingredientId: "onion", minCount: 2 },
]);
const NO_SAUCE_NO_CHEESE = fixture("kf-bare", [
  { ingredientId: "sausage", minCount: 2 },
  { ingredientId: "onion", minCount: 2 },
]);
const ALL = [FULL, NO_CHEESE, NO_SAUCE, NO_SAUCE_NO_CHEESE];

describe("B. key-free recipe has no KEY_TOPPING", () => {
  it("full fixture: SAUCE, CHEESE, STRUCTURE, SUB_CLASS x2 (catalog order)", () => {
    expect(isKeyFreeHintRoles(KEY_FREE)).toBe(true);
    expect(kinds(FULL)).toEqual(["SAUCE", "CHEESE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"]);
  });
  it("never KEY_TOPPING, and the key marker/labels never appear", () => {
    for (const r of ALL) {
      expect(kinds(r)).not.toContain("KEY_TOPPING");
      for (const rung of build(r)!.rungs) expect(hint5RungLabelJa(rung)).not.toContain("キートッピング");
    }
  });
  it("all toppings become SUB_CLASS rungs with ordinals 1..n", () => {
    const subs = build(FULL)!.rungs.filter((x) => x.kind === "SUB_CLASS");
    expect(subs.map((x) => x.ordinal)).toEqual([1, 2]);
    expect(subs.map((x) => x.subjectIds[0]).sort()).toEqual(["onion", "sausage"]);
  });
});

describe("C-E. rungs that do not apply are absent", () => {
  it("C: no cheese -> no CHEESE rung", () => {
    expect(kinds(NO_CHEESE)).toEqual(["SAUCE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"]);
  });
  it("D: no sauce -> no SAUCE rung", () => {
    expect(kinds(NO_SAUCE)).toEqual(["CHEESE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"]);
  });
  it("E: no sauce + no cheese -> still a valid ladder", () => {
    expect(kinds(NO_SAUCE_NO_CHEESE)).toEqual(["STRUCTURE", "SUB_CLASS", "SUB_CLASS"]);
    expect(build(NO_SAUCE_NO_CHEESE)!.total).toBe(2);
  });
});

describe("F. no empty / dummy rung", () => {
  it("every rung other than STRUCTURE has a subject; none is RESERVED or empty", () => {
    for (const r of ALL) {
      const ladder = build(r)!;
      for (const rung of ladder.rungs) if (rung.kind !== "STRUCTURE") expect(rung.subjectIds.length, `${r.id}:${rung.kind}`).toBeGreaterThan(0);
      expect(ladder.rungs.filter((x) => x.kind === "STRUCTURE" || x.subjectIds.length > 0)).toHaveLength(ladder.rungs.length);
      expect(hint5EmptyFixedRungs(r.id, [...RECIPES, r], { [r.id]: KEY_FREE })).toEqual([]);
      expect(hint5ReservedRungs(r.id, [...RECIPES, r], { [r.id]: KEY_FREE })).toEqual([]);
    }
  });
  it("presentation never shows a `none` board entry, whatever is completed", () => {
    for (const r of ALL) {
      const recipes = [...RECIPES, r];
      const ladder = build(r)!;
      const facts = ladder.rungs.map((x) => (x.kind === "SUB_CLASS" ? hint5ClassFactId(x.subjectIds[0]) : HINT5_RUNG_MARKER[x.kind]));
      const roles = { [r.id]: KEY_FREE };
      const own = hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: facts, legacyPurchases: [], pitzBalance: 100 }, recipes, roles);
      expect(own).not.toBeNull();
      expect(own!.next).toBeNull();
      expect(own!.board).toHaveLength(ladder.rungs.length);
      for (const e of own!.board) if ("none" in e) expect(e.none).toBe(false);
    }
  });
});

describe("G. rung numbers/positions carry no extra information", () => {
  it("indices are consecutive 1..n and labels use exactly those numbers (no gap where a rung is absent)", () => {
    for (const r of ALL) {
      const rungs = build(r)!.rungs;
      expect(rungs.map((x) => x.index)).toEqual(rungs.map((_, i) => i + 1));
      rungs.forEach((x, i) => expect(hint5RungLabelJa(x).startsWith(`ヒント${i + 1}:`)).toBe(true));
    }
  });
  it("a sauce-less/cheese-less ladder is indistinguishable in shape from any other: same kinds-as-rungs-only, price by kind", () => {
    for (const r of ALL) {
      const recipes = [...RECIPES, r];
      const pres = hint5Presentation({ recipeId: r.id, discoveredCount: 5, storedFactIds: [], legacyPurchases: [], pitzBalance: 100 }, recipes, { [r.id]: KEY_FREE });
      expect(pres!.board).toEqual([]);
      expect(pres!.next!.rungIndex).toBe(1);
      expect(pres!.next!.price).toBe(HINT5_RUNG_PRICE[build(r)!.rungs[0].kind]);
    }
  });
  it("STRUCTURE gating of SUB_CLASS works at any position (a stored cls: before STRUCTURE is not shown)", () => {
    const recipes = [...RECIPES, NO_SAUCE_NO_CHEESE];
    const pres = hint5Presentation(
      { recipeId: NO_SAUCE_NO_CHEESE.id, discoveredCount: 5, storedFactIds: [hint5ClassFactId("sausage")], legacyPurchases: [], pitzBalance: 100 },
      recipes,
      { [NO_SAUCE_NO_CHEESE.id]: KEY_FREE },
    );
    expect(pres!.board).toEqual([]);
  });
});

describe("invalid key-free input fails closed", () => {
  it("a topping without a family is not a target (T-COV)", () => {
    const bad = fixture("kf-bad", [{ ingredientId: "no-such-ingredient", minCount: 1 }]);
    expect(buildHint5Ladder(bad.id, [bad], { [bad.id]: KEY_FREE })).toBeNull();
  });
  it("only `keyFree: true` is the marker", () => {
    expect(isKeyFreeHintRoles({ keyFree: false })).toBe(false);
    expect(isKeyFreeHintRoles(null)).toBe(false);
    expect(isKeyFreeHintRoles({ hintKeyToppingId: null, hintSubToppingOrder: [] })).toBe(false);
  });
});
