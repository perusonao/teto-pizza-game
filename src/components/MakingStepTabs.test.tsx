import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MakingStepTabs } from "./MakingStepTabs";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { preBakeSteps, visibleCookingTabCount } from "../data/cookingProfiles";

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

/** The non-interactive BAKE indicator (CS-4a: its text now sits in an inner span, so query the tab itself). */
function bakeTab(): HTMLElement {
  return document.querySelector<HTMLElement>(".making-step-tab--bake")!;
}

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
    const sauceTab = screen.getByRole("tab", { name: "ソース" });
    expect(sauceTab).toHaveTextContent("✓ ソース");
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
    const sauceTab = screen.getByRole("tab", { name: "ソース" }) as HTMLButtonElement;
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

describe("Dynamic step derivation (Gameplay UX / Scoring 3.0 PR-A): renders exactly the `steps` it is given", () => {
  it("a marinara-shaped steps array (no CHEESE) renders 3 tabs, no empty CHEESE tab at all", () => {
    render(
      <MakingStepTabs steps={["DOUGH", "SAUCE", "TOPPING"]} currentStep="SAUCE" nextReady onAdvance={() => {}} />,
    );
    expect(screen.queryByRole("tab", { name: "チーズ" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /生地/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ソース" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "具材" })).toBeInTheDocument();
  });

  it("a quattro-formaggi-shaped steps array (no TOPPING) renders 3 tabs, no empty TOPPING tab at all", () => {
    render(
      <MakingStepTabs steps={["DOUGH", "SAUCE", "CHEESE"]} currentStep="CHEESE" nextReady onAdvance={() => {}} />,
    );
    expect(screen.queryByRole("tab", { name: "具材" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "チーズ" })).toBeInTheDocument();
  });

  it("tap navigation on a skipped-step strip still only ever fires onAdvance for the immediate next tab", () => {
    let advanced = false;
    render(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "TOPPING"]}
        currentStep="SAUCE"
        nextReady
        onAdvance={() => {
          advanced = true;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "具材" }));
    expect(advanced).toBe(true);
  });

  it("completed-step markers remain correct on a skipped-step strip (✓ prefix, disabled)", () => {
    render(
      <MakingStepTabs steps={["DOUGH", "SAUCE", "TOPPING"]} currentStep="TOPPING" nextReady onAdvance={() => {}} />,
    );
    const sauceTab = screen.getByRole("tab", { name: "ソース" });
    expect(sauceTab).toHaveTextContent("✓ ソース");
    expect(sauceTab.className).toContain("making-step-tab--completed");
    expect(sauceTab).toBeDisabled();
  });

  it("accessibility labels remain correct on a skipped-step strip (aria-selected/aria-current on the active tab)", () => {
    render(
      <MakingStepTabs steps={["DOUGH", "SAUCE", "TOPPING"]} currentStep="TOPPING" nextReady onAdvance={() => {}} />,
    );
    const toppingTab = screen.getByRole("tab", { name: "具材" });
    expect(toppingTab).toHaveAttribute("aria-selected", "true");
    expect(toppingTab).toHaveAttribute("aria-current", "step");
  });
});

describe("Bake tab emoji removal (Gameplay UX / Scoring 3.0 PR-A, Audit G)", () => {
  it("BAKE label is exactly '焼く' -- no 🔥, whether active or not", () => {
    render(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "TOPPING"]}
        currentStep="TOPPING"
        currentPhase="PREPARE"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText("焼く")).toBeInTheDocument();
    expect(screen.queryByText(/\u{1F525}/u)).not.toBeInTheDocument();
  });

  it("completed BAKE label is exactly '✓ 焼く' -- no 🔥", () => {
    render(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "TOPPING"]}
        currentStep="TOPPING"
        currentPhase="POST_BAKE"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(bakeTab()).toHaveTextContent(/^✓ 焼く$/);
    expect(bakeTab().textContent).not.toContain("🔥");
    expect(screen.queryByText(/\u{1F525}/u)).not.toBeInTheDocument();
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
    expect(bakeTab().className).not.toContain("making-step-tab--bake-ready");

    rerender(
      <MakingStepTabs
        steps={["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]}
        currentStep="SEAL"
        nextReady
        onAdvance={() => {}}
      />,
    );
    expect(bakeTab().className).toContain("making-step-tab--bake-ready");
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
      const tab = screen.getByRole("tab", { name: label });
      expect(tab).toHaveTextContent(`✓ ${label}`);
      expect(tab).toBeDisabled();
      expect(tab.className).toContain("making-step-tab--completed");
    }
    expect(bakeTab().className).toContain("making-step-tab--bake-active");
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
      expect(screen.getByRole("tab", { name: label })).toHaveTextContent(`✓ ${label}`);
    }
    expect(bakeTab().className).toContain("making-step-tab--completed");
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

/**
 * Cooking Steps 2.0 CS-4a (T3 compact chips): a 7-tab strip -- DOUGH / SAUCE / CHEESE / TOPPING +
 * 焼く + FINISH + CUT -- as a fixture only. No Production recipe has FINISH (Owner Decision: 7 tabs are
 * verified on fixtures; MAX_VISIBLE_COOKING_TABS stays 6, see cookingProfiles.tabGate.test.ts).
 */
describe("7-tab fixture strip (CS-4a)", () => {
  const PRE: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];
  const POST: MakingStep[] = ["FINISH", "CUT"];
  const FORMAL: Record<string, string> = {
    DOUGH: "生地",
    SAUCE: "ソース",
    CHEESE: "チーズ",
    TOPPING: "具材",
    FINISH: "仕上げ",
    CUT: "カット",
  };

  function renderStrip(currentStep: MakingStep, currentPhase: "PREPARE" | "BAKE" | "POST_BAKE", onAdvance = () => {}) {
    return render(
      <MakingStepTabs
        steps={PRE}
        postSteps={POST}
        currentStep={currentStep}
        currentPhase={currentPhase}
        nextReady
        onAdvance={onAdvance}
      />,
    );
  }

  it("renders 6 step tabs + the BAKE indicator, FINISH before CUT, with its own colour class", () => {
    renderStrip("DOUGH", "PREPARE");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["生地", "ソース", "チーズ", "具材", "仕上げ", "カット"]);
    expect(document.querySelectorAll(".making-step-tabs > *")).toHaveLength(7);
    expect(screen.getByRole("tab", { name: "仕上げ" }).className).toContain("making-step-tab--finish");
  });

  it("aria-label is the formal step name in every state (active / next / locked / completed)", () => {
    for (const [step, phase] of [
      ["DOUGH", "PREPARE"],
      ["CHEESE", "PREPARE"],
      ["FINISH", "POST_BAKE"],
    ] as const) {
      renderStrip(step, phase);
      for (const [id, name] of Object.entries(FORMAL)) {
        expect(screen.getByRole("tab", { name }), `${id} while ${phase}/${step}`).toBeInTheDocument();
      }
      cleanup();
    }
  });

  it("a completed tab is still announced as completed (aria-description), others are not", () => {
    renderStrip("TOPPING", "PREPARE");
    for (const name of ["生地", "ソース", "チーズ"]) {
      expect(screen.getByRole("tab", { name })).toHaveAccessibleDescription("完了");
    }
    for (const name of ["具材", "仕上げ", "カット"]) {
      expect(screen.getByRole("tab", { name })).not.toHaveAccessibleDescription();
    }
  });

  it("completed tabs read ✓ + short label; active / next / locked read their label with no ✓", () => {
    renderStrip("TOPPING", "PREPARE");
    for (const name of ["生地", "ソース", "チーズ"]) {
      expect(screen.getByRole("tab", { name })).toHaveTextContent(`✓ ${name}`);
    }
    expect(screen.getByRole("tab", { name: "具材" })).toHaveTextContent(/^具材$/);
    expect(screen.getByRole("tab", { name: "仕上げ" })).toHaveTextContent(/^仕上げ$/);
    expect(screen.getByRole("tab", { name: "カット" })).toHaveTextContent(/^カット$/);
  });

  it("only the immediate next tab is ever tappable, at every position of the 7-step walk", () => {
    const walk: [MakingStep, "PREPARE" | "POST_BAKE", string | null][] = [
      ["DOUGH", "PREPARE", "ソース"],
      ["SAUCE", "PREPARE", "チーズ"],
      ["CHEESE", "PREPARE", "具材"],
      ["TOPPING", "PREPARE", null], // the next step is the BAKE indicator, which is never a tap target
      ["FINISH", "POST_BAKE", "カット"],
      ["CUT", "POST_BAKE", null],
    ];
    for (const [step, phase, nextName] of walk) {
      let advanced = 0;
      renderStrip(step, phase, () => (advanced += 1));
      const enabled = screen.getAllByRole("tab").filter((t) => !(t as HTMLButtonElement).disabled);
      expect(enabled.map((t) => t.getAttribute("aria-label")), `${phase}/${step}`).toEqual(nextName ? [nextName] : []);
      for (const tab of screen.getAllByRole("tab")) fireEvent.click(tab);
      expect(advanced, `${phase}/${step}`).toBe(nextName ? 1 : 0);
      cleanup();
    }
  });

  it("the BAKE indicator stays a non-interactive aria-hidden element between the pre- and post-bake tabs", () => {
    renderStrip("TOPPING", "PREPARE");
    const strip = document.querySelector(".making-step-tabs")!;
    const kids = [...strip.children];
    const bake = strip.querySelector(".making-step-tab--bake")!;
    expect(kids.indexOf(bake)).toBe(4);
    expect(bake.getAttribute("aria-hidden")).toBe("true");
    expect(bake.tagName).toBe("DIV");
    expect(bake.className).toContain("making-step-tab--bake-ready");
  });

  it("tab count matches visibleCookingTabCount for the same fixture profile", () => {
    renderStrip("DOUGH", "PREPARE");
    expect(visibleCookingTabCount({ steps: [...PRE, ...POST] })).toBe(7);
    expect(document.querySelectorAll(".making-step-tabs > *")).toHaveLength(7);
  });
});

/** Codex review P2 on #499: a long formal label (unshipped FOLD / EDGE_FILL) on an active / next tab must not be ellipsized. */
describe("long formal labels on active / next tabs (CS-4a)", () => {
  it("renders the formal label and a short fallback for the active tab, and keeps the formal accessible name", () => {
    render(
      <MakingStepTabs steps={["DOUGH", "SAUCE", "FOLD"]} currentStep="FOLD" nextReady onAdvance={() => {}} />,
    );
    const tab = screen.getByRole("tab", { name: "折りたたみ" });
    expect(tab.querySelector(".making-step-tab__text--len5")).toHaveTextContent("折りたたみ");
    expect(tab.querySelector(".making-step-tab__alt")).toHaveTextContent("折る");
  });

  it("the next tab gets the fallback too; completed and locked tabs just use the short label", () => {
    const { rerender } = render(
      <MakingStepTabs steps={["DOUGH", "EDGE_FILL", "TOPPING"]} currentStep="DOUGH" nextReady onAdvance={() => {}} />,
    );
    const next = screen.getByRole("tab", { name: "ふちづめ" });
    expect(next.querySelector(".making-step-tab__text--len4")).toHaveTextContent("ふちづめ");
    expect(next.querySelector(".making-step-tab__alt")).toHaveTextContent("ふち");
    rerender(
      <MakingStepTabs steps={["DOUGH", "EDGE_FILL", "TOPPING"]} currentStep="TOPPING" nextReady onAdvance={() => {}} />,
    );
    const done = screen.getByRole("tab", { name: "ふちづめ" });
    expect(done).toHaveTextContent("✓ ふち");
    expect(done.querySelector(".making-step-tab__alt")).toBeNull();
  });

  it("a step whose short label equals its formal label renders no fallback", () => {
    render(<MakingStepTabs steps={["DOUGH", "SAUCE"]} currentStep="DOUGH" nextReady onAdvance={() => {}} />);
    expect(document.querySelector(".making-step-tab__alt")).toBeNull();
  });
});
