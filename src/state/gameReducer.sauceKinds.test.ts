import { describe, expect, it } from "vitest";
import { getRecipe } from "../data/recipes";
import { SAUCE_MAX_QUANTITY } from "../logic/sauceQuantity";
import { gameReducer, type GameState } from "./gameReducer";
import { consumePizzaInventory } from "./inventory";
import { isMultiSauce, sauceUsedByKind, sauceUsedTotal } from "./sauceLedger";
import { commit, finishedPizza, GENEROUS_INVENTORY, ringBatch, run, sauceStepState } from "./testSupport/sauceKindFixtures";

const margherita = getRecipe("margherita")!;
const start = (inventory?: Record<string, number>): GameState => sauceStepState(margherita, inventory);
const strokes = (n: number, amount = 0.02) => ringBatch(50, 50, 20, n, amount);

describe("COMMIT_SAUCE_DISPENSE: the sauce history is kept across a switch", () => {
  it("a switch appends: both kinds are in sauceIds (first-use order) and every deposit is stamped", () => {
    const s = run(start(), [commit("tomato-sauce", strokes(10)), commit("pesto", strokes(5))]);
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce", "pesto"]);
    expect(s.pizza.sauceDeposits).toHaveLength(15);
    expect(s.pizza.sauceDeposits.slice(0, 10).every((d) => d.ingredientId === "tomato-sauce")).toBe(true);
    expect(s.pizza.sauceDeposits.slice(10).every((d) => d.ingredientId === "pesto")).toBe(true);
  });

  it("switching back keeps one entry per kind and keeps stamping", () => {
    const s = run(start(), [
      commit("tomato-sauce", strokes(4)),
      commit("pesto", strokes(4)),
      commit("tomato-sauce", strokes(4)),
    ]);
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce", "pesto"]);
    expect(Object.keys(sauceUsedByKind(s.pizza)).sort()).toEqual(["pesto", "tomato-sauce"]);
    expect(sauceUsedByKind(s.pizza)["tomato-sauce"]).toBeCloseTo(0.16, 12);
  });

  it("one kind keeps the historical shape: no stamp anywhere, even over many strokes", () => {
    const s = run(start(), [commit("tomato-sauce", strokes(10)), commit("tomato-sauce", strokes(10))]);
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(s.pizza.sauceDeposits.every((d) => !("ingredientId" in d))).toBe(true);
  });

  it("the spread token / origin follow the ACTIVE sauce: they change on a switch and on switching back, not on the same sauce", () => {
    let s = run(start(), [commit("tomato-sauce", strokes(3))]);
    const t1 = s.pizza.sauceToken;
    s = run(s, [commit("tomato-sauce", strokes(3))]);
    expect(s.pizza.sauceToken).toBe(t1);
    s = run(s, [commit("pesto", ringBatch(30, 30, 1, 2))]);
    expect(s.pizza.sauceToken).toBe(t1 + 1);
    expect(s.pizza.sauceOrigin).toEqual({ x: ringBatch(30, 30, 1, 2)[0].x, y: ringBatch(30, 30, 1, 2)[0].y });
    s = run(s, [commit("tomato-sauce", strokes(2))]);
    expect(s.pizza.sauceToken).toBe(t1 + 2);
  });

  it("a rejected commit changes nothing (invalid batch, not owned, wrong step)", () => {
    const base = run(start(), [commit("tomato-sauce", strokes(3))]);
    expect(gameReducer(base, commit("pesto", [{ x: 50, y: 50, amount: 0 }]))).toBe(base);
    expect(gameReducer(base, commit("pesto", []))).toBe(base);
    expect(gameReducer({ ...base, ownedIngredientIds: ["tomato-sauce"] }, commit("pesto", strokes(2))).pizza).toBe(base.pizza);
    expect(gameReducer({ ...base, makingStep: "CHEESE" }, commit("pesto", strokes(2))).pizza).toBe(base.pizza);
  });

  it("APPLY_SAUCE (the legacy one-shot) still replaces everything with one sauce; RESET empties the pizza", () => {
    const multi = run(start(), [commit("tomato-sauce", strokes(3)), commit("pesto", strokes(3))]);
    const applied = gameReducer(multi, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 });
    expect(applied.pizza.sauceIds).toEqual(["pesto"]);
    expect(applied.pizza.sauceDeposits).toEqual([]);
    expect(gameReducer(multi, { type: "RESET_PIZZA" }).pizza.sauceDeposits).toEqual([]);
  });
});

describe("COMMIT_SAUCE_DISPENSE: stock gate and caps", () => {
  it("a NEW kind needs one unit of stock; a kind already on the pizza never re-checks", () => {
    const noPesto = { ...GENEROUS_INVENTORY, pesto: 0 };
    const s0 = start(noPesto);
    expect(gameReducer(s0, commit("pesto", strokes(2))).pizza.sauceIds).toEqual([]);
    const s1 = run(start({ ...GENEROUS_INVENTORY, pesto: 1 }), [commit("pesto", strokes(2)), commit("tomato-sauce", strokes(2))]);
    expect(s1.pizza.sauceIds).toEqual(["pesto", "tomato-sauce"]);
    expect(gameReducer(s1, commit("pesto", strokes(2))).pizza.sauceDeposits).toHaveLength(6); // back to pesto: allowed
  });

  it("with two kinds the per-kind 100% is enforced by the reducer (the whole batch is rejected)", () => {
    const s = run(start(), [commit("tomato-sauce", strokes(5)), commit("pesto", strokes(5))]);
    const over = gameReducer(s, commit("pesto", strokes(60))); // 0.1 + 1.2 > 1.0
    expect(over).toBe(s);
    const exact = gameReducer(s, commit("pesto", strokes(45))); // 0.1 + 0.9 = 1.0
    expect(exact.pizza.sauceDeposits).toHaveLength(55);
  });

  it("with two kinds the provisional pizza-wide cap is enforced by the reducer", () => {
    const s = run(start(), [commit("tomato-sauce", strokes(50)), commit("pesto", strokes(49))]); // 1.0 + 0.98
    expect(sauceUsedTotal(s.pizza)).toBeCloseTo(1.98, 9);
    expect(gameReducer(s, commit("olive-oil", strokes(2))).pizza.sauceIds).toEqual(["tomato-sauce", "pesto"]); // 1.98 + 0.04 > 2.0
    expect(gameReducer(s, commit("olive-oil", strokes(1))).pizza.sauceIds).toEqual(["tomato-sauce", "pesto", "olive-oil"]);
  });

  it("one kind is NOT validated for amount at the reducer (unchanged: its 100% is the dispenser's job)", () => {
    const s = run(start(), [commit("tomato-sauce", strokes(80))]); // 1.6 of one kind
    expect(sauceUsedTotal(s.pizza)).toBeCloseTo(1.6, 9);
    expect(1.6).toBeGreaterThan(SAUCE_MAX_QUANTITY);
  });
});

describe("inventory: one unit per sauce kind actually laid, consumed once at CONFIRM_BAKE", () => {
  const stock = { ...GENEROUS_INVENTORY, pesto: 3, "olive-oil": 3 };

  it("every kind on the pizza consumes ONE unit, however little it laid; tomato (unlimited) consumes none", () => {
    const s = run(start(stock), [commit("tomato-sauce", strokes(40)), commit("pesto", strokes(1)), commit("olive-oil", strokes(1))]);
    const after = consumePizzaInventory(s.pizza, s.inventory);
    expect(after.pesto).toBe(2);
    expect(after["olive-oil"]).toBe(2);
    expect(after).not.toHaveProperty("tomato-sauce"); // unlimited: never tracked, never consumed
  });

  it("a sauce laid and then switched away from is still consumed (the old free-switch loophole is closed)", () => {
    const s = run(start(stock), [commit("pesto", strokes(30)), commit("tomato-sauce", strokes(30))]);
    expect(consumePizzaInventory(s.pizza, s.inventory).pesto).toBe(2);
  });

  it("laying the same kind many times is still ONE unit", () => {
    const s = run(start(stock), [commit("pesto", strokes(5)), commit("tomato-sauce", strokes(5)), commit("pesto", strokes(5))]);
    expect(consumePizzaInventory(s.pizza, s.inventory).pesto).toBe(2);
  });

  it("a one-shot sauce followed by a painted sauce: both kinds are on the pizza and both consume one unit", () => {
    const s = run(start(stock), [{ type: "APPLY_SAUCE", ingredientId: "olive-oil", x: 50, y: 50 }, commit("pesto", strokes(10))]);
    expect(s.pizza.sauceIds).toEqual(["olive-oil", "pesto"]);
    expect(s.pizza.sauceDeposits.every((d) => d.ingredientId === "pesto")).toBe(true);
    const after = consumePizzaInventory(s.pizza, s.inventory);
    expect(after["olive-oil"]).toBe(2);
    expect(after.pesto).toBe(2);
  });

  it("a kind that laid nothing is not consumed (a cancelled / rejected stroke registers nothing)", () => {
    const s = run(start(stock), [commit("tomato-sauce", strokes(10)), commit("pesto", [{ x: 1, y: 1, amount: 0 }])]);
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(isMultiSauce(s.pizza)).toBe(false); // the empty stroke added no kind, so the pizza is still a one-sauce pizza
    expect(consumePizzaInventory(s.pizza, s.inventory).pesto).toBe(3);
  });

  it("never goes below zero", () => {
    const s = run(start({ ...stock, pesto: 1 }), [commit("pesto", strokes(2))]);
    expect(consumePizzaInventory(s.pizza, { ...s.inventory, pesto: 0 }).pesto).toBe(0);
  });

  it("CONFIRM_BAKE consumes exactly once: a second CONFIRM_BAKE does not consume again", () => {
    const s = run(start(stock), [commit("tomato-sauce", strokes(20)), commit("pesto", strokes(20))]);
    const baking: GameState = { ...s, phase: "BAKE", pizza: finishedPizza(margherita, s.pizza) };
    const once = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
    expect(once.inventory.pesto).toBe(2);
    const twice = gameReducer(once, { type: "CONFIRM_BAKE", value: 70 });
    expect(twice.inventory.pesto).toBe(2);
  });
});
