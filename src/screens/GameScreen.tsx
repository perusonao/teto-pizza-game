import { DialogueBox } from "../components/DialogueBox";
import { PizzaStage } from "../components/PizzaStage";
import { IngredientTray } from "../components/IngredientTray";
import { BakeOverlay } from "../components/BakeOverlay";
import { ResultPanel } from "../components/ResultPanel";
import { MissionHud } from "../components/MissionHud";
import { MissionIntroOverlay } from "../components/MissionIntroOverlay";
import { MissionServePanel } from "../components/MissionServePanel";
import { MissionResultOverlay } from "../components/MissionResultOverlay";
import { ReferencePreview } from "../components/ReferencePreview";
import { SauceMetricsPanel } from "../components/SauceMetricsPanel";
import type { ReferencePizza } from "../data/referencePizza";
import type { SauceMetrics } from "../logic/sauceField";
import type { SauceReferenceShadowScore } from "../logic/referenceScoring";
import type { SauceDeposit } from "../state/pizzaState";
import {
  buildBlueResultLine,
  buildMitoOrderLine,
  buildTetoBakeLine,
  buildTetoOrderLine,
  buildTetoResultLine,
  type DialogueLine,
} from "../data/dialogue";
import { getIngredient, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { GameState } from "../state/gameReducer";
import { discoveredRecipeIds } from "../state/dex";
import { remainingSeconds, type MissionState } from "../mission/lunchRush";
import { averageQualityScore, missionScore } from "../logic/missionScoring";
import { calculateMissionReward } from "../logic/economy";
import type { PieceReferenceMetrics } from "../logic/referenceMatching";
import type { DoughPoint } from "../logic/pizzaCoordinates";

/**
 * GAME screen (Issue #24). Everything that happens while an actual round is in play --
 * ORDER/PREPARE/BAKE/RESULT/DISCOVERED (unchanged, see src/state/gameReducer.ts) plus the
 * Lunch Rush mission overlays -- lives here. This is a straight extraction of what used to be
 * App.tsx's entire body: no gameplay behavior changes, only where the JSX (and the small
 * per-phase dialogue derivations that used to sit inline in App.tsx's JSX) lives. App.tsx
 * keeps owning every hook/reducer/effect/navigation decision and hands this component the raw
 * `state`/`mission` plus the handful of UI-only fields (selected ingredient, active tray
 * category, live bake progress) it can't derive on its own, so HOME (./HomeScreen.tsx) and
 * GAME stay two views over one shared App-level state rather than duplicating any game logic.
 */

interface GameScreenProps {
  state: GameState;
  mission: MissionState;
  missionNow: number;
  missionDurationSeconds: number;
  missionBestAtStartOfRun: number;
  activeCategory: IngredientCategory;
  selectedIngredientId: string | null;
  bakeProgress: number | null;
  referenceModeEnabled: boolean;
  referencePizza: ReferencePizza | null;
  isReferencePopoverOpen: boolean;
  sauceMetrics: SauceMetrics;
  sauceShadowScore: SauceReferenceShadowScore;
  pieceShadowMetrics: readonly PieceReferenceMetrics[];
  onGoHome: () => void;
  onOpenDex: () => void;
  onOpenShop: () => void;
  onBeginPrepare: () => void;
  onShowMissionIntro: () => void;
  onResetPizza: () => void;
  onStartBake: () => void;
  onShowHint: () => void;
  onChangeCategory: (category: IngredientCategory) => void;
  onSelectIngredient: (ingredient: Ingredient) => void;
  onTapPizza: (x: number, y: number) => void;
  onBakeTick: (value: number) => void;
  onConfirmBake: (value: number) => void;
  onRegisterToDex: () => void;
  onPlayAgain: () => void;
  onMissionServeNext: () => void;
  onMissionStart: () => void;
  onMissionExitToFree: () => void;
  onMissionCloseIntro: () => void;
  onReferencePopoverChange: (isOpen: boolean) => void;
  onDispenseProgress: (deposits: readonly SauceDeposit[]) => void;
  onDispenseCommit: (ingredientId: string, deposits: SauceDeposit[]) => void;
  onDoughElementChange: (element: HTMLDivElement | null) => void;
  resolvePhysicalDrop: (clientX: number, clientY: number) => DoughPoint | null;
  onPhysicalDrop: (ingredient: Ingredient, point: DoughPoint) => void;
}

export function GameScreen({
  state,
  mission,
  missionNow,
  missionDurationSeconds,
  missionBestAtStartOfRun,
  activeCategory,
  selectedIngredientId,
  bakeProgress,
  referenceModeEnabled,
  referencePizza,
  isReferencePopoverOpen,
  sauceMetrics,
  sauceShadowScore,
  pieceShadowMetrics,
  onGoHome,
  onOpenDex,
  onOpenShop,
  onBeginPrepare,
  onShowMissionIntro,
  onResetPizza,
  onStartBake,
  onShowHint,
  onChangeCategory,
  onSelectIngredient,
  onTapPizza,
  onBakeTick,
  onConfirmBake,
  onRegisterToDex,
  onPlayAgain,
  onMissionServeNext,
  onMissionStart,
  onMissionExitToFree,
  onMissionCloseIntro,
  onReferencePopoverChange,
  onDispenseProgress,
  onDispenseCommit,
  onDoughElementChange,
  resolvePhysicalDrop,
  onPhysicalDrop,
}: GameScreenProps) {
  const isMissionPlaying = mission.mode === "PLAYING";
  // Free play's own RESULT dialogue/ResultPanel are gated on this, not just `!isMissionPlaying`
  // -- once a run's timer expires mid-round, `mission.mode` flips straight to "RESULT" while
  // `state.phase` can still be sitting at "RESULT" (or PREPARE/BAKE) from the interrupted
  // round. `MissionResultOverlay` covers the whole screen either way, but this keeps free
  // play's own RESULT UI from rendering (uselessly) underneath it during that window.
  const isMissionActive = mission.mode === "PLAYING" || mission.mode === "RESULT";
  // During a Mission run, free play's own RESULT dialogue (Teto/Blue's comments) is skipped
  // -- reusing it would cost the same tempo `MissionServePanel` exists to avoid (Phase 3C-4
  // section 17). Every other phase's dialogue is completely unaffected, Mission or not.
  const showFreeResultDialogue = state.phase === "RESULT" && !isMissionActive;

  const mitoOrderLine = buildMitoOrderLine(
    state.order.id,
    state.order.lineJa,
    state.recipe,
    discoveredRecipeIds(state.dex),
  );

  const discoveredLine: DialogueLine = {
    speaker: "mito",
    id: `discovered.${state.recipe.id}`,
    textJa: state.justDiscovered
      ? `${state.recipe.nameJa}がレシピ図鑑に載ったよ！やったね！`
      : `${state.recipe.nameJa}、また上手にできたね！`,
  };

  return (
    <div className="game-screen">
      <header className="app-header">
        <button type="button" className="app-header__home-button" onClick={onGoHome}>
          {"\u{1F3E0}"} ホーム
        </button>
        <div className="app-header__actions">
          <span className="app-header__pitz" aria-label={`Pitz残高 ${state.pitzBalance}`}>
            {"\u{1FA99}"} {state.pitzBalance}
          </span>
          <button type="button" className="app-header__shop-button" onClick={onOpenShop}>
            {"\u{1F6D2}"} Shop
          </button>
          <button type="button" className="app-header__dex-button" onClick={onOpenDex}>
            {"\u{1F4D6}"} レシピ図鑑
          </button>
        </div>
      </header>

      {isMissionPlaying && mission.clock && (
        <MissionHud
          remainingSeconds={remainingSeconds(missionNow, mission.clock)}
          servedCount={mission.metrics.servedCount}
        />
      )}

      <section className="dialogue-area">
        {state.phase === "ORDER" && (
          <>
            <DialogueBox {...mitoOrderLine} />
            <DialogueBox {...buildTetoOrderLine(state.recipe)} />
          </>
        )}
        {state.phase === "PREPARE" && state.hint && <DialogueBox {...state.hint} />}
        {state.phase === "BAKE" && <DialogueBox {...buildTetoBakeLine(state.recipe)} />}
        {showFreeResultDialogue && state.score && state.bakeState && (
          <>
            <DialogueBox
              {...buildTetoResultLine(state.recipe, state.bakeState, state.pizza.bakeResult)}
            />
            <DialogueBox
              {...buildBlueResultLine(
                state.recipe,
                state.score,
                state.bakeState,
                state.pizza.bakeResult,
              )}
            />
          </>
        )}
        {state.phase === "DISCOVERED" && <DialogueBox {...discoveredLine} />}
      </section>

      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive={state.phase === "PREPARE" && !isReferencePopoverOpen}
        activeIngredient={selectedIngredientId ? (getIngredient(selectedIngredientId) ?? null) : null}
        bakeProgress={bakeProgress}
        placement={state.placement}
        resultRevealed={state.phase === "RESULT"}
        referenceModeEnabled={referenceModeEnabled}
        onDoughElementChange={onDoughElementChange}
        onTap={onTapPizza}
        onDispenseProgress={onDispenseProgress}
        onDispenseCommit={onDispenseCommit}
      />

      {state.phase === "PREPARE" && referenceModeEnabled && referencePizza && (
        <div className="reference-tools-row">
          <ReferencePreview
            reference={referencePizza}
            isOpen={isReferencePopoverOpen}
            onOpenChange={onReferencePopoverChange}
          />
        </div>
      )}

      {state.phase === "ORDER" && (
        <div className="action-row">
          <button type="button" className="cta-button cta-button--primary" onClick={onBeginPrepare}>
            {mission.mode === "FREE" ? <>{"\u{1F355}"} フリープレイ</> : "ピザを作る！"}
          </button>
          {mission.mode === "FREE" && (
            <button type="button" className="secondary-button" onClick={onShowMissionIntro}>
              {"⏱"} Lunch Rush
            </button>
          )}
        </div>
      )}

      {state.phase === "PREPARE" && referenceModeEnabled && (
        <SauceMetricsPanel
          metrics={sauceMetrics}
          shadowScore={sauceShadowScore}
          pieceMetrics={pieceShadowMetrics}
        />
      )}

      {state.phase === "PREPARE" && (
        <>
          <IngredientTray
            activeCategory={activeCategory}
            onChangeCategory={onChangeCategory}
            selectedIngredientId={selectedIngredientId}
            onSelectIngredient={onSelectIngredient}
            ownedIngredientIds={state.ownedIngredientIds}
            physicalDragEnabled={referenceModeEnabled && !isReferencePopoverOpen}
            draggableIngredientIds={["mozzarella", "basil"]}
            resolvePhysicalDrop={resolvePhysicalDrop}
            onPhysicalDrop={onPhysicalDrop}
          />
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={onResetPizza}>
              やり直す
            </button>
            <button type="button" className="cta-button cta-button--bake" onClick={onStartBake}>
              {"\u{1F525}"} 焼く！
            </button>
            <button type="button" className="secondary-button" onClick={onShowHint}>
              ヒント
            </button>
          </div>
        </>
      )}

      {state.phase === "BAKE" && (
        <BakeOverlay
          targetStart={state.recipe.bakeTarget.start}
          targetEnd={state.recipe.bakeTarget.end}
          onConfirm={onConfirmBake}
          onTick={onBakeTick}
        />
      )}

      {state.phase === "RESULT" && state.score && isMissionPlaying && (
        <MissionServePanel
          score={state.score}
          servedCount={mission.metrics.servedCount}
          onNext={onMissionServeNext}
        />
      )}

      {state.phase === "RESULT" && state.score && !isMissionActive && (
        <ResultPanel score={state.score} bakeState={state.bakeState} onRegister={onRegisterToDex} />
      )}

      {state.phase === "DISCOVERED" && (
        <div className="action-row action-row--column">
          {state.justDiscovered && (
            <p className="discovered-banner">
              {"✨"} {state.recipe.nameJa}を発見しました！
            </p>
          )}
          {!state.justDiscovered && state.justGotNewBest && (
            <p className="discovered-banner discovered-banner--best">{"\u{1F31F}"} NEW BEST!</p>
          )}
          <button type="button" className="cta-button cta-button--primary" onClick={onPlayAgain}>
            もう一度作る
          </button>
        </div>
      )}

      {mission.mode === "INTRO" && (
        <MissionIntroOverlay
          durationSeconds={missionDurationSeconds}
          onStart={onMissionStart}
          onClose={onMissionCloseIntro}
        />
      )}

      {mission.mode === "RESULT" && (
        <MissionResultOverlay
          servedCount={mission.metrics.servedCount}
          averageQuality={averageQualityScore(mission.metrics)}
          bestQuality={mission.metrics.bestQualityScore}
          score={missionScore(mission.metrics)}
          isNewBest={missionScore(mission.metrics) > missionBestAtStartOfRun}
          pitzReward={calculateMissionReward(mission.metrics)}
          pitzBalance={state.pitzBalance}
          onRetry={onMissionStart}
          onExit={onMissionExitToFree}
        />
      )}
    </div>
  );
}
