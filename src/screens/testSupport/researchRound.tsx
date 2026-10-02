import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { GameScreen } from "../GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../../mission/lunchRush";
import { emptySauceMetrics } from "../../logic/sauceField";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS, type IngredientCategory } from "../../data/ingredients";
import { discoveredDex } from "../../state/testSupport/guidedRound";

/** Issue #358 test support: a real Research round (Dex 25 ladder save, pesto-pollo the single Research Entry) and a
 *  GameScreen render with no-op handlers (override any of them). */
export const RESEARCH_TARGET = "pesto-pollo";
export const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
export const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
export function researchSave(stock = 10): GameState {
  const owned = ladderOwned(25);
  const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, stock])) };
}
export const researchRound = (): GameState => gameReducer(researchSave(), { type: "START_FREE_COOK", researchTargetId: RESEARCH_TARGET });
const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = { DOUGH: "sauce", SAUCE: "sauce", CHEESE: "cheese", TOPPING: "topping" };

export function renderGameScreen(state: GameState, overrides: Partial<ComponentProps<typeof GameScreen>> = {}) {
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
      onSetResearchTest={() => {}}
      {...overrides}
    />,
  );
}
