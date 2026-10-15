import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "./ingredients";
import {
  DEFAULT_TOPPING_SIZE_CLASS,
  TOPPING_SIZE_CLASSES,
  TOPPING_SIZE_CLASS_BY_ID,
  TOPPING_SIZE_SCALE_CANDIDATES,
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
