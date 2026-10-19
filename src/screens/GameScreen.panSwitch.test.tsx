import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { PanChoice } from "../state/panSelection";
import { createInitialGameState } from "../state/gameReducer";
import { resetPreviewPanShapeForTest } from "../preview/panShapePreview";

/**
 * Square Dough F4-b (#538): the DOUGH step's ○/□ switch in the real GameScreen. Shapes only; present only in Free Cooking / Research
 * once the (derived) affordance is open -- `?panSwitch=open` stands in for it here, since no production recipe requires the tray yet.
 */
function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewPanShapeForTest();
}
beforeEach(() => setSearch(""));
afterEach(() => {
  setSearch("");
  cleanup();
});

function freeCook(step: GameState["makingStep"] = "DOUGH"): GameState {
  const started = gameReducer(createInitialGameState(), { type: "START_FREE_COOK", now: 0 });
  return { ...gameReducer(started, { type: "BEGIN_PREPARE", now: 0 }), makingStep: step };
}
function guided(): GameState {
  return gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
}

function renderAt(state: GameState, onSelectPan: (pan: PanChoice) => void = () => {}) {
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
      doughShapeComplete={false}
      onSelectPan={onSelectPan}
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


const sw = () => screen.queryByTestId("pan-switch");

describe("GameScreen ○/□ switch", () => {
  it("is absent while the affordance is closed (Production), in the DOM and by class", () => {
    const { container } = renderAt(freeCook());
    expect(sw()).toBeNull();
    expect(container.innerHTML).not.toMatch(/pan-switch/);
  });

  it("appears in the Free Cooking DOUGH step once open, as two radios with shape-only labels and the round one checked", () => {
    setSearch("?panSwitch=open");
    renderAt(freeCook());
    expect(sw()).not.toBeNull();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["丸い生地", "四角い生地"]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(sw()!.textContent).toBe("");
  });

  it("reports the choice, and a tray pizza shows the square checked", () => {
    setSearch("?panSwitch=open");
    const onSelect = vi.fn();
    renderAt(freeCook(), onSelect);
    fireEvent.click(screen.getByRole("radio", { name: "四角い生地" }));
    expect(onSelect).toHaveBeenCalledWith("tray");
    cleanup();
    const tray = gameReducer(freeCook(), { type: "SELECT_PAN", pan: "tray" });
    renderAt(tray);
    expect(screen.getByRole("radio", { name: "四角い生地" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("dough-size-status")).toHaveAttribute("data-status", "SQUARE");
  });

  it("is DOUGH-only", () => {
    setSearch("?panSwitch=open");
    renderAt(freeCook("SAUCE"));
    expect(sw()).toBeNull();
  });

  it("is never shown in a guided round (the recipe fixes the pan)", () => {
    setSearch("?panSwitch=open");
    renderAt(guided());
    expect(sw()).toBeNull();
  });

  it("is never shown in Lunch Rush or Dinner", () => {
    setSearch("?panSwitch=open");
    renderAt({ ...freeCook(), freeCook: false, isMissionRound: true, roundKind: "LUNCH_RUSH" });
    expect(sw()).toBeNull();
    cleanup();
    renderAt({ ...freeCook(), freeCook: false, roundKind: "DINNER" });
    expect(sw()).toBeNull();
  });
});
