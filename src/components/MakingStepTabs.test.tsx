import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MakingStepTabs } from "./MakingStepTabs";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";

/**
 * Issue #86 (UX-2): coverage for the making-step tab strip -- the reducer's own one-way
 * `CONFIRM_MAKING_STEP` gate (pinned separately in src/state/onewayFlow.test.ts) is the actual
 * enforcement; this file only pins that the tab UI reflects it and can never bypass it (no
 * multi-step jump, no dispatch but `onAdvance`, BAKE never interactive). See
 * MakingStepTabs.tsx's own header comment for the full SSOT contract.
 */

function Harness({ makingStep, nextReady = true }: { makingStep: MakingStep; nextReady?: boolean }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    let initial = gameReducer(createInitialGameState(undefined, STARTER_INGREDIENT_IDS), {
      type: "BEGIN_PREPARE",
    });
    while (initial.makingStep !== makingStep) {
      initial = gameReducer(initial, { type: "CONFIRM_MAKING_STEP" });
    }
    return initial;
  });

  return (
    <div>
      <span data-testid="making-step">{state.makingStep}</span>
      <MakingStepTabs
        currentStep={state.makingStep}
        nextReady={nextReady}
        onAdvance={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
      />
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("MakingStepTabs (Issue #86 UX-2)", () => {
  it("test 1: DOUGH is active on a fresh PREPARE round", () => {
    render(<Harness makingStep="DOUGH" />);
    const doughTab = screen.getByRole("tab", { name: "生地" });
    expect(doughTab).toHaveAttribute("aria-selected", "true");
    expect(doughTab.className).toContain("making-step-tab--active");
  });

  it("test 2: tapping the next (SAUCE) tab from DOUGH advances makingStep to SAUCE", () => {
    render(<Harness makingStep="DOUGH" nextReady />);
    fireEvent.click(screen.getByRole("tab", { name: "ソース" }));
    expect(screen.getByTestId("making-step").textContent).toBe("SAUCE");
  });

  it("DOUGH's next (SAUCE) tab is disabled while nextReady is false (mirrors doughShapeComplete gate)", () => {
    render(<Harness makingStep="DOUGH" nextReady={false} />);
    const sauceTab = screen.getByRole("tab", { name: "ソース" });
    expect(sauceTab).toBeDisabled();
    fireEvent.click(sauceTab);
    expect(screen.getByTestId("making-step").textContent).toBe("DOUGH");
  });

  it("test 3: tapping the next (CHEESE) tab from SAUCE advances makingStep to CHEESE", () => {
    render(<Harness makingStep="SAUCE" />);
    fireEvent.click(screen.getByRole("tab", { name: "チーズ" }));
    expect(screen.getByTestId("making-step").textContent).toBe("CHEESE");
  });

  it("test 4: tapping the next (TOPPING) tab from CHEESE advances makingStep to TOPPING", () => {
    render(<Harness makingStep="CHEESE" />);
    fireEvent.click(screen.getByRole("tab", { name: "トッピング" }));
    expect(screen.getByTestId("making-step").textContent).toBe("TOPPING");
  });

  it("test 5: a future step (more than one ahead) can never be jumped to -- its tab is disabled and inert", () => {
    render(<Harness makingStep="DOUGH" />);
    const cheeseTab = screen.getByRole("tab", { name: "チーズ" });
    const toppingTab = screen.getByRole("tab", { name: "トッピング" });
    expect(cheeseTab).toBeDisabled();
    expect(toppingTab).toBeDisabled();
    fireEvent.click(cheeseTab);
    fireEvent.click(toppingTab);
    expect(screen.getByTestId("making-step").textContent).toBe("DOUGH");
  });

  it("test 6: validation-unmet next step cannot be jumped to (DOUGH -> SAUCE while nextReady is false)", () => {
    render(<Harness makingStep="DOUGH" nextReady={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "ソース" }));
    expect(screen.getByTestId("making-step").textContent).toBe("DOUGH");
  });

  it("test 7: a completed step renders with a checkmark and is disabled/non-interactive", () => {
    render(<Harness makingStep="CHEESE" />);
    const sauceTab = screen.getByRole("tab", { name: /✓ ソース/ });
    expect(sauceTab).toBeInTheDocument();
    expect(sauceTab).toBeDisabled();
    expect(sauceTab.className).toContain("making-step-tab--completed");
    fireEvent.click(sauceTab);
    expect(screen.getByTestId("making-step").textContent).toBe("CHEESE");
  });

  it("test 8: the active step's own tab is visually distinct and non-interactive (tapping it never re-dispatches)", () => {
    render(<Harness makingStep="CHEESE" />);
    const cheeseTab = screen.getByRole("tab", { name: "チーズ" });
    expect(cheeseTab.className).toContain("making-step-tab--active");
    expect(cheeseTab).toBeDisabled();
    fireEvent.click(cheeseTab);
    expect(screen.getByTestId("making-step").textContent).toBe("CHEESE");
  });

  it("keyboard cannot reactivate a locked/completed tab: a disabled button is not focusable", () => {
    render(<Harness makingStep="CHEESE" />);
    const sauceTab = screen.getByRole("tab", { name: /✓ ソース/ }) as HTMLButtonElement;
    expect(sauceTab.disabled).toBe(true);
    sauceTab.focus();
    expect(document.activeElement).not.toBe(sauceTab);
  });

  it("DOUGH has its own real tab (Issue #86 extends the strip beyond the old SAUCE/CHEESE/TOPPING-only set)", () => {
    render(<Harness makingStep="DOUGH" />);
    expect(screen.getByRole("tab", { name: "生地" })).toBeInTheDocument();
  });

  it("BAKE renders as a permanently non-interactive indicator, never a tab/button, even once TOPPING is current", () => {
    render(<Harness makingStep="TOPPING" />);
    expect(screen.queryByRole("tab", { name: /焼く/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /焼く/ })).not.toBeInTheDocument();
    expect(screen.getByText(/焼く/)).toBeInTheDocument();
  });

  it("only the immediate next tab ever fires onAdvance -- TOPPING's own tab stays inert (START_BAKE is a separate action)", () => {
    render(<Harness makingStep="TOPPING" />);
    const toppingTab = screen.getByRole("tab", { name: "トッピング" });
    expect(toppingTab).toBeDisabled();
    fireEvent.click(toppingTab);
    expect(screen.getByTestId("making-step").textContent).toBe("TOPPING");
  });
});
