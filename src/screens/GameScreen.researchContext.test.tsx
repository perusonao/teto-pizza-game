import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { IngredientCategory } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { discoveredDex } from "../state/testSupport/guidedRound";

/**
 * Issue #358 Slice 1: where does the Research Target context (`research-context`: 「🔎 研究中 ？？？ピザ」) live across
 * the cooking transitions of a Research round? Real reducer + real GameScreen (Dex 25 ladder save, pesto-pollo the
 * single Research Entry).
 */
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const T = "pesto-pollo";
function researchRound(): GameState {
  const owned = ladderOwned(25);
  const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
  const s: GameState = { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
  return gameReducer(s, { type: "START_FREE_COOK", researchTargetId: T });
}
const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = { DOUGH: "sauce", SAUCE: "sauce", CHEESE: "cheese", TOPPING: "topping" };
function renderAt(state: GameState) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory={CATEGORY_FOR_STEP[state.makingStep] ?? "topping"}
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
      onUndoCutLine={() => {}}
      cutRejectionMessage={null}
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />,
  );
}

afterEach(cleanup);

// PREPARE shows the dedicated card; BAKE keeps the label in its compact row.
const hasContext = (s: GameState) => {
  const r = renderAt(s);
  const has = !!screen.queryByTestId("research-context") || (s.phase === "BAKE" && !!screen.queryByText(/研究中/));
  r.unmount();
  return has;
};
const trace: string[] = [];
function step(label: string, s: GameState, ...a: GameAction[]) {
  const next = a.reduce(gameReducer, s);
  trace.push(`${label}: phase=${next.phase} step=${next.makingStep} target=${next.researchTargetId} ctx=${hasContext(next)}`);
  return next;
}

describe("Research context across the transitions of a Research round", () => {
  it("traces every transition", () => {
    let s = researchRound();
    s = step("start", s);
    s = step("dough stretch", s, { type: "COMMIT_DOUGH_STRETCH", shape: { widthPct: 100, heightPct: 100 } as never });
    s = step("reset (dough)", s, { type: "RESET_PIZZA" });
    s = step("next->SAUCE", s, { type: "CONFIRM_MAKING_STEP" });
    s = step("sauce", s, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 });
    s = step("next", s, { type: "CONFIRM_MAKING_STEP" });
    s = step("next", s, { type: "CONFIRM_MAKING_STEP" });
    s = step("topping", s, { type: "PLACE_TOPPING", ingredientId: "egg", x: 40, y: 40 });
    s = step("bake", s, { type: "START_BAKE" });
    expect(trace.every((l) => l.endsWith("ctx=true"))).toBe(true);
  });

  it("retry after an attempt that used the target's last finite stock", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
    const inv: Record<string, number> = Object.fromEntries(owned.map((id) => [id, 10]));
    for (const id of ["chicken", "mozzarella", "fresh-tomato", "pesto"]) inv[id] = 1;
    let s = gameReducer({ ...base, inventory: inv }, { type: "START_FREE_COOK", researchTargetId: T });
    const out: string[] = [];
    out.push(`start ctx=${hasContext(s)}`);
    s = [{ type: "CONFIRM_MAKING_STEP" }, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "chicken", x: 40, y: 40 }, { type: "PLACE_TOPPING", ingredientId: "egg", x: 55, y: 45 }, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 }, { type: "CONFIRM_MAKING_STEP" }, { type: "REGISTER_TO_DEX" }].reduce(
      (a, x) => gameReducer(a, x as GameAction), s);
    out.push(`result ${s.phase}`);
    s = gameReducer(s, { type: "RETRY_SAME_RECIPE" });
    expect(out[0]).toBe("start ctx=true");
    expect(s.researchTargetId).toBe(T);
    expect(s.inventory["chicken"]).toBe(0); // the target's own ingredient is used up: not cookable any more
    expect(hasContext(s)).toBe(true); // DOUGH of the retry still names the research (was: only 「🎨 レシピ発見の試作」)
    expect(out.length).toBe(2);
  });

  it("a targetless free cook has no research context", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
    const s = gameReducer({ ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) }, { type: "START_FREE_COOK" });
    expect(hasContext(s)).toBe(false);
  });
});
