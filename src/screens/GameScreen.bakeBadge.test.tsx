import "@testing-library/jest-dom/vitest";
import type { Dispatch } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { cook, freeRound, MARGHERITA, NOW, ORDINARY, playFreeRound } from "../state/testSupport/trialNotebookFlow";

/**
 * #469 (Owner D2): the RESULT 焼き加減 badge is 5-level for a guided recipe round only. FREE Cooking -- the matched
 * recipe AND the ORIGINAL pizza -- keeps the 3-level badge, because the BAKE gauge shows the generic FREE window while a
 * matched pizza is judged against the matched recipe's own window. Real reducer states, rendered through GameScreen.
 */
afterEach(cleanup);

function Screen({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  return (
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="cheese"
      selectedIngredientId={null}
      bakeProgress={null}
      referenceModeEnabled={false}
      referencePizza={null}
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
      onRetrySameRecipe={() => dispatch({ type: "RETRY_SAME_RECIPE", now: NOW })}
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
  );
}

function badges(state: GameState): string[] {
  render(<Screen state={state} dispatch={() => {}} />);
  return [...document.querySelectorAll(".result-panel__bake-badge")].map((el) => el.textContent ?? "");
}

// FREE window 58-78 (centre 68): 64 would be 惜しい（焼き不足）. Margherita window 60-80 (centre 70): 64 is also 惜しい（焼き不足）;
// 67 is ジャスト for Margherita, 惜しい for FREE. Both are inside the window, so the 3-level label is "いい焼き加減".
describe("the RESULT bake badge by round kind (#469)", () => {
  it("FREE Cooking, recipe matched: 3-level badge, while the round carries the matched recipe", () => {
    const state = playFreeRound(freeRound(), MARGHERITA, 64);
    expect(state.freeCook).toBe(true);
    expect(state.recipe.id).toBe("margherita");
    expect(state.bakeState).toBe("perfect");
    const texts = badges(state);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain("焼き加減: いい焼き加減");
  });

  it("FREE Cooking, ORIGINAL pizza: 3-level badge", () => {
    const state = playFreeRound(freeRound(), ORDINARY, 64);
    expect(state.freeCook).toBe(true);
    const texts = badges(state);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain("焼き加減: いい焼き加減");
  });

  it("FREE Cooking keeps the 3-level labels at the raw / burnt edges too", () => {
    expect(badges(playFreeRound(freeRound(), ORDINARY, 10)).every((t) => t.includes("生焼け"))).toBe(true);
    cleanup();
    expect(badges(playFreeRound(freeRound(), ORDINARY, 95)).every((t) => t.includes("焦げ"))).toBe(true);
  });

  it.each([
    [64, "惜しい（焼き不足）"],
    [70, "ジャスト"],
    [76, "惜しい（焼きすぎ）"],
  ])("guided recipe (Margherita 60-80) at %s: 5-level badge %s", (bake, label) => {
    const start = gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW });
    const state = cook(start, MARGHERITA, bake);
    expect(state.freeCook).toBe(false);
    expect(state.phase).toBe("RESULT");
    const texts = badges(state);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain(`焼き加減: ${label}`);
  });
});

// Issue #481: JUST band on the BAKE gauge (guided only) and no 「完璧」 on a near-miss RESULT.
function bakePhase(start: GameState, pizza: typeof MARGHERITA): GameState {
  let s = gameReducer(start, { type: "CONFIRM_MAKING_STEP" });
  if (pizza.sauce) {
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: pizza.sauce, deposits: pizza.sauceDeposits ?? buildIdealSauceFixture() });
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.cheese ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  for (const p of pizza.toppings ?? []) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: p.id, x: p.x, y: p.y });
  return gameReducer(s, { type: "START_BAKE", now: NOW + 60_000 });
}

describe("JUST band and near-miss dialogue through GameScreen (#481)", () => {
  it("guided BAKE draws the band at centre +-3 (Margherita 60-80 -> 67 / 6)", () => {
    const state = bakePhase(gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW }), MARGHERITA);
    expect(state.phase).toBe("BAKE");
    render(<Screen state={state} dispatch={() => {}} />);
    const band = document.querySelector<HTMLElement>(".bake-gauge__just")!;
    expect(parseFloat(band.style.left)).toBe(67);
    expect(parseFloat(band.style.width)).toBe(6);
  });

  it("FREE Cooking BAKE never draws the band", () => {
    const state = bakePhase(gameReducer(freeRound(), { type: "START_FREE_COOK", now: NOW }), ORDINARY);
    expect(state.phase).toBe("BAKE");
    expect(state.freeCook).toBe(true);
    render(<Screen state={state} dispatch={() => {}} />);
    expect(document.querySelector(".bake-gauge")).not.toBeNull();
    expect(document.querySelector(".bake-gauge__just")).toBeNull();
  });

  it.each([64, 76])("guided near-miss RESULT at %s never says 完璧", (bake) => {
    const start = gameReducer(createGuidedInitialState("margherita"), { type: "BEGIN_PREPARE", now: NOW });
    render(<Screen state={cook(start, MARGHERITA, bake)} dispatch={() => {}} />);
    expect(document.body.textContent).not.toContain("完璧");
  });
});
