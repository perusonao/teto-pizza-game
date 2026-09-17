import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { STARTER_INGREDIENT_IDS, type IngredientCategory } from "../data/ingredients";

/**
 * Issue #32 Phase 2: UI-level coverage for the making flow's one-way tab lock (the reducer's
 * own `makingStep` gate, pinned separately in src/state/onewayFlow.test.ts, is the actual
 * enforcement -- this file only pins that the tab UI reflects and cannot bypass it).
 */

const MAKING_STEP_TO_CATEGORY: Record<MakingStep, IngredientCategory> = {
  SAUCE: "sauce",
  CHEESE: "cheese",
  TOPPING: "topping",
};

function Harness({ makingStep }: { makingStep: MakingStep }) {
  const [state] = useReducer(gameReducer, undefined, () => {
    let initial = gameReducer(createInitialGameState(undefined, STARTER_INGREDIENT_IDS), {
      type: "BEGIN_PREPARE",
    });
    while (initial.makingStep !== makingStep) {
      initial = gameReducer(initial, { type: "CONFIRM_MAKING_STEP" });
    }
    return initial;
  });

  return (
    <IngredientTray
      activeCategory={MAKING_STEP_TO_CATEGORY[state.makingStep]}
      onChangeCategory={(category) => {
        // Mirrors App.tsx's own now-inert handleChangeCategory: a category tab click can
        // never drive state, only the reducer's own CONFIRM_MAKING_STEP can.
        void category;
      }}
      selectedIngredientId={null}
      onSelectIngredient={() => {}}
      ownedIngredientIds={state.ownedIngredientIds}
      resetToken={0}
      makingStepToken={state.makingStepToken}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("IngredientTray step lock (Issue #32 Phase 2)", () => {
  it("only the current step's tab is enabled while at SAUCE", () => {
    render(<Harness makingStep="SAUCE" />);
    expect(screen.getByRole("button", { name: "ソース" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /チーズ/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /トッピング/ })).toBeDisabled();
  });

  it("a completed step (SAUCE) reads as done, not as a mysterious broken tab", () => {
    render(<Harness makingStep="CHEESE" />);
    const sauceTab = screen.getByRole("button", { name: /✓ ソース/ });
    expect(sauceTab).toBeInTheDocument();
    expect(sauceTab).toBeDisabled();
    expect(sauceTab.className).toContain("category-tab--completed");
  });

  it("the current step (CHEESE) is the only enabled tab once SAUCE is confirmed", () => {
    render(<Harness makingStep="CHEESE" />);
    expect(screen.getByRole("button", { name: "チーズ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /トッピング/ })).toBeDisabled();
  });

  it("both prior steps read as completed and TOPPING is the only enabled tab", () => {
    render(<Harness makingStep="TOPPING" />);
    expect(screen.getByRole("button", { name: /✓ ソース/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /✓ チーズ/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "トッピング" })).toBeEnabled();
  });

  it("clicking a locked (completed) tab never fires onChangeCategory -- disabled buttons don't dispatch click", () => {
    let changeCalls = 0;
    function CountingHarness() {
      const [state] = useReducer(gameReducer, undefined, () => {
        let initial = gameReducer(createInitialGameState(undefined, STARTER_INGREDIENT_IDS), {
          type: "BEGIN_PREPARE",
        });
        return gameReducer(initial, { type: "CONFIRM_MAKING_STEP" }); // -> CHEESE
      });
      return (
        <IngredientTray
          activeCategory={MAKING_STEP_TO_CATEGORY[state.makingStep]}
          onChangeCategory={() => {
            changeCalls += 1;
          }}
          selectedIngredientId={null}
          onSelectIngredient={() => {}}
          ownedIngredientIds={state.ownedIngredientIds}
          resetToken={0}
          makingStepToken={state.makingStepToken}
        />
      );
    }
    render(<CountingHarness />);
    fireEvent.click(screen.getByRole("button", { name: /✓ ソース/ }));
    expect(changeCalls).toBe(0);
  });

  it("keyboard cannot reactivate a locked tab: a disabled button is not focusable/actionable", () => {
    render(<Harness makingStep="CHEESE" />);
    const sauceTab = screen.getByRole("button", { name: /✓ ソース/ }) as HTMLButtonElement;
    // Native `disabled` removes the element from the tab order and suppresses both click and
    // keydown-triggered activation -- this is the actual browser guarantee the UI relies on
    // (the reducer's own makingStep gate, pinned in onewayFlow.test.ts, is the final backstop
    // either way, so this only needs to confirm the element itself cannot be activated).
    expect(sauceTab.disabled).toBe(true);
    expect(sauceTab.tabIndex).toBeLessThanOrEqual(0);
    sauceTab.focus();
    expect(document.activeElement).not.toBe(sauceTab);
  });
});
