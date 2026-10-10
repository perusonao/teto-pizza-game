import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { IngredientCategory } from "../data/ingredients";

/**
 * Cooking Steps 2.0 Phase 1 (Issue #449): the ↩ 「1つ戻す」 button in the PREPARE bar. It is a separate control from
 * 「やり直す」 (RESET_PIZZA); it is always in the bar of a non-Lunch-Rush PREPARE round (a constant slot, so the CTA
 * never shifts between steps), enabled only while the reducer would accept the action.
 */

function prepare(step: GameState["makingStep"], pieces = 0): GameState {
  let state: GameState = { ...gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" }), makingStep: step };
  for (let i = 0; i < pieces; i += 1) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40 + i * 12, y: 45 });
  }
  return state;
}

const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = {
  DOUGH: "sauce",
  SAUCE: "sauce",
  CHEESE: "cheese",
  TOPPING: "topping",
};

function renderAt(state: GameState, onUndoPlacement: () => void = () => {}, onResetPizza: () => void = () => {}) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory={CATEGORY_FOR_STEP[state.makingStep] ?? "topping"}
      selectedIngredientId={null}
      bakeProgress={state.phase === "BAKE" ? 0.4 : null}
      referenceModeEnabled
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={onResetPizza}
      onUndoPlacement={onUndoPlacement}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={() => {}}
      onTapPizza={() => {}}
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
    />,
  );
}


afterEach(() => {
  cleanup();
});

const undoButton = () => screen.getByRole("button", { name: "1つ戻す" });

describe("↩ 1つ戻す button", () => {
  it("is a separate control from やり直す and sits next to it", () => {
    renderAt(prepare("CHEESE", 1));
    const reset = screen.getByRole("button", { name: "やり直す" });
    expect(undoButton()).not.toBe(reset);
    expect(reset.nextElementSibling).toBe(undoButton());
    expect(undoButton().className).toContain("prepare-undo-button");
  });

  it("is enabled in CHEESE with a piece placed and calls onUndoPlacement; やり直す is untouched", () => {
    const onUndo = vi.fn();
    const onReset = vi.fn();
    renderAt(prepare("CHEESE", 1), onUndo, onReset);
    expect(undoButton()).toBeEnabled();
    fireEvent.click(undoButton());
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("is disabled (slot kept) when nothing can be undone: empty step, DOUGH and SAUCE", () => {
    for (const [step, pieces] of [["CHEESE", 0], ["TOPPING", 0], ["DOUGH", 0], ["SAUCE", 0]] as const) {
      const onUndo = vi.fn();
      renderAt(prepare(step, pieces), onUndo);
      expect(undoButton()).toBeDisabled();
      fireEvent.click(undoButton());
      expect(onUndo).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("is disabled on DOUGH / SAUCE even with a piece on the pizza (only the current step's pieces can be taken back)", () => {
    const placed = prepare("CHEESE", 1);
    for (const step of ["DOUGH", "SAUCE"] as const) {
      renderAt({ ...placed, makingStep: step });
      expect(undoButton()).toBeDisabled();
      cleanup();
    }
  });

  it("is absent in a Lunch Rush round", () => {
    renderAt({ ...prepare("CHEESE", 1), roundKind: "LUNCH_RUSH", isMissionRound: true });
    expect(screen.queryByRole("button", { name: "1つ戻す" })).toBeNull();
  });

  it("is not rendered after PREPARE (the bar is PREPARE-only)", () => {
    renderAt({ ...prepare("CHEESE", 1), phase: "BAKE" });
    expect(screen.queryByRole("button", { name: "1つ戻す" })).toBeNull();
  });
});
