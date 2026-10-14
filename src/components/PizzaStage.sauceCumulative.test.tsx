import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { ORDERS } from "../data/orders";
import { getRecipe } from "../data/recipes";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { createEmptyPizza, type SauceDeposit } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";

/**
 * Issue #489 Phase 2 / Owner Decision on PR #494: sauce consumption is cumulative across sauce switches,
 * and the dispense cap and the remaining gauge read the SAME total. A press (pointerdown) deposits one
 * starter tick of min(0.02, what is left) at once, so the cap is observable without a running clock.
 */
const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const INVENTORY = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 999]));

function startState(sauceId: string, consumed: number): GameState {
  const base = createInitialGameState(undefined, ALL_IDS, 0, INVENTORY);
  const recipe = getRecipe("margherita")!;
  const order = ORDERS.find((o) => o.recipeId === "margherita")!;
  const deposits: SauceDeposit[] = consumed > 0 ? [{ x: 50, y: 50, amount: consumed }] : [];
  return {
    ...base,
    phase: "PREPARE",
    recipe,
    order,
    makingStep: "SAUCE",
    isMissionRound: false,
    pizza: { ...createEmptyPizza(), sauceIds: consumed > 0 ? [sauceId] : [], sauceToken: consumed > 0 ? 1 : 0, sauceDeposits: deposits },
  };
}

function Harness({ sauceId, consumed }: { sauceId: string; consumed: number }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => startState(sauceId, consumed));
  const [activeId, setActiveId] = useState(sauceId);
  const total = state.pizza.sauceDeposits.reduce((s, d) => s + d.amount, 0);
  return (
    <div>
      <button type="button" onClick={() => setActiveId("tomato-sauce")}>use-tomato</button>
      <button type="button" onClick={() => setActiveId("pesto")}>use-pesto</button>
      <span data-testid="canonical-sauce">{state.pizza.sauceIds[0] ?? "none"}</span>
      <span data-testid="canonical-total">{total.toFixed(2)}</span>
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={getIngredient(activeId)!}
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
  dough.getBoundingClientRect = () => DOUGH_RECT;
  const at = { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 };
  fireEvent.pointerDown(dough, at);
  fireEvent.pointerUp(dough, at);
}
const gauge = () => Number(screen.getByRole("meter", { name: "ソースの残り" }).getAttribute("aria-valuenow"));
const sauceId = () => screen.getByTestId("canonical-sauce").textContent;
const total = () => screen.getByTestId("canonical-total").textContent;

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

describe("PizzaStage cumulative sauce consumption (cap and gauge share one total)", () => {
  it("normal painting: the same sauce keeps adding to the same total", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.5} />);
    expect(gauge()).toBe(50);
    press();
    expect(total()).toBe("0.52");
    expect(gauge()).toBe(48);
  });

  it("switching mid-way does NOT refill: the old sauce's usage still counts", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.5} />);
    fireEvent.click(screen.getByText("use-pesto"));
    press();
    expect(sauceId()).toBe("pesto");
    expect(total()).toBe("0.02"); // canonical deposits hold only the new sauce
    expect(gauge()).toBe(48); // ...but the gauge (and the cap) still remember the 0.5 of tomato
    press();
    expect(gauge()).toBe(46);
  });

  it("switching back and forth keeps accumulating", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.5} />);
    fireEvent.click(screen.getByText("use-pesto"));
    press();
    fireEvent.click(screen.getByText("use-tomato"));
    press();
    expect(sauceId()).toBe("tomato-sauce");
    expect(gauge()).toBe(46); // 0.5 + 0.02 + 0.02
  });

  it("the cap counts the earlier sauce: only what is left can be dispensed after a switch", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.99} />);
    fireEvent.click(screen.getByText("use-pesto"));
    press(); // starter tick is clamped to the 0.01 left, not 0.02
    expect(sauceId()).toBe("pesto");
    expect(total()).toBe("0.01");
    expect(gauge()).toBe(0);
  });

  it("at 0% nothing more comes out, with the same sauce or after a switch", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.99} />);
    fireEvent.click(screen.getByText("use-pesto"));
    press();
    expect(gauge()).toBe(0);
    press(); // empty: no deposit, no commit
    expect(total()).toBe("0.01");
    fireEvent.click(screen.getByText("use-tomato")); // switching itself still works...
    press(); // ...but there is nothing left to dispense, and the sauce on the pizza is unchanged
    expect(total()).toBe("0.01");
    expect(sauceId()).toBe("pesto");
    expect(gauge()).toBe(0);
  });

  it("a full bottle (1.0) of one sauce blocks the other sauce as well", () => {
    render(<Harness sauceId="tomato-sauce" consumed={1} />);
    expect(gauge()).toBe(0);
    fireEvent.click(screen.getByText("use-pesto"));
    press();
    expect(total()).toBe("1.00");
    expect(sauceId()).toBe("tomato-sauce");
  });

  it("a fresh pizza starts full", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0} />);
    expect(gauge()).toBe(100);
    press();
    expect(gauge()).toBe(98);
  });
});
