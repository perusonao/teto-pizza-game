import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { createInitialGameState, gameReducer } from "../state/gameReducer";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { getIngredient, type Ingredient, type IngredientCategory } from "../data/ingredients";

/**
 * Independent Review P2 (PR #26, discussion_r4012637679): a second pointer dispatching
 * RESET_PIZZA (the "やり直す" button) mid-drag left the first pointer's physical-drag session
 * alive in IngredientTray, because RESET_PIZZA only ever touched `state.pizza` -- none of
 * `physicalDragEnabled`/`selectedIngredientId`/`activeCategory` (the three signals
 * IngredientTray already aborted a session on) moved. Releasing the stale pointer afterward
 * then committed a PLACE_TOPPING onto the freshly emptied pizza.
 *
 * This harness wires IngredientTray to the real reducer (never a mock of PLACE_TOPPING/
 * RESET_PIZZA), and mirrors GameScreen.tsx's actual fix: `resetToken` bumps in the same click
 * handler that dispatches RESET_PIZZA, so the harness's "やり直す" button below is doing exactly
 * what GameScreen's does.
 */

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300 } as DOMRect;
/** Center of DOUGH_RECT in dough-percent terms -- always a valid, well-inside-the-rim drop. */
const INSIDE_CLIENT = { x: 150, y: 150 };
/** Far outside DOUGH_RECT's bounds -- resolvePieceDrop rejects it (clear miss). */
const OUTSIDE_CLIENT = { x: 900, y: 900 };

function Harness({ category }: { category: IngredientCategory }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" }),
  );
  const [resetToken, setResetToken] = useState(0);

  function resolvePhysicalDrop(clientX: number, clientY: number) {
    return resolvePieceDrop(clientX, clientY, DOUGH_RECT);
  }

  function handlePhysicalDrop(ingredient: Ingredient, point: { x: number; y: number }) {
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }

  // Mirrors GameScreen.tsx's handleResetPizza exactly: bump the token, then dispatch
  // RESET_PIZZA, in the same synchronous click handler "やり直す" is wired to.
  function handleResetPizza() {
    setResetToken((token) => token + 1);
    dispatch({ type: "RESET_PIZZA" });
  }

  return (
    <div>
      <button type="button" onClick={handleResetPizza}>
        やり直す
      </button>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <IngredientTray
        activeCategory={category}
        onChangeCategory={() => {}}
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={state.ownedIngredientIds}
        physicalDragEnabled
        draggableIngredientIds={["mozzarella", "basil"]}
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={handlePhysicalDrop}
        resetToken={resetToken}
      />
    </div>
  );
}

function toppingCount(): number {
  return Number(screen.getByTestId("topping-count").textContent);
}

function findChip(ingredientId: string): HTMLElement {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) throw new Error(`Unknown ingredient fixture: ${ingredientId}`);
  return screen.getByRole("button", { name: new RegExp(ingredient.nameJa) });
}

/** Starts a physical-drag session on `chip` and drags it far enough to satisfy
 *  hasPieceDragIntent (mouse: any direction, PIECE_DRAG_THRESHOLD_PX = 6). */
function startDrag(chip: HTMLElement, pointerId: number) {
  fireEvent.pointerDown(chip, {
    pointerId,
    isPrimary: true,
    pointerType: "mouse",
    clientX: 20,
    clientY: 20,
  });
  fireEvent.pointerMove(chip, { pointerId, clientX: 40, clientY: 20 });
}

afterEach(() => {
  cleanup();
});

describe("IngredientTray physical drag survives RESET_PIZZA (Independent Review P2)", () => {
  it("Mozzarella: a stale pointerup after RESET_PIZZA mid-drag places nothing", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    expect(toppingCount()).toBe(0);

    // Second pointer taps "やり直す" while the first pointer is still down mid-drag.
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    expect(toppingCount()).toBe(0);

    // The first pointer now lifts, over a perfectly valid drop point -- pre-fix this committed
    // PLACE_TOPPING onto the just-reset pizza.
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });
    expect(toppingCount()).toBe(0);
  });

  it("Basil: the same reset-mid-drag race is closed through the same code path", () => {
    render(<Harness category="topping" />);
    const chip = findChip("basil");

    startDrag(chip, 1);
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("a drag that finishes before any reset still places normally (fix doesn't over-cancel)", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(1);
  });

  it("a reset with no active drag session is a harmless no-op", () => {
    render(<Harness category="cheese" />);
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    expect(toppingCount()).toBe(0);

    const chip = findChip("mozzarella");
    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });
    expect(toppingCount()).toBe(1);
  });
});

describe("IngredientTray existing physical-drag safety nets (re-verified after the P2 fix)", () => {
  it("outside-drop: releasing off the dough places nothing, pizza count unchanged", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: OUTSIDE_CLIENT.x, clientY: OUTSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("pointercancel discards the session -- a later stale pointerup places nothing", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerCancel(chip, { pointerId: 1 });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("lostpointercapture discards the session -- a later stale pointerup places nothing", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.lostPointerCapture(chip, { pointerId: 1 });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("window blur discards the session -- a later stale pointerup places nothing", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent(window, new Event("blur"));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("document hidden (visibilitychange) discards the session -- a later stale pointerup places nothing", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("multi-touch: a second pointer cannot hijack or duplicate the first pointer's session", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    // A second finger touches down on the same chip mid-drag -- must be ignored entirely
    // (isPrimary: false, and a session is already active).
    fireEvent.pointerDown(chip, {
      pointerId: 2,
      isPrimary: false,
      pointerType: "touch",
      clientX: 60,
      clientY: 60,
    });
    fireEvent.pointerMove(chip, { pointerId: 2, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(chip, { pointerId: 2, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });
    // The second pointer's release must not have placed anything -- the original session
    // (pointerId 1) is still the only one tracked.
    expect(toppingCount()).toBe(0);

    // The original pointer finishes normally afterward.
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });
    expect(toppingCount()).toBe(1);
  });
});
