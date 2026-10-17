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
 * Issue #489 B3: the gauge reads the B1 ledger's headroom for the ACTIVE sauce kind (own 100% + pizza-wide cap), the same
 * number the dispenser caps on. A press (pointerdown) deposits one starter tick of min(0.02, headroom) at once, so the cap
 * is observable without a running clock.
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
      <span data-testid="canonical-kinds">{state.pizza.sauceIds.join(",")}</span>
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
const kinds = () => screen.getByTestId("canonical-kinds").textContent;
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

describe("PizzaStage per-kind sauce gauge (gauge and dispenser cap share the ledger headroom)", () => {
  it("single sauce: unchanged one-bottle gauge", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.5} />);
    expect(gauge()).toBe(50);
    press();
    expect(total()).toBe("0.52");
    expect(gauge()).toBe(48);
  });

  it("switching to a fresh sauce shows ITS own full bottle (history is kept, B1)", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.5} />);
    fireEvent.click(screen.getByText("use-pesto"));
    expect(gauge()).toBe(100);
    press();
    expect(kinds()).toBe("tomato-sauce,pesto");
    expect(total()).toBe("0.52"); // the history keeps tomato's 0.5 + pesto's 0.02
    expect(gauge()).toBe(98);
  });

  it("switching back shows the first sauce's remaining bottle, not a refill", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0.5} />);
    fireEvent.click(screen.getByText("use-pesto"));
    press();
    fireEvent.click(screen.getByText("use-tomato"));
    expect(gauge()).toBe(50);
    press();
    expect(gauge()).toBe(48);
  });

  it("a drained sauce stays drained for its own kind, while the other kind still has its bottle", () => {
    render(<Harness sauceId="tomato-sauce" consumed={1} />);
    expect(gauge()).toBe(0);
    press(); // nothing comes out
    expect(total()).toBe("1.00");
    fireEvent.click(screen.getByText("use-pesto"));
    expect(gauge()).toBe(100);
    press();
    expect(kinds()).toBe("tomato-sauce,pesto");
    expect(gauge()).toBe(98);
  });

  it("a fresh pizza starts full", () => {
    render(<Harness sauceId="tomato-sauce" consumed={0} />);
    expect(gauge()).toBe(100);
    press();
    expect(gauge()).toBe(98);
  });
});
