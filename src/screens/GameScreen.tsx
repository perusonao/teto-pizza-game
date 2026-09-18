import { useState } from "react";
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
import { PlayerReferencePreview } from "../components/PlayerReferencePreview";
import { PizzaThumbnail } from "../components/PizzaThumbnail";
import { SauceMetricsPanel } from "../components/SauceMetricsPanel";
import { ScoringV2ShadowPanel } from "../components/ScoringV2ShadowPanel";
import type { ReferencePizza } from "../data/referencePizza";
import { getPlayerReferencePizza } from "../data/playerReference";
import type { SauceMetrics } from "../logic/sauceField";
import type { SauceReferenceShadowScore } from "../logic/referenceScoring";
import type { SauceDeposit } from "../state/pizzaState";
import type { DoughShape } from "../logic/doughShape";
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
  /** Independent Review P2-A (PR #26, discussion_r4017018600): true whenever a global overlay
   *  (Dex or Shop -- Reference has its own `isReferencePopoverOpen` already wired into the same
   *  gate below) is open. A second pointer opening one of these mid-drag must abort the first
   *  pointer's physical-drag session exactly like Reference already does, since IngredientTray's
   *  window-level pointerup/pointercancel listeners don't know or care what's visually on top. */
  isGlobalOverlayOpen: boolean;
  sauceMetrics: SauceMetrics;
  sauceShadowScore: SauceReferenceShadowScore;
  /** Human Feel Fix 2: whether a tomato-sauce dispense session currently has any buffered
   *  (uncommitted) deposits -- drives SauceMetricsPanel's live message visibility. */
  isDispensingSauce: boolean;
  pieceShadowMetrics: readonly PieceReferenceMetrics[];
  /** Issue #33 D1: true once the round has entered PREPARE (or later) -- threaded straight
   *  through to PizzaStage's own `showDoughShape` prop. */
  showDoughShape: boolean;
  /** Issue #33 D1: live size-completion gate (mean radii / DOUGH_RADIUS >= threshold),
   *  including the current in-progress gesture -- drives the DOUGH step's own CTA
   *  disabled/enabled state. */
  doughShapeComplete: boolean;
  onGoHome: () => void;
  onBeginPrepare: () => void;
  onResetPizza: () => void;
  onConfirmMakingStep: () => void;
  onStartBake: () => void;
  onShowHint: () => void;
  onChangeCategory: (category: IngredientCategory) => void;
  onSelectIngredient: (ingredient: Ingredient) => void;
  onTapPizza: (x: number, y: number) => void;
  onBakeTick: (value: number) => void;
  onConfirmBake: (value: number) => void;
  onRegisterToDex: () => void;
  /** Issue #47 Finding D: DISCOVERED's "もう一度つくる" -- retries the exact same recipe
   *  (RETRY_SAME_RECIPE), replacing the old single "もう一度作る" button that always started a
   *  *different* recipe. */
  onRetrySameRecipe: () => void;
  /** Issue #47 Finding D: DISCOVERED's "別のピザを作る" -- returns to Pizza Select so the
   *  player can explicitly choose a different recipe (mirrors HOME's own 「ピザを作る」 entry
   *  point rather than picking a new recipe at random). */
  onBackToPizzaSelect: () => void;
  onMissionServeNext: () => void;
  onMissionStart: () => void;
  onMissionExitToFree: () => void;
  onMissionCloseIntro: () => void;
  onReferencePopoverChange: (isOpen: boolean) => void;
  onDispenseProgress: (deposits: readonly SauceDeposit[]) => void;
  onDispenseCommit: (ingredientId: string, deposits: SauceDeposit[]) => void;
  onDoughStretchProgress: (shape: DoughShape | null) => void;
  onDoughStretchCommit: (shape: DoughShape) => void;
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
  isGlobalOverlayOpen,
  sauceMetrics,
  sauceShadowScore,
  isDispensingSauce,
  pieceShadowMetrics,
  showDoughShape,
  doughShapeComplete,
  onGoHome,
  onBeginPrepare,
  onResetPizza,
  onConfirmMakingStep,
  onStartBake,
  onShowHint,
  onChangeCategory,
  onSelectIngredient,
  onTapPizza,
  onBakeTick,
  onConfirmBake,
  onRegisterToDex,
  onRetrySameRecipe,
  onBackToPizzaSelect,
  onMissionServeNext,
  onMissionStart,
  onMissionExitToFree,
  onMissionCloseIntro,
  onReferencePopoverChange,
  onDispenseProgress,
  onDispenseCommit,
  onDoughStretchProgress,
  onDoughStretchCommit,
  onDoughElementChange,
  resolvePhysicalDrop,
  onPhysicalDrop,
}: GameScreenProps) {
  // RESET_PIZZA only clears `state.pizza`; it does not change the interaction props that would
  // otherwise abort local pointer state. This generation was introduced for IngredientTray's
  // physical-drag reset race in PR #26 and is now shared with PizzaStage so both topping drags
  // and buffered Sauce gestures become permanently invalid in the same reset transaction.
  const [pizzaResetToken, setPizzaResetToken] = useState(0);
  function handleResetPizza() {
    setPizzaResetToken((token) => token + 1);
    onResetPizza();
  }

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
      {/* Issue #47 Finding K: Shop/Pizza Dex were reachable from every Making phase
          (ORDER/PREPARE/BAKE/RESULT/DISCOVERED) via this header -- removed so Making stays
          focused on making and HOME remains the sole hub for Shop/Dex navigation (Issue #22's
          navigation contract). 🏠ホーム stays -- it is the correct "leave Making, land on the
          hub" affordance and already has its own isRoundInProgress()-gated confirm dialog. */}
      <header className="app-header">
        <button type="button" className="app-header__home-button" onClick={onGoHome}>
          {"\u{1F3E0}"} ホーム
        </button>
        <div className="app-header__actions">
          <span className="app-header__pitz" aria-label={`Pitz残高 ${state.pitzBalance}`}>
            {"\u{1FA99}"} {state.pitzBalance}
          </span>
        </div>
      </header>

      {isMissionPlaying && mission.clock && (
        <MissionHud
          remainingSeconds={remainingSeconds(missionNow, mission.clock)}
          servedCount={mission.metrics.servedCount}
        />
      )}

      {state.phase !== "PREPARE" && (
        <section className="dialogue-area">
          {state.phase === "ORDER" && (
            <>
              <DialogueBox {...mitoOrderLine} />
              <DialogueBox {...buildTetoOrderLine(state.recipe)} />
            </>
          )}
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
      )}

      {/* Human Feel Fix 3 (Compact Header/Reference, brief section C): PREPARE used to spend
          the dialogue-area's full character-portrait DialogueBox on `state.hint` (always
          non-null -- see data/hints.ts's buildHintLine) plus a separate .reference-tools-row
          just for the 見本 button -- together the single biggest reason PREPARE didn't fit
          390x844 without scrolling. One compact row replaces both: the recipe name, the same
          live hint text (still sourced from state.hint, just without the portrait/bubble
          chrome), and a persistent mini Reference thumbnail.

          Issue #47 Slice B (Findings F/H): the mini thumbnail (reusing the same deterministic
          `PizzaThumbnail` Pizza Select's own cards use) is now always shown here, for every
          recipe -- not gated on `referenceModeEnabled` (Scoring 2.0's own Reference-coverage
          gate, FREE-only, still unchanged and still driving SauceMetricsPanel/physical drag
          below). Tapping it opens the same `isReferencePopoverOpen` popover as before: the
          precise `ReferencePreview` panel (numeric bars, exact target coordinates) for any
          recipe B2 has a Scoring 2.0 Reference fixture for -- originally Margherita-only, now
          every recipe B2 has covered -- or the generic `PlayerReferencePreview` panel
          (../data/playerReference.ts, independent of Scoring 2.0) for any recipe that still
          has none. */}
      {state.phase === "PREPARE" && (
        <div className="order-card">
          <div className="order-card__text">
            <span className="order-card__recipe-name">{state.recipe.nameJa}</span>
            <span className="order-card__hint">{state.hint?.textJa ?? state.recipe.description}</span>
          </div>
          <button
            type="button"
            className="mini-reference"
            onClick={() => onReferencePopoverChange(true)}
            aria-haspopup="dialog"
            aria-label={`${state.recipe.nameJa}の見本を拡大表示`}
          >
            <span className="mini-reference__thumb" aria-hidden="true">
              <PizzaThumbnail recipe={state.recipe} />
            </span>
            <span className="mini-reference__label">見本</span>
          </button>
          {referencePizza ? (
            <ReferencePreview
              reference={referencePizza}
              recipeNameJa={state.recipe.nameJa}
              isOpen={isReferencePopoverOpen}
              onOpenChange={onReferencePopoverChange}
              renderTrigger={false}
            />
          ) : (
            <PlayerReferencePreview
              reference={getPlayerReferencePizza(state.recipe)}
              isOpen={isReferencePopoverOpen}
              onOpenChange={onReferencePopoverChange}
              renderTrigger={false}
            />
          )}
        </div>
      )}

      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive={state.phase === "PREPARE" && !isReferencePopoverOpen && !isGlobalOverlayOpen}
        activeIngredient={selectedIngredientId ? (getIngredient(selectedIngredientId) ?? null) : null}
        bakeProgress={bakeProgress}
        placement={state.placement}
        resultRevealed={state.phase === "RESULT"}
        referenceModeEnabled={referenceModeEnabled}
        resetToken={pizzaResetToken}
        makingStepToken={state.makingStepToken}
        makingStep={state.makingStep}
        showDoughShape={showDoughShape}
        onDoughElementChange={onDoughElementChange}
        onTap={onTapPizza}
        onDispenseProgress={onDispenseProgress}
        onDispenseCommit={onDispenseCommit}
        onDoughStretchProgress={onDoughStretchProgress}
        onDoughStretchCommit={onDoughStretchCommit}
      />

      {state.phase === "ORDER" && (
        <div className="action-row">
          <button type="button" className="cta-button cta-button--primary" onClick={onBeginPrepare}>
            {mission.mode === "FREE" ? <>{"\u{1F355}"} フリープレイ</> : "ピザを作る！"}
          </button>
        </div>
      )}

      {/* Human Feel Fix 3 (Compact Evaluation UI, brief section F): shown only while Sauce is
          the active category -- Cheese/Topping never needed a sauce readout, and hiding it
          then is most of this panel's contribution to the 1-screen budget. Positioned right
          after PizzaStage ("Pizza Stage近くに", per the brief), not beside it -- a true
          side-by-side layout would mean resizing the dough itself, which section A's
          "Pizza操作領域を極端に縮小しない" rules out as this round's tradeoff. Issue #33 D1:
          explicitly excludes DOUGH too -- there is no sauce readout to show before sauce is
          even reachable. */}
      {state.phase === "PREPARE" &&
        state.makingStep !== "DOUGH" &&
        referenceModeEnabled &&
        referencePizza &&
        activeCategory === "sauce" && (
          <SauceMetricsPanel
            metrics={sauceMetrics}
            shadowScore={sauceShadowScore}
            reference={referencePizza.sauce}
            isDispensing={isDispensingSauce}
            pieceMetrics={pieceShadowMetrics}
          />
        )}

      {state.phase === "PREPARE" && (
        <>
          {/* Issue #33 D1: DOUGH isn't a tray-selectable ingredient/category at all (see
              App.tsx's makingStepToCategory) -- the whole ingredient palette is hidden while
              it's the active step, reappearing exactly as before once SAUCE opens. */}
          {state.makingStep !== "DOUGH" && (
            <IngredientTray
              activeCategory={activeCategory}
              onChangeCategory={onChangeCategory}
              selectedIngredientId={selectedIngredientId}
              onSelectIngredient={onSelectIngredient}
              ownedIngredientIds={state.ownedIngredientIds}
              physicalDragEnabled={
                referenceModeEnabled && !isReferencePopoverOpen && !isGlobalOverlayOpen
              }
              draggableIngredientIds={["mozzarella", "basil"]}
              resolvePhysicalDrop={resolvePhysicalDrop}
              onPhysicalDrop={onPhysicalDrop}
              resetToken={pizzaResetToken}
              makingStepToken={state.makingStepToken}
            />
          )}
          {/* Human Feel Fix 3 (Fixed Bake CTA, brief section B): `.prepare-bake-bar` is
              `position: fixed` to the viewport (matching .app-frame's own centered max-width,
              see App.css), not the old `.action-row` + flex `margin-top: auto` this replaces
              -- that trick only pushes to the bottom of content that already fits the
              viewport, which is exactly what silently failed once PREPARE grew taller than
              844px (the bug this whole round exists to fix). `.ingredient-panel` reserves
              matching bottom padding so this bar can never cover the Palette above it.
              Issue #32 Phase 2 / Issue #33 D1: DOUGH/SAUCE/CHEESE each get an explicit "次へ"
              (next step) CTA that dispatches CONFIRM_MAKING_STEP -- TOPPING's forward action
              is the existing 焼く！ button, which doubles as TOPPING's own implicit confirm
              (no separate button needed: 焼く！ already leaves PREPARE entirely via
              START_BAKE). DOUGH's own 次へ is additionally disabled until
              `doughShapeComplete` (the task's own "size-only" completion gate) -- the only
              step whose CTA is ever disabled; SAUCE/CHEESE's has never been (no reducer-side
              completion gate exists for them either, by design). */}
          <div className="action-row prepare-bake-bar">
            <button type="button" className="secondary-button" onClick={handleResetPizza}>
              やり直す
            </button>
            {state.makingStep === "TOPPING" ? (
              <button type="button" className="cta-button cta-button--bake" onClick={onStartBake}>
                {"\u{1F525}"} 焼く！
              </button>
            ) : (
              <button
                type="button"
                className="cta-button cta-button--bake"
                onClick={onConfirmMakingStep}
                disabled={state.makingStep === "DOUGH" && !doughShapeComplete}
              >
                次へ {"→"}
              </button>
            )}
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

      {/* Phase 4A-2: Scoring 2.0 Shadow debug panel -- shown for both FREE and Lunch Rush
          RESULT (unlike ResultPanel/MissionServePanel above, this is not gated on
          isMissionActive), and internally gated on VITE_PREVIEW_MODE so production never
          renders it (see ScoringV2ShadowPanel.tsx's own file header). */}
      {state.phase === "RESULT" && <ScoringV2ShadowPanel result={state.scoringV2Shadow} />}

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
          {/* Issue #47 Finding D: two distinct actions replace the old single "もう一度作る"
              button, which always started a *different* recipe (PLAY_AGAIN's excludeRecipeId)
              despite reading like a retry. "もう一度つくる" now retries this exact recipe
              (RETRY_SAME_RECIPE); "別のピザを作る" returns to Pizza Select. */}
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={onRetrySameRecipe}
          >
            もう一度つくる
          </button>
          <button
            type="button"
            className="cta-button cta-button--secondary"
            onClick={onBackToPizzaSelect}
          >
            別のピザを作る
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
