import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "./pizzaState";
import { layersWithPending, sauceLayersOf, sauceRunsOf } from "./sauceLayers";

const dep = (amount: number, ingredientId?: string, x = 50, y = 50): SauceDeposit =>
  ingredientId === undefined ? { x, y, amount } : { x, y, amount, ingredientId };
const pizza = (sauceIds: string[], sauceDeposits: SauceDeposit[]): PizzaState => ({ ...createEmptyPizza(), sauceIds, sauceDeposits });

describe("sauceLayersOf (Sauce B2 + #494: chronological runs, later painted over earlier)", () => {
  it("one sauce kind: null, so the single heatmap is drawn as it always was", () => {
    expect(sauceLayersOf(pizza(["tomato-sauce"], [dep(0.1), dep(0.2)]), [], null)).toBeNull();
    expect(sauceLayersOf(createEmptyPizza(), [], null)).toBeNull();
    expect(sauceLayersOf(pizza(["pesto"], [dep(0.1)]), [dep(0.02)], "pesto")).toBeNull(); // the same kind in progress
  });

  it("two kinds: one layer per run, in the order the strokes were laid, each with only its own deposits", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce", 20, 20), dep(0.3, "tomato-sauce", 25, 25), dep(0.2, "pesto", 70, 70)]);
    const layers = sauceLayersOf(p, [], null)!;
    expect(layers.map((l) => l.ingredientId)).toEqual(["tomato-sauce", "pesto"]);
    expect(layers[0].deposits.map((d) => d.amount)).toEqual([0.1, 0.3]); // consecutive strokes of one kind are one run
    expect(layers[1].deposits.map((d) => d.amount)).toEqual([0.2]);
  });

  it("switching back starts a NEW top run: what is painted after a switch shows over what was painted before it (Owner Decision, #494)", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce"), dep(0.1, "pesto"), dep(0.1, "tomato-sauce"), dep(0.1, "tomato-sauce")]);
    expect(sauceLayersOf(p, [], null)!.map((l) => [l.ingredientId, l.deposits.length])).toEqual([
      ["tomato-sauce", 1],
      ["pesto", 1],
      ["tomato-sauce", 2],
    ]);
  });

  it("three kinds stack in the order they were laid", () => {
    const p = pizza(["olive-oil", "tomato-sauce", "pesto"], [dep(0.1, "olive-oil"), dep(0.1, "tomato-sauce"), dep(0.1, "pesto")]);
    expect(sauceLayersOf(p, [], null)!.map((l) => l.ingredientId)).toEqual(["olive-oil", "tomato-sauce", "pesto"]);
  });

  it("the stroke in progress extends the top run when it is the same kind, otherwise it is a new top run", () => {
    const committed = pizza(["tomato-sauce"], [dep(0.3), dep(0.2)]); // one kind, unstamped history
    const layers = sauceLayersOf(committed, [dep(0.02), dep(0.02)], "pesto")!;
    expect(layers.map((l) => l.ingredientId)).toEqual(["tomato-sauce", "pesto"]);
    expect(layers[0].deposits).toHaveLength(2); // the unstamped history belongs to the only sauce used so far
    expect(layers[1].deposits).toHaveLength(2);
    const both = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce"), dep(0.1, "pesto")]);
    // tomato in progress over pesto on top: a new third run (it used to be folded into the bottom tomato layer, hidden under the pesto)
    expect(sauceLayersOf(both, [dep(0.02)], "tomato-sauce")!.map((l) => [l.ingredientId, l.deposits.length])).toEqual([
      ["tomato-sauce", 1],
      ["pesto", 1],
      ["tomato-sauce", 1],
    ]);
    expect(sauceLayersOf(both, [dep(0.02)], "pesto")!.map((l) => [l.ingredientId, l.deposits.length])).toEqual([["tomato-sauce", 1], ["pesto", 2]]);
  });

  it("committed runs are the same objects across calls with a different pending stroke (so their canvases are not redrawn)", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce"), dep(0.1, "pesto")]);
    const runs = sauceRunsOf(p);
    const a = layersWithPending(runs, [dep(0.02)], "pesto")!;
    const b = layersWithPending(runs, [dep(0.02), dep(0.02)], "pesto")!;
    expect(a[0]).toBe(runs[0]);
    expect(b[0]).toBe(runs[0]);
    expect(a[1]).not.toBe(b[1]); // only the top run is rebuilt
  });

  it("each layer carries every deposit of the layers below it (render-only, for the overlap dimming)", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce", 20), dep(0.2, "pesto", 40), dep(0.3, "tomato-sauce", 60)]);
    const layers = sauceLayersOf(p, [], null)!;
    expect(layers.map((l) => l.under.map((d) => d.x))).toEqual([[], [20], [20, 40]]);
    // a stroke in progress under a NEW kind sees everything committed; extending the top run keeps its `under`
    const fresh = sauceLayersOf(p, [dep(0.02, undefined, 80)], "olive-oil")!;
    expect(fresh[3].under.map((d) => d.x)).toEqual([20, 40, 60]);
    const extended = sauceLayersOf(p, [dep(0.02, undefined, 80)], "tomato-sauce")!;
    expect(extended[2].under.map((d) => d.x)).toEqual([20, 40]);
    expect(extended[2].deposits).toHaveLength(2);
  });

  it("a sauce that laid nothing has no layer: a one-shot sauce plus a painted one is a single layer", () => {
    expect(sauceLayersOf(pizza(["tomato-sauce", "pesto"], [dep(0.3, "pesto")]), [], null)).toBeNull();
  });

  it("a pending stroke without a kind is ignored (nothing to attribute it to)", () => {
    expect(sauceLayersOf(pizza(["tomato-sauce"], [dep(0.1)]), [dep(0.02)], null)).toBeNull();
  });

  it("never mutates its input", () => {
    const deposits = [dep(0.1, "tomato-sauce"), dep(0.1, "pesto")];
    const p = pizza(["tomato-sauce", "pesto"], deposits);
    sauceLayersOf(p, [dep(0.02)], "pesto");
    expect(p.sauceDeposits).toBe(deposits);
    expect(deposits).toHaveLength(2);
  });
});

describe("sauceRunsOf with the previous runs (Codex P2 on PR #494: a commit does not rebuild unchanged runs)", () => {
  const dep = (x: number, id: string): SauceDeposit => ({ x, y: 50, amount: 0.02, ingredientId: id });
  const pizzaOf = (deposits: SauceDeposit[]) => ({ sauceIds: ["tomato-sauce", "pesto"], sauceDeposits: deposits });
  const base = [dep(10, "tomato-sauce"), dep(20, "pesto"), dep(30, "tomato-sauce")];

  it("is equal in value with and without the previous runs", () => {
    const first = sauceRunsOf(pizzaOf(base));
    const next = [...base, dep(40, "pesto"), dep(41, "pesto")];
    expect(sauceRunsOf(pizzaOf(next), first)).toEqual(sauceRunsOf(pizzaOf(next)));
  });

  it("a new run reuses every earlier run object", () => {
    const first = sauceRunsOf(pizzaOf(base));
    const second = sauceRunsOf(pizzaOf([...base, dep(40, "pesto")]), first);
    expect(second).toHaveLength(4);
    first.forEach((run, i) => expect(second[i]).toBe(run));
  });

  it("extending the top run rebuilds only that run, and its under list stays the same array", () => {
    const first = sauceRunsOf(pizzaOf(base));
    const second = sauceRunsOf(pizzaOf([...base, dep(31, "tomato-sauce")]), first);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(second[2]).not.toBe(first[2]);
    expect(second[2].deposits).toHaveLength(2);
    expect(second[2].under).toBe(first[2].under);
  });

  it("a log that shrank (undo) keeps the surviving runs and drops the rest", () => {
    const first = sauceRunsOf(pizzaOf(base));
    const second = sauceRunsOf(pizzaOf(base.slice(0, 2)), first);
    expect(second).toHaveLength(2);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it("restamped deposits (new objects) rebuild every run, with correct under lists", () => {
    const first = sauceRunsOf(pizzaOf(base));
    const restamped = base.map((d) => ({ ...d }));
    const second = sauceRunsOf(pizzaOf(restamped), first);
    expect(second[0]).not.toBe(first[0]);
    expect(second[2].under).toEqual(restamped.slice(0, 2));
  });

  it("a changed earlier run makes every later run rebuild its under list", () => {
    const first = sauceRunsOf(pizzaOf(base));
    const changed = [dep(11, "tomato-sauce"), base[1], base[2]];
    const second = sauceRunsOf(pizzaOf(changed), first);
    expect(second[1]).not.toBe(first[1]);
    expect(second[2].under).toEqual([changed[0], base[1]]);
  });
});
