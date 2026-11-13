import { describe, expect, it } from "vitest";
import type { KitTrain } from "../../../../tools/train-kit/lib/implSpec";
import { composeCatalog, type FrozenBaseline } from "./composedCatalog";

/** R-1: the composition arithmetic on SYNTHETIC data (no catalog value is pinned here; the real catalog is checked by ../catalogComposition.test.ts). */
const FROZEN_SYN: FrozenBaseline = {
  commit: "0".repeat(40),
  recipes: [{ id: "r1", credited: true, late: false }, { id: "r2", credited: false, late: false }, { id: "late1", credited: true, late: true }, { id: "pinsa-romana", credited: false, late: true }],
  ingredients: [{ id: "i1", category: "sauce", family: null, late: false }, { id: "i2", category: "topping", family: "meat", late: false }, { id: "l1", category: "topping", family: "herb", late: true }],
  ordinaryLadder: [{ ingredientIds: ["i1"], keyRecipeId: "r1" }, { ingredientIds: ["i2"], keyRecipeId: "r2x" }],
  lateLadder: [{ ingredientIds: ["l1"], keyRecipeId: "late1" }],
  floors: { l1: 3 },
  chapterSizes: [1, 1, 1, 2],
  lunchRushPool: 2,
};
const train = (over: Partial<KitTrain> & Pick<KitTrain, "recipes" | "newIngredients">): KitTrain => ({ train: "T", tag: "t", label: "T", issue: 1, seq: 1, ...over });
const rec = (id: string, extra: Record<string, unknown> = {}) => ({ id, nameJa: id, description: "d", placement: "ordinary" as const, requiredIngredients: [], bakeTarget: { start: 58, end: 78 }, baseRewardPitz: 100, lunchRush: false, ladderCredit: true, evidenceId: id, order: { requestedBy: "m", lineJa: "l" }, sauceProfile: null, ladderStep: null, ...extra });

describe("composeCatalog", () => {
  it("the frozen baseline alone composes to itself, numbered ordinary first then late", () => {
    const c = composeCatalog({ pinsa: true }, [], FROZEN_SYN);
    expect(c.recipeIds).toEqual(["r1", "r2", "late1", "pinsa-romana"]);
    expect(c.steps.map((s) => [s.step, s.keyRecipeId, s.late])).toEqual([[1, "r1", false], [2, "r2x", false], [3, "late1", true]]);
    expect(c.stepOfMaterial("l1")).toBe(3);
    expect(c.floors).toEqual({ l1: 3 });
    expect(c.chapterSizes).toEqual([1, 1, 1, 2]);
    expect(c.byShelf).toEqual({ sauce: 1, meat: 1, herb: 1 });
  });

  it("a landed ordinary step shifts every late number by one; a landed late step is appended after the older late ones", () => {
    const t = train({
      recipes: [rec("o1", { ladderStep: { ingredientIds: ["n1"] }, lunchRush: true }), rec("lt", { placement: "late", ladderStep: { ingredientIds: ["n2"] } })],
      newIngredients: [{ id: "n1", nameJa: "n", category: "topping", family: "fruit", color: "#000000", emoji: "x" }, { id: "n2", nameJa: "n", category: "cheese", family: null, color: "#000000", emoji: "y" }],
      floors: { n2: 5 },
    });
    const c = composeCatalog({ pinsa: true }, [t], FROZEN_SYN);
    expect(c.steps.map((s) => [s.step, s.keyRecipeId])).toEqual([[1, "r1"], [2, "r2x"], [3, "o1"], [4, "late1"], [5, "lt"]]);
    expect(c.stepOfMaterial("l1")).toBe(4);
    expect(c.floors).toEqual({ l1: 3, n2: 5 });
    expect(c.lunchRushPool).toBe(3);
    expect(c.chapterSizes).toEqual([1, 1, 1, 4]);
    expect(c.toppingCount).toBe(3);
    expect(c.byShelf).toEqual({ sauce: 1, meat: 1, herb: 1, fruit: 1, cheese: 1 });
    expect(c.ingredients.find((i) => i.id === "n1")!.late).toBe(false);
    expect(c.ingredients.find((i) => i.id === "n2")!.late).toBe(true);
  });

  it("landed trains compose in seq order, a rider without a step adds a recipe and no step, and `chapter` places it", () => {
    const a = train({ seq: 2, recipes: [rec("b1", { ladderStep: { ingredientIds: ["m1"] } })], newIngredients: [{ id: "m1", nameJa: "m", category: "sauce", family: null, color: "#000000", emoji: "z" }] });
    const b = train({ seq: 1, recipes: [rec("a1", { ladderStep: { ingredientIds: ["m0"] } }), rec("rider", { ladderCredit: false, chapter: 2 })], newIngredients: [{ id: "m0", nameJa: "m", category: "sauce", family: null, color: "#000000", emoji: "w" }] });
    const c = composeCatalog({ pinsa: true }, [a, b].sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0)), FROZEN_SYN);
    expect(c.ordinarySteps.map((s) => s.keyRecipeId)).toEqual(["r1", "r2x", "a1", "b1"]);
    expect(c.recipeIds.slice(-3)).toEqual(["a1", "rider", "b1"]);
    expect(c.creditedIds).toEqual(["r1", "late1", "a1", "b1"]);
    expect(c.chapterSizes).toEqual([1, 2, 1, 4]);
  });

  it("the Pinsa gate removes exactly the gated recipe and one recipe from the last chapter", () => {
    const on = composeCatalog({ pinsa: true }, [], FROZEN_SYN);
    const off = composeCatalog({ pinsa: false }, [], FROZEN_SYN);
    expect(on.recipeIds.filter((id) => !off.recipeIds.includes(id))).toEqual(["pinsa-romana"]);
    expect(off.chapterSizes).toEqual([1, 1, 1, 1]);
  });
});
