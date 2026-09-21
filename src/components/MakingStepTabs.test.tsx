import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MakingStepTabs } from "./MakingStepTabs";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { preBakeSteps } from "../data/cookingProfiles";

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
        steps={preBakeSteps(state.cookingProfile)}
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
    fireEvent.click(screen.getByRole("tab", { name: "具材" }));
    expect(screen.getByTestId("making-step").textContent).toBe("TOPPING");
  });

  it("test 5: a future step (more than one ahead) can never be jumped to -- its tab is disabled and inert", () => {
    render(<Harness makingStep="DOUGH" />);
    const cheeseTab = screen.getByRole("tab", { name: "チーズ" });
    const toppingTab = screen.getByRole("tab", { name: "具材" });
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
    const toppingTab = screen.getByRole("tab", { name: "具材" });
    expect(toppingTab).toBeDisabled();
    fireEvent.click(toppingTab);
    expect(screen.getByTestId("making-step").textContent).toBe("TOPPING");
  });

  it("default: renders exactly 4 tabs (the DEFAULT_COOKING_PROFILE sequence), not the widened MakingStep union", () => {
    render(<Harness makingStep="DOUGH" />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });
});

/**
 * Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §9): this
 * component now takes its sequence from the caller (`steps`) instead of owning a fixed array --
 * these tests pin that a longer, future sequence renders correctly, and that steps outside the
 * `steps` prop entirely (an "inactive" future step no round today ever includes) are simply never
 * rendered, not merely disabled. No production `CookingProfile` produces this `steps` value --
 * it is a fixture passed directly to the component, independent of the reducer.
 */
describe("MakingStepTabs with a future-fixture sequence (Recipe Cooking Steps 1.0 Phase 1A)", () => {
  it("renders every step in a longer future sequence (DOUGH/SAUCE/CHEESE/TOPPING/FOLD/SEAL), not just the default 4", () => {
    render(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]}
        currentStep="FOLD"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.getByRole("tab", { name: "折りたたみ" })).toHaveAttribute("aria-selected", "true");
    const sealTab = screen.getByRole("tab", { name: "とじる" });
    expect(sealTab).toHaveAttribute("aria-selected", "false");
    expect(sealTab).not.toBeDisabled(); // immediate next, nextReady=true
  });

  it("a step absent from the steps prop is not rendered at all, not merely disabled (e.g. CUT/FINISH/EDGE_FILL when only FOLD/SEAL are active)", () => {
    render(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]}
        currentStep="DOUGH"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(screen.queryByRole("tab", { name: "カット" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "仕上げ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "ふちづめ" })).not.toBeInTheDocument();
  });

  it("the BAKE indicator's ready state tracks the sequence's own last step, not a hardcoded TOPPING", () => {
    const { rerender } = render(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]}
        currentStep="TOPPING"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText(/焼く/).className).not.toContain("making-step-tab--bake-ready");

    rerender(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]}
        currentStep="SEAL"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText(/焼く/).className).toContain("making-step-tab--bake-ready");
  });
});

/**
 * Issue #159 P0 (Cooking UI 1-Screen Polish, bullet 4): a real-device Fresh Audit (2026-09-21)
 * found the strip only ever rendered during PREPARE, so a cut-target recipe's own CUT step
 * never appeared in this nav at all -- the step sequence a player saw was inconsistent
 * depending on where they were in the round. `postSteps`/`currentPhase` let GameScreen mount
 * this same strip during BAKE and POST_BAKE too (see GameScreen.tsx), so the full
 * 生地→ソース→チーズ→具材→焼く→切る sequence stays visible end to end for a cut-target recipe.
 */
describe("MakingStepTabs postSteps/currentPhase (Issue #159 P0)", () => {
  const PRE_STEPS = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] as const;

  it("PREPARE: postSteps render as locked (not completed, not active) alongside the current pre-BAKE step", () => {
    render(
      <MakingStepTabs
        steps={PRE_STEPS}
        postSteps={["CUT"]}
        currentStep="SAUCE"
        currentPhase="PREPARE"
        nextReady
        onAdvance={() => {}}
      />,
    );
    const cutTab = screen.getByRole("tab", { name: "カット" });
    expect(cutTab).toBeDisabled();
    expect(cutTab.className).toContain("making-step-tab--locked");
    expect(cutTab.className).not.toContain("making-step-tab--completed");
  });

  it("BAKE: every pre-BAKE step reads completed, the BAKE indicator reads active, CUT stays locked", () => {
    render(
      <MakingStepTabs
        steps={PRE_STEPS}
        postSteps={["CUT"]}
        currentStep="TOPPING"
        currentPhase="BAKE"
        nextReady
        onAdvance={() => {}}
      />,
    );
    for (const label of ["生地", "ソース", "チーズ", "具材"]) {
      const tab = screen.getByRole("tab", { name: new RegExp(`✓ ${label}`) });
      expect(tab).toBeDisabled();
      expect(tab.className).toContain("making-step-tab--completed");
    }
    expect(screen.getByText(/焼く/).className).toContain("making-step-tab--bake-active");
    const cutTab = screen.getByRole("tab", { name: "カット" });
    expect(cutTab).toBeDisabled();
    expect(cutTab.className).toContain("making-step-tab--locked");
  });

  it("POST_BAKE: pre-BAKE steps and BAKE both read completed, CUT (the only postStep) reads active", () => {
    render(
      <MakingStepTabs
        steps={PRE_STEPS}
        postSteps={["CUT"]}
        currentStep="CUT"
        currentPhase="POST_BAKE"
        nextReady
        onAdvance={() => {}}
      />,
    );
    for (const label of ["生地", "ソース", "チーズ", "具材"]) {
      expect(screen.getByRole("tab", { name: new RegExp(`✓ ${label}`) })).toBeInTheDocument();
    }
    expect(screen.getByText(/焼く/).className).toContain("making-step-tab--completed");
    const cutTab = screen.getByRole("tab", { name: "カット" });
    expect(cutTab).toHaveAttribute("aria-selected", "true");
    expect(cutTab.className).toContain("making-step-tab--active");
    expect(cutTab).toBeDisabled(); // CUT's own confirm is the dedicated 切り終わる CTA, not this tab
  });

  it("a recipe with no postSteps (every recipe but margherita) renders no CUT tab at any phase", () => {
    for (const currentPhase of ["PREPARE", "BAKE"] as const) {
      cleanup();
      render(
        <MakingStepTabs
          steps={PRE_STEPS}
          postSteps={[]}
          currentStep="TOPPING"
          currentPhase={currentPhase}
          nextReady
          onAdvance={() => {}}
        />,
      );
      expect(screen.queryByRole("tab", { name: "カット" })).not.toBeInTheDocument();
    }
  });

  it("defaults (no currentPhase/postSteps passed) behave exactly like the pre-#159 PREPARE-only strip", () => {
    render(
      <MakingStepTabs steps={PRE_STEPS} currentStep="DOUGH" nextReady onAdvance={() => {}} />,
    );
    expect(screen.queryByRole("tab", { name: "カット" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });
});
