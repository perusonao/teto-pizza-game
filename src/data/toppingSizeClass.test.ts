import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "./ingredients";
import {
  DEFAULT_TOPPING_SIZE_CLASS,
  TOPPING_RANK_SCALE,
  TOPPING_RANK_SCALE_EXEMPT_IDS,
  TOPPING_SIZE_CLASSES,
  TOPPING_SIZE_CLASS_BY_ID,
  TOPPING_SIZE_SCALE_CANDIDATES,
  toppingRankScale,
  toppingSizeClass,
  toppingSizeScale,
} from "./toppingSizeClass";

const scatterIds = INGREDIENTS.filter((i) => i.placement === "scatter").map((i) => i.id);

describe("toppingSizeClass table (Issue #479 S1)", () => {
  it("classifies every scatter ingredient (a new ingredient must be added to the table)", () => {
    const missing = scatterIds.filter((id) => !Object.hasOwn(TOPPING_SIZE_CLASS_BY_ID, id));
    expect(missing).toEqual([]);
  });

  it("has no entry for a spread ingredient (sauce) or for an id that is not an ingredient", () => {
    const scatter = new Set(scatterIds);
    const stray = Object.keys(TOPPING_SIZE_CLASS_BY_ID).filter((id) => !scatter.has(id));
    expect(stray).toEqual([]);
  });

  it("only uses the five known classes, and every class is used", () => {
    const used = new Set(Object.values(TOPPING_SIZE_CLASS_BY_ID));
    for (const c of used) expect(TOPPING_SIZE_CLASSES).toContain(c);
    for (const c of TOPPING_SIZE_CLASSES) expect(used.has(c)).toBe(true);
  });

  it("keeps the Owner-approved reference and boundary assignments", () => {
    expect(toppingSizeClass("corn")).toBe("xs");
    expect(toppingSizeClass("black-olive")).toBe("s");
    expect(toppingSizeClass("mushroom")).toBe("m");
    expect(toppingSizeClass("pineapple")).toBe("m");
    expect(toppingSizeClass("mozzarella")).toBe("l");
    expect(toppingSizeClass("egg")).toBe("l");
    expect(toppingSizeClass("bacon")).toBe("l");
    expect(toppingSizeClass("basil")).toBe("xl");
  });

  it("classifies the Batch 7a ingredients (Owner-specified)", () => {
    expect(toppingSizeClass("mint")).toBe("xs");
    expect(toppingSizeClass("lamb")).toBe("m");
    expect(toppingSizeClass("sweet-potato")).toBe("m");
  });
});

describe("toppingSizeClass fallback", () => {
  it("gives the reference class to a sauce, an unknown id and an empty id", () => {
    for (const id of ["tomato-sauce", "olive-oil", "pesto", "no-such-ingredient", ""]) {
      expect(toppingSizeClass(id)).toBe(DEFAULT_TOPPING_SIZE_CLASS);
    }
  });

  it("does not read inherited object keys as ingredients", () => {
    for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(toppingSizeClass(id)).toBe(DEFAULT_TOPPING_SIZE_CLASS);
    }
  });
});

describe("TOPPING_SIZE_SCALE_CANDIDATES (provisional comparison data)", () => {
  for (const [key, set] of Object.entries(TOPPING_SIZE_SCALE_CANDIDATES)) {
    describe(`set ${key}`, () => {
      it("defines a finite positive multiplier for every class", () => {
        for (const c of TOPPING_SIZE_CLASSES) {
          expect(Number.isFinite(set[c])).toBe(true);
          expect(set[c]).toBeGreaterThan(0);
        }
      });

      it("is strictly increasing from extra small to extra large", () => {
        const values = TOPPING_SIZE_CLASSES.map((c) => set[c]);
        for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThan(values[i - 1]);
      });

      it("leaves the medium (reference) class at exactly 1", () => {
        expect(set[DEFAULT_TOPPING_SIZE_CLASS]).toBe(1);
      });
    });
  }

  it("toppingSizeScale resolves id -> class -> multiplier, and an unknown id is 1", () => {
    expect(toppingSizeScale("corn", "A")).toBe(0.6);
    expect(toppingSizeScale("basil", "A")).toBe(1.5);
    expect(toppingSizeScale("basil", "B")).toBe(1.3);
    expect(toppingSizeScale("unknown-id", "A")).toBe(1);
    expect(toppingSizeScale("tomato-sauce", "B")).toBe(1);
  });
});

describe("TOPPING_RANK_SCALE / toppingRankScale (S2c: production = candidate set B)", () => {
  it("is exactly the Owner-approved set B: 0.7 / 0.85 / 1 / 1.15 / 1.3", () => {
    expect(TOPPING_RANK_SCALE).toEqual({ xs: 0.7, s: 0.85, m: 1, l: 1.15, xl: 1.3 });
    expect(TOPPING_RANK_SCALE).toEqual(TOPPING_SIZE_SCALE_CANDIDATES.B);
  });

  it("gives every scatter ingredient the multiplier of its class, except the exempt ids", () => {
    for (const id of scatterIds) {
      const expected = TOPPING_RANK_SCALE_EXEMPT_IDS.includes(id) ? 1 : TOPPING_RANK_SCALE[toppingSizeClass(id)];
      expect(toppingRankScale(id), id).toBe(expected);
    }
  });

  it("mozzarella is exempt in every set (size and melt unchanged), though its class stays l", () => {
    expect(TOPPING_RANK_SCALE_EXEMPT_IDS).toEqual(["mozzarella"]);
    expect(toppingSizeClass("mozzarella")).toBe("l");
    for (const set of [TOPPING_RANK_SCALE, ...Object.values(TOPPING_SIZE_SCALE_CANDIDATES)]) expect(toppingRankScale("mozzarella", set)).toBe(1);
    expect(toppingRankScale("mozzarella", TOPPING_RANK_SCALE, { mozzarella: 2 })).toBe(1);
  });

  it("is 1 for a sauce, an unknown id and an inherited key (the default class)", () => {
    for (const id of ["tomato-sauce", "no-such-ingredient", "", "constructor"]) expect(toppingRankScale(id)).toBe(1);
  });

  it("the production default applies no per-ingredient correction; an explicit fit multiplies on top (rounded to 3 places)", () => {
    expect(toppingRankScale("black-olive")).toBe(0.85);
    expect(toppingRankScale("black-olive", TOPPING_RANK_SCALE, { "black-olive": 0.85 })).toBe(0.722);
    expect(toppingRankScale("bacon", TOPPING_RANK_SCALE, { "black-olive": 0.85 })).toBe(1.15);
    expect(toppingRankScale("bacon", TOPPING_RANK_SCALE, { bacon: 1.1 })).toBe(1.265);
  });
});
