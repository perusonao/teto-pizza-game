import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { gameReducer, type GameState } from "../state/gameReducer";
import type { SauceDeposit } from "../state/pizzaState";
import { sauceUsedByKind, sauceUsedTotal } from "../state/sauceLedger";
import { GENEROUS_INVENTORY, sauceStepState } from "../state/testSupport/sauceKindFixtures";
import { PizzaStage } from "./PizzaStage";

/**
 * Sauce B1 (per-kind ledger): the dispenser's cap through the real PizzaStage. A press (pointerdown) lays one starter tick,
 * min(0.02, headroom), at once, so the cap is observable without a running clock. Headroom = min(kind's own 100%,
 * pizza-wide provisional 200%) from the shared ledger.
 */
const RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;
type Laid = Array<[kind: string, amount: number]>;

function stateWith(laid: Laid): GameState {
  const base = sauceStepState(getRecipe("margherita")!, GENEROUS_INVENTORY);
  const kinds = [...new Set(laid.map(([k]) => k))];
  const multi = kinds.length >= 2;
  const deposits: SauceDeposit[] = laid.map(([k, amount]) => (multi ? { x: 50, y: 50, amount, ingredientId: k } : { x: 50, y: 50, amount }));
  return { ...base, pizza: { ...base.pizza, sauceIds: kinds, sauceToken: kinds.length, sauceDeposits: deposits } };
}

function Harness({ laid, start }: { laid: Laid; start: string }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => stateWith(laid));
  const [active, setActive] = useState(start);
  const used = sauceUsedByKind(state.pizza);
  return (
    <div>
      {["tomato-sauce", "pesto", "olive-oil"].map((k) => (
        <button key={k} type="button" onClick={() => setActive(k)}>{`use-${k}`}</button>
      ))}
      <span data-testid="ids">{state.pizza.sauceIds.join(",")}</span>
      <span data-testid="total">{sauceUsedTotal(state.pizza).toFixed(2)}</span>
      {Object.entries(used).map(([k, v]) => (
        <span key={k} data-testid={`used-${k}`}>{v.toFixed(2)}</span>
      ))}
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={getIngredient(active)!}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled
        resetToken={0}
        makingStepToken={state.makingStepToken}
        makingStep={state.makingStep}
        showDoughShape
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={(ingredientId, deposits) => dispatch({ type: "COMMIT_SAUCE_DISPENSE", ingredientId, deposits })}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={state.cutState}
        onAddCutLine={() => {}}
      />
    </div>
  );
}

function press() {
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]')!;
  dough.getBoundingClientRect = () => RECT;
  const at = { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 };
  fireEvent.pointerDown(dough, at);
  fireEvent.pointerUp(dough, at);
}
const total = () => Number(screen.getByTestId("total").textContent);
const used = (k: string) => Number(screen.getByTestId(`used-${k}`).textContent);
const use = (k: string) => fireEvent.click(screen.getByText(`use-${k}`));

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PizzaStage dispenser cap: per kind 100% + pizza-wide provisional 200%", () => {
  it("normal painting: one sauce keeps adding to its own bottle", () => {
    render(<Harness laid={[["tomato-sauce", 0.5]]} start="tomato-sauce" />);
    press();
    expect(used("tomato-sauce")).toBeCloseTo(0.52, 9);
  });

  it("a fresh pizza starts full", () => {
    render(<Harness laid={[]} start="tomato-sauce" />);
    press();
    expect(total()).toBeCloseTo(0.02, 9);
  });

  it("a switched-to sauce has its OWN full bottle (no refill of the old one, no theft from the new one)", () => {
    render(<Harness laid={[["tomato-sauce", 0.99]]} start="tomato-sauce" />);
    use("pesto");
    press();
    expect(screen.getByTestId("ids").textContent).toBe("tomato-sauce,pesto");
    expect(used("pesto")).toBeCloseTo(0.02, 9); // a full tick: pesto is NOT capped by tomato's usage
    expect(used("tomato-sauce")).toBeCloseTo(0.99, 9); // history kept
  });

  it("the old sauce does not refill after a switch: back on it, only its own remainder is left", () => {
    render(<Harness laid={[["tomato-sauce", 0.99]]} start="tomato-sauce" />);
    use("pesto");
    press();
    use("tomato-sauce");
    press(); // 0.01 left of tomato
    expect(used("tomato-sauce")).toBeCloseTo(1, 9);
    press(); // nothing more: tomato's own 100% is spent
    expect(used("tomato-sauce")).toBeCloseTo(1, 9);
  });

  it("each kind is capped at 100% on its own: a spent kind dispenses nothing, another kind still can", () => {
    render(<Harness laid={[["tomato-sauce", 1]]} start="tomato-sauce" />);
    press();
    expect(total()).toBeCloseTo(1, 9);
    use("olive-oil");
    press();
    expect(used("olive-oil")).toBeCloseTo(0.02, 9);
  });

  it("the pizza-wide (provisional 200%) cap stops every kind, a fresh one included, and registers no new kind", () => {
    render(<Harness laid={[["tomato-sauce", 1], ["pesto", 1]]} start="pesto" />);
    expect(total()).toBeCloseTo(2, 9);
    press();
    use("olive-oil");
    press();
    expect(total()).toBeCloseTo(2, 9);
    expect(screen.getByTestId("ids").textContent).toBe("tomato-sauce,pesto"); // olive-oil laid nothing: not on the pizza, not consumed
  });

  it("the last bit under the pizza-wide cap is clamped, then nothing", () => {
    render(<Harness laid={[["tomato-sauce", 1], ["pesto", 0.99]]} start="pesto" />);
    press(); // pesto has 0.01 of its own AND 0.01 of total left
    expect(used("pesto")).toBeCloseTo(1, 9);
    press();
    expect(used("pesto")).toBeCloseTo(1, 9);
  });
});
