import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { resolvePieceDrop } from "../logic/pieceDrag";
import {
  getIngredient,
  ingredientsByCategory,
  MAX_INGREDIENT_PALETTE_SLOTS,
  STARTER_INGREDIENT_IDS,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";

/**
 * Human Feel Fix 2 (2nd iPhone retest): scrolling the Ingredient Tray and dragging a piece
 * onto the pizza were the same single-finger swipe, so every drag start doubled as a
 * candidate scroll the browser had to arbitrate -- read by hands-on retesting as "still
 * unresponsive" even after Fix 1's threshold/iOS-callout work. This file covers what Fix 2
 * actually changed: the Palette is now a non-scrolling, capped 3x2 grid
 * (`MAX_INGREDIENT_PALETTE_SLOTS`, src/data/ingredients.ts). It intentionally does not repeat
 * IngredientTray.physicalDragReset.test.tsx's own coverage (RESET-mid-drag, outside-drop,
 * pointercancel, lostpointercapture, blur, visibilitychange, multi-touch) -- that file is
 * re-run unmodified alongside this one and still exercises the same IngredientTray component.
 */

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300 } as DOMRect;
const INSIDE_CLIENT = { x: 150, y: 150 };

// Issue #32 Phase 2: PLACE_TOPPING is now gated on the reducer's own `makingStep` matching
// the placed ingredient's category (see gameReducer.ts) -- a Harness mounted to exercise a
// given category's physical drag must advance the making flow to that category's own step
// first, via CONFIRM_MAKING_STEP, exactly like a real player's "次へ" tap would.
const CATEGORY_TO_MAKING_STEP: Record<IngredientCategory, MakingStep> = {
  sauce: "SAUCE",
  cheese: "CHEESE",
  topping: "TOPPING",
};

function Harness({
  category,
  ownedIngredientIds = STARTER_INGREDIENT_IDS,
}: {
  category: IngredientCategory;
  ownedIngredientIds?: readonly string[];
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    let initial = gameReducer(createInitialGameState(undefined, ownedIngredientIds), {
      type: "BEGIN_PREPARE",
    });
    const targetStep = CATEGORY_TO_MAKING_STEP[category];
    while (initial.makingStep !== targetStep) {
      initial = gameReducer(initial, { type: "CONFIRM_MAKING_STEP" });
    }
    return initial;
  });
  const [resetToken, setResetToken] = useState(0);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);

  function resolvePhysicalDrop(clientX: number, clientY: number) {
    return resolvePieceDrop(clientX, clientY, DOUGH_RECT);
  }

  function handlePhysicalDrop(ingredient: Ingredient, point: { x: number; y: number }) {
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }

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
      <span data-testid="selected-id">{selectedIngredientId ?? ""}</span>
      <IngredientTray
        activeCategory={category}
        onChangeCategory={() => {}}
        selectedIngredientId={selectedIngredientId}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
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

function trayContainer(): HTMLElement {
  // The tray is the ingredient-tray grid, identified structurally as the container of the
  // rendered ingredient chips (each an accessible button with a name).
  return screen.getByRole("button", { name: /モッツァレラ|バジル|トマト/ }).closest(".ingredient-tray")!;
}

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

describe("Ingredient Palette: fixed 3x2 grid, no scroll (Human Feel Fix 2)", () => {
  it("renders every owned ingredient in a category that owns <=6, matching pre-fix behavior", () => {
    render(<Harness category="topping" />);
    const owned = ingredientsByCategory("topping").filter((i) =>
      STARTER_INGREDIENT_IDS.includes(i.id),
    );
    expect(owned.length).toBeLessThanOrEqual(MAX_INGREDIENT_PALETTE_SLOTS);
    for (const ingredient of owned) {
      expect(findChip(ingredient.id)).toBeInTheDocument();
    }
  });

  it("caps the Palette at MAX_INGREDIENT_PALETTE_SLOTS even when more are owned (never falls back to scroll)", () => {
    // Every topping ingredient owned, including the normally-locked `onion` -- 7 total,
    // one more than the grid's 6 slots.
    const allToppingIds = ingredientsByCategory("topping").map((i) => i.id);
    expect(allToppingIds.length).toBeGreaterThan(MAX_INGREDIENT_PALETTE_SLOTS);
    const owned = [...STARTER_INGREDIENT_IDS, ...allToppingIds];

    render(<Harness category="topping" ownedIngredientIds={owned} />);

    const chips = within(document.body).getAllByRole("button", {
      name: new RegExp(
        ingredientsByCategory("topping")
          .map((i) => i.nameJa)
          .join("|"),
      ),
    });
    expect(chips).toHaveLength(MAX_INGREDIENT_PALETTE_SLOTS);
  });

  it("the tray container has no horizontal-scroll marker (grid replaces the old scrolling row)", () => {
    render(<Harness category="cheese" />);
    const tray = trayContainer();
    expect(tray.className).not.toMatch(/scroll/i);
    // jsdom does not apply the stylesheet, so this only guards against an inline override
    // reintroducing scroll -- the real overflow-x:0 check is the 390x844 browser
    // verification in the Phase 4A-1B Human Feel Fix 2 result report.
    expect(tray.style.overflowX).toBe("");
  });

  it("physical drag onto the pizza still works from a capped Palette", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(1);
  });

  it("tap fallback (click, no drag) still selects an ingredient", () => {
    render(<Harness category="topping" />);
    const chip = findChip("basil");

    fireEvent.click(chip);

    expect(screen.getByTestId("selected-id").textContent).toBe("basil");
  });

  it("RESET_PIZZA mid-drag still discards a stale physical-drag session in the new grid", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("outside-drop safety net still holds in the new grid", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 900, clientY: 900 });

    expect(toppingCount()).toBe(0);
  });
});

describe("Purchased onion stays reachable via page nav (Independent Review P1, PR #26)", () => {
  const allToppingIds = ingredientsByCategory("topping").map((i) => i.id);
  const sevenOwnedTopping = [...STARTER_INGREDIENT_IDS, ...allToppingIds];

  it("with <=6 owned in a category, no page nav is rendered (unchanged from pre-fix)", () => {
    render(<Harness category="topping" />);
    expect(screen.queryByRole("group", { name: "素材ページ切り替え" })).not.toBeInTheDocument();
  });

  it("with exactly 6 owned in a category, no page nav is rendered", () => {
    // EP4: only `basil` remains Starter among toppings now (garlic/oregano/cherry-tomato/egg/
    // mushroom all gained their own `unlockCondition`) -- own every topping except `onion`
    // explicitly (as production's Starter Grants would have by this point) to keep exercising
    // this test's own boundary case: exactly MAX_INGREDIENT_PALETTE_SLOTS owned, right below the
    // P1 bug this suite is named for.
    const sixOwnedToppings = allToppingIds.filter((id) => id !== "onion");
    expect(sixOwnedToppings).toHaveLength(MAX_INGREDIENT_PALETTE_SLOTS);
    render(<Harness category="topping" ownedIngredientIds={[...STARTER_INGREDIENT_IDS, ...sixOwnedToppings]} />);
    expect(screen.queryByRole("group", { name: "素材ページ切り替え" })).not.toBeInTheDocument();
  });

  it("with 7 owned (onion owned), page 1 shows the original 6 and hides onion", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /たまねぎ/ })).not.toBeInTheDocument();
  });

  it("navigating to page 2 reveals onion, and it can be selected", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    const onionChip = screen.getByRole("button", { name: /たまねぎ/ });
    expect(onionChip).toBeInTheDocument();

    fireEvent.click(onionChip);
    expect(screen.getByTestId("selected-id").textContent).toBe("onion");
  });

  it("onion is not in draggableIngredientIds, so it selects via tap like every other non-physical topping", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    const onionChip = screen.getByRole("button", { name: /たまねぎ/ });

    expect(onionChip.className).not.toMatch(/ingredient-chip--physical/);
    fireEvent.click(onionChip);
    expect(screen.getByTestId("selected-id").textContent).toBe("onion");
  });

  it("the 前のページ button is disabled on page 1 and 次のページ disabled on the last page", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByRole("button", { name: "前のページ" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("switching category resets back to page 1", () => {
    const { rerender } = render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    rerender(<Harness category="cheese" ownedIngredientIds={sevenOwnedTopping} />);
    rerender(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("switching pages mid-drag aborts the stale session (no commit onto the new page)", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    const chip = findChip("basil");

    startDrag(chip, 1);
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("no regression: Mozzarella/Basil selection and physical drag on page 1 still work with 7 owned", () => {
    render(<Harness category="topping" ownedIngredientIds={sevenOwnedTopping} />);
    const chip = findChip("basil");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(1);
  });
});
