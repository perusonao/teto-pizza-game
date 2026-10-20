import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { visibleCookingTabCount, type CookingProfile } from "../data/cookingProfiles";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { atBake } from "../state/testSupport/confirmBakeMatrix";
import { FINISH_FIXTURE_RECIPE as FX, piece, preBakePizza } from "../state/testSupport/finishFixture";

/**
 * FINISH FIN-A (Issue #294): `GameScreen` renders the FINISH step -- the 仕上げ tab, the cooking stage layout and Mito's FINISH
 * hint -- for a Guided round whose profile carries FINISH. Driven by the test-only BBQ-shaped fixture (never in RECIPES), so
 * Production is unchanged. The tray, 「1つ戻す」 and the completion control are FIN-B / FIN-C and are asserted ABSENT here.
 */
const BBQ_PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
const WITH_CUT_PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"], cutConfig: { requestedSliceCount: 6 } };
const T = 1_000_000;

function atFinish(profile: CookingProfile = BBQ_PROFILE, over: Partial<GameState> = {}): GameState {
  const base = atBake("guided", "margherita");
  const bake = Math.round((FX.bakeTarget.start + FX.bakeTarget.end) / 2);
  const state = gameReducer({ ...base, recipe: FX, cookingProfile: profile, pizza: preBakePizza(), ...over }, { type: "CONFIRM_BAKE", value: bake, now: T });
  expect(state.makingStep).toBe("FINISH");
  return state;
}

function renderAt(state: GameState) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="topping"
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
      doughShapeComplete
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={() => {}}
      onUndoPlacement={() => {}}
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

describe("FINISH on the screen (Guided, profile with FINISH)", () => {
  it("shows the 仕上げ tab as the active step, after 焼く, in the cooking layout with a roomy stage", () => {
    const { container } = renderAt(atFinish());
    const tab = screen.getByRole("tab", { name: "仕上げ" });
    expect(tab).toHaveAttribute("aria-current", "step");
    expect(visibleCookingTabCount(BBQ_PROFILE)).toBe(6); // D·S·C·T·焼く·仕上げ -- the 6-tab ceiling
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label") ?? t.textContent)).toContain("仕上げ");
    expect(container.querySelector(".game-screen--cooking")).not.toBeNull();
    expect(container.querySelector(".pizza-stage--roomy")).not.toBeNull();
  });

  it("names the late ingredient in Mito's FINISH hint, then says it is done once enough are placed", () => {
    renderAt(atFinish());
    expect(screen.getByTestId("finish-hint")).toHaveTextContent("パセリを仕上げにのせよう！");
    cleanup();
    const state = atFinish();
    const placed = { ...state, pizza: { ...state.pizza, toppings: [...state.pizza.toppings, piece("parsley", "post"), piece("parsley", "post")] } };
    renderAt(placed);
    expect(screen.getByTestId("finish-hint")).toHaveTextContent("仕上げはここまで！");
  });

  it("draws the post-bake pieces in the separated post layer", () => {
    const state = atFinish();
    const placed = { ...state, pizza: { ...state.pizza, toppings: [...state.pizza.toppings, { ...piece("parsley", "post"), x: DOUGH_CENTER, y: DOUGH_CENTER }] } };
    renderAt(placed);
    expect(screen.getByTestId("pizza-post-layer")).toBeInTheDocument();
  });

  it("does not add the FIN-B / FIN-C controls: no tray, no 1つ戻す, no やり直す, no 次へ / 焼く！ CTA", () => {
    const { container } = renderAt(atFinish());
    expect(container.querySelector(".ingredient-tray")).toBeNull();
    expect(container.querySelector(".prepare-bake-bar")).toBeNull();
    expect(screen.queryByRole("button", { name: "1つ戻す" })).toBeNull();
    expect(screen.queryByRole("button", { name: "やり直す" })).toBeNull();
    expect(screen.queryByRole("button", { name: /次へ|焼く！|完成/ })).toBeNull();
  });

  it("the tab after FINISH (CUT) cannot advance the round from the tab strip", () => {
    const state = atFinish(WITH_CUT_PROFILE);
    // enough cut lines that CUT's own readiness (`cutConfirmReady`) would be true: FINISH must still not let the tab advance
    const line = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, path: [] };
    renderAt({ ...state, cutState: { ...state.cutState, lines: [line, line, line, line, line, line] } });
    expect(screen.getByRole("tab", { name: "カット" })).toBeDisabled();
  });
});

describe("FINISH stays off wherever it is not available", () => {
  it("a profile with FINISH in a Lunch Rush or Dinner round renders no FINISH view", () => {
    for (const roundKind of ["LUNCH_RUSH", "DINNER"] as const) {
      const { container } = renderAt({ ...atFinish(), roundKind });
      expect(screen.queryByTestId("finish-order-card"), roundKind).toBeNull();
      expect(screen.queryByRole("tab", { name: "仕上げ" }), roundKind).toBeNull();
      expect(container.querySelector(".game-screen--cooking"), roundKind).toBeNull();
      cleanup();
    }
  });

  it("a Free Cooking round never renders FINISH", () => {
    const { container } = renderAt({ ...atFinish(), roundKind: "FREE_COOK", freeCook: atFinish().freeCook });
    expect(screen.queryByTestId("finish-order-card")).toBeNull();
    expect(container.querySelector(".game-screen--cooking")).toBeNull();
  });
});
