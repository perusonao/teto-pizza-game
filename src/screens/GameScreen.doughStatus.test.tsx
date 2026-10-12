import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { DOUGH_SIZE_STATUS_TEXT, type DoughSizeStatus } from "../logic/doughFeedback";

/**
 * Issue #474 A-1: the DOUGH step's one-line status under the pizza. Words only; it explains the
 * 次へ CTA's own state and never changes it.
 */

function prepare(step: GameState["makingStep"]): GameState {
  return { ...gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" }), makingStep: step };
}

function renderAt(state: GameState, doughShapeComplete: boolean, doughSizeStatus?: DoughSizeStatus) {
  const noop = () => {};
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="sauce"
      selectedIngredientId={null}
      bakeProgress={null}
      referenceModeEnabled
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete={doughShapeComplete}
      doughSizeStatus={doughSizeStatus}
      onGoHome={noop}
      onBeginPrepare={noop}
      onResetPizza={noop}
      onUndoPlacement={noop}
      onConfirmMakingStep={noop}
      onStartBake={noop}
      onShowHint={noop}
      onChangeCategory={noop}
      onSelectIngredient={noop}
      onTapPizza={noop}
      onBakeTick={noop}
      onConfirmBake={noop}
      onRetrySameRecipe={noop}
      onBackToPizzaSelect={noop}
      onMissionServeNext={noop}
      onMissionSkipOrder={noop}
      onMissionStart={noop}
      onMissionExitToFree={noop}
      onMissionCloseIntro={noop}
      onShowRanking={noop}
      onReferencePopoverChange={noop}
      onDispenseProgress={noop}
      onDispenseCommit={noop}
      onDoughStretchProgress={noop}
      onDoughStretchCommit={noop}
      onAddCutLine={noop}
      onDoughElementChange={noop}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={noop}
    />,
  );
}

afterEach(() => cleanup());

const status = () => screen.getByTestId("dough-size-status");
const next = () => screen.getByRole("button", { name: /次へ/ });

describe("DOUGH size status line", () => {
  it("explains a disabled 次へ (SMALL) and is a polite live region linked to the CTA", () => {
    renderAt(prepare("DOUGH"), false);
    expect(next()).toBeDisabled();
    expect(status()).toHaveTextContent(DOUGH_SIZE_STATUS_TEXT.SMALL);
    expect(status()).toHaveAttribute("role", "status");
    expect(status()).toHaveAttribute("aria-live", "polite");
    expect(next()).toHaveAttribute("aria-describedby", status().id);
  });

  it("says READY once 次へ is available, and LARGE when the dough is past the ideal size", () => {
    renderAt(prepare("DOUGH"), true);
    expect(next()).toBeEnabled();
    expect(status()).toHaveTextContent(DOUGH_SIZE_STATUS_TEXT.READY);
    cleanup();
    renderAt(prepare("DOUGH"), true, "LARGE");
    expect(next()).toBeEnabled();
    expect(status()).toHaveTextContent(DOUGH_SIZE_STATUS_TEXT.LARGE);
  });

  it("can never contradict the CTA: an unavailable 次へ is always SMALL, whatever the prop says", () => {
    renderAt(prepare("DOUGH"), false, "LARGE");
    expect(next()).toBeDisabled();
    expect(status()).toHaveTextContent(DOUGH_SIZE_STATUS_TEXT.SMALL);
  });

  it("is DOUGH-only: no status line and no aria-describedby in SAUCE", () => {
    renderAt(prepare("SAUCE"), true);
    expect(screen.queryByTestId("dough-size-status")).toBeNull();
    expect(next()).not.toHaveAttribute("aria-describedby");
  });

  it("is not rendered after PREPARE", () => {
    renderAt({ ...prepare("DOUGH"), phase: "BAKE" }, true);
    expect(screen.queryByTestId("dough-size-status")).toBeNull();
  });
});
