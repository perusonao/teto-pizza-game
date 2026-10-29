import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { getReferencePizza } from "../data/referencePizza";
import { INGREDIENTS } from "../data/ingredients";

/**
 * Cooking Prep Phase 1 PR-B, Codex P2 (#695 GameScreen.tsx:938): while the pan screen -- and the 300 ms guard after it -- is up, the dough behind it must
 * take no input at all: not the pointer (the overlay covers it) and not the KEYBOARD (Shift+Tab from the pan surface used to reach `.pizza-dough`, where
 * Enter / Space placed a piece). The pan screen must also survive that: input is switched off by `interactive`, the layer's own visibility is a separate
 * condition. The real GameScreen + the real reducer, with the experience gate OPEN.
 */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../data/prepExperienceGate", () => ({ PREP_EXPERIENCE_PRODUCTION: false, prepExperienceEnabled: () => gate.open }));

const referencePizza = getReferencePizza("margherita")!;
const GENEROUS = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 999]));
const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

function Harness({ prepWired = true }: { prepWired?: boolean }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    let s = gameReducer(createInitialGameState(undefined, INGREDIENTS.map((i) => i.id), 0, GENEROUS), { type: "BEGIN_PREPARE" });
    while (s.makingStep !== "TOPPING") s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    return s;
  });
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>("beef");
  return (
    <div>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <span data-testid="prepped">{(state.preparedIngredientIds ?? []).join(",")}</span>
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory="topping"
        selectedIngredientId={selectedIngredientId}
        bakeProgress={null}
        referenceModeEnabled
        referencePizza={referencePizza}
        isReferencePopoverOpen={false}
        isGlobalOverlayOpen={false}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        showDoughShape
        doughShapeComplete={false}
        onGoHome={() => {}}
        onBeginPrepare={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onUndoPlacement={() => {}}
        onPrepIngredient={prepWired ? (ingredientId) => dispatch({ type: "PREP_INGREDIENT", ingredientId }) : undefined}
        onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
        onStartBake={() => {}}
        onShowHint={() => {}}
        onChangeCategory={() => {}}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
        onTapPizza={(x, y) => selectedIngredientId && dispatch({ type: "PLACE_TOPPING", ingredientId: selectedIngredientId, x, y })}
        onBakeTick={() => {}}
        onConfirmBake={() => {}}
        onRetrySameRecipe={() => {}}
        onBackToPizzaSelect={() => {}}
        onMissionServeNext={() => {}}
        onMissionSkipOrder={() => {}}
        onMissionStart={() => {}}
        onMissionExitToFree={() => {}}
        onMissionCloseIntro={() => {}}
        onShowRanking={() => {}}
        onReferencePopoverChange={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        onAddCutLine={() => {}}
        onDoughElementChange={() => {}}
        resolvePhysicalDrop={() => null}
        onPhysicalDrop={() => {}}
      />
    </div>
  );
}

const count = () => Number(screen.getByTestId("topping-count").textContent);
const dough = () => document.querySelector('[data-pizza-drop-target="true"]') as HTMLElement;
const pill = () => screen.getByTestId("cooking-prep-pill");
const surface = () => screen.getByTestId("cooking-prep-surface");
const pan = () => screen.queryByTestId("cooking-prep-pan");

/** Enter and Space aimed straight at the dough (a focused dough is where Shift+Tab used to land). */
function pressEnterAndSpaceOnDough() {
  fireEvent.keyDown(dough(), { key: "Enter" });
  fireEvent.keyDown(dough(), { key: " " });
}
async function threeTosses() {
  for (let i = 0; i < 3; i += 1) {
    fireEvent.pointerDown(surface());
    await sleep(140);
  }
}

afterEach(() => {
  cleanup();
  gate.open = true;
});

describe("the dough takes no input while the pan screen is up (Codex P2)", () => {
  it("baseline: with nothing open, Enter places a beef piece (the dough is keyboard-placeable)", () => {
    render(<Harness />);
    expect(dough()).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(dough(), { key: "Enter" });
    expect(count()).toBe(1);
  });

  it("pan open: Shift+Tab never reaches the dough, Enter / Space on it place nothing, the pan screen stays", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(pill()); // keyboard-style open (detail 0)
    expect(pan()).toBeInTheDocument();
    expect(surface()).toHaveFocus();
    expect(dough()).toHaveAttribute("tabindex", "-1");
    expect(dough()).not.toHaveClass("pizza-dough--interactive");
    for (let i = 0; i < 4; i += 1) {
      await user.tab({ shift: true });
      expect(document.activeElement, `Shift+Tab #${i + 1}`).not.toBe(dough());
    }
    dough().focus(); // even a programmatic focus must not make the keys work
    pressEnterAndSpaceOnDough();
    fireEvent.pointerDown(dough());
    fireEvent.click(dough());
    expect(count()).toBe(0);
    expect(pan(), "the pan screen is not discarded by the input being switched off").toBeInTheDocument();
    expect(screen.getByTestId("prepare-dock")).toHaveAttribute("inert");
  });

  it("× cancels and everything is back: the dough takes keys again, the dock is not inert, nothing was prepped", async () => {
    render(<Harness />);
    fireEvent.click(pill());
    fireEvent.click(screen.getByTestId("cooking-prep-cancel"));
    expect(pan()).toBeNull();
    expect(dough()).toHaveAttribute("tabindex", "0");
    expect(dough()).toHaveClass("pizza-dough--interactive");
    expect(screen.getByTestId("prepare-dock")).not.toHaveAttribute("inert");
    fireEvent.keyDown(dough(), { key: " " });
    expect(count()).toBe(1);
    expect(screen.getByTestId("prepped")).toHaveTextContent("");
    expect(pill()).toBeInTheDocument();
  });

  it("third toss: the pan screen finishes (it is NOT torn down early), the guard keeps the dough shut for 300 ms, then normal input returns", async () => {
    render(<Harness />);
    fireEvent.click(pill());
    await threeTosses();
    expect(screen.getByTestId("cooking-prep-pan")).toHaveAttribute("data-mode", "done"); // still there during "ジュッ！"
    pressEnterAndSpaceOnDough();
    expect(count(), "during the done moment").toBe(0);
    await sleep(760);
    expect(screen.getByTestId("prepped")).toHaveTextContent("beef"); // the third toss did reach the reducer
    expect(screen.getByTestId("cooking-prep-guard")).toBeInTheDocument();
    expect(dough()).toHaveAttribute("tabindex", "-1");
    dough().focus();
    pressEnterAndSpaceOnDough();
    fireEvent.pointerDown(dough());
    expect(count(), "during the guard").toBe(0);
    await sleep(360);
    expect(screen.queryByTestId("cooking-prep-guard")).toBeNull();
    expect(dough()).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("prepare-dock")).not.toHaveAttribute("inert");
    fireEvent.keyDown(dough(), { key: "Enter" });
    expect(count(), "after the guard").toBe(1);
  }, 10_000);

  it("flag OFF / not wired: the dough is exactly as before (interactive, no prep DOM)", () => {
    gate.open = false;
    render(<Harness />);
    expect(document.querySelector('[class*="cooking-prep"]')).toBeNull();
    expect(dough()).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("prepare-dock")).not.toHaveAttribute("inert");
  });
});
