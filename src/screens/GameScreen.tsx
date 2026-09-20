import { useState } from "react";
import { DialogueBox } from "../components/DialogueBox";
import { PizzaStage } from "../components/PizzaStage";
import { IngredientTray } from "../components/IngredientTray";
import { MakingStepTabs } from "../components/MakingStepTabs";
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
import { ScoringV2DebugPanel } from "../components/ScoringV2DebugPanel";
import type { ReferencePizza } from "../data/referencePizza";
import { getPlayerReferencePizza } from "../data/playerReference";
import type { SauceMetrics } from "../logic/sauceField";
import type { SauceReferenceShadowScore } from "../logic/referenceScoring";
import type { SauceDeposit } from "../state/pizzaState";
import type { DoughShape } from "../logic/doughShape";
import {
  buildMitoOrderLine,
  buildTetoBakeLine,
  buildTetoOrderLine,
  buildTetoResultLine,
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
  /** Firebase Ranking 1.0 Phase 2A (Issue #87): opens WeeklyRankingOverlay, rendered at
   *  App.tsx's own top level (mirrors onOpenDex/onOpenShop) rather than inside GameScreen --
   *  see App.tsx's `isRankingOpen` state. */
  onShowRanking: () => void;
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
  onRetrySameRecipe,
  onBackToPizzaSelect,
  onMissionServeNext,
  onMissionStart,
  onMissionExitToFree,
  onMissionCloseIntro,
  onShowRanking,
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

  // Issue #86 (UX-2): the single gate for "may the immediate next making step be entered right
  // now" -- computed once here and shared by both MakingStepTabs (its own next-tab tappability)
  // and the 「次へ」 CTA's own `disabled` attribute below, so the one existing UI-only completion
  // rule (DOUGH's `doughShapeComplete`, the reducer itself never gates CONFIRM_MAKING_STEP on
  // completion -- see onewayFlow.test.ts) is defined in exactly one place, never duplicated.
  // SAUCE/CHEESE have no completion gate today, so this is unconditionally true for them.
  const nextStepReady = state.makingStep !== "DOUGH" || doughShapeComplete;

  const isMissionPlaying = mission.mode === "PLAYING";
  // Free play's own RESULT dialogue/ResultPanel are gated on this, not just `!isMissionPlaying`
  // -- once a run's timer expires mid-round, `mission.mode` flips straight to "RESULT" while
  // `state.phase` can still be sitting at "RESULT" (or PREPARE/BAKE) from the interrupted
  // round. `MissionResultOverlay` covers the whole screen either way, but this keeps free
  // play's own RESULT UI from rendering (uselessly) underneath it during that window.
  const isMissionActive = mission.mode === "PLAYING" || mission.mode === "RESULT";
  // RESULT 2.0 Slice 1: REGISTER_TO_DEX now applies automatically the instant CONFIRM_BAKE
  // lands (App.tsx's `handleConfirmBake`), so a FREE round's `state.phase` goes straight from
  // "BAKE" to "DISCOVERED" -- there is no longer a player-visible moment where phase sits at
  // "RESULT" alone for FREE (Mission is untouched: MissionServePanel/MissionResultOverlay
  // still read `state.phase === "RESULT"` exactly as before). This single flag gates the one
  // merged Hero result screen for both of FREE's internal phases, so a stray/interrupted
  // dispatch that somehow leaves phase at "RESULT" (e.g. a failed REGISTER_TO_DEX guard) still
  // renders a complete screen instead of the old score-only one.
  const isFreeResultScreen =
    !isMissionActive && (state.phase === "RESULT" || state.phase === "DISCOVERED");

  const mitoOrderLine = buildMitoOrderLine(
    state.order.id,
    state.order.lineJa,
    state.recipe,
    discoveredRecipeIds(state.dex),
  );

  // RESULT 2.0 Slice 1: Teto's existing short reaction line (`buildTetoResultLine`, unchanged
  // -- same authored-variant-line pattern, same seeding) is now the merged screen's own short
  // heading (`ResultPanel`'s `headingJa`), rendered directly under the completed-pizza hero
  // instead of in a separate two-portrait DialogueBox stack above it. Blue's longer reaction
  // line is dropped from this screen (not from `dialogue.ts` -- still a pure, independently
  // testable function) to keep the merged screen to one short line, per the task's own "短い
  // RESULT heading" requirement.
  // Completion Gate Phase 1: a FAILED round never computes this quality-based reaction line --
  // ResultPanel renders its own "失敗" heading instead once `state.completion` is FAILED (see
  // its own file header), so a congratulatory/neutral bake line can never appear alongside a
  // pizza that was never actually servable.
  const resultHeadingJa =
    isFreeResultScreen && state.score && state.bakeState && state.completion?.status !== "FAILED"
      ? buildTetoResultLine(state.recipe, state.bakeState, state.pizza.bakeResult).textJa
      : "";

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

      {/* RESULT 2.0 Slice 1: the merged Hero result screen (`isFreeResultScreen`) renders its
          own short heading (`resultHeadingJa`, fed to `ResultPanel`) directly under the
          completed-pizza hero instead of here -- skipping this whole section for that screen,
          not just its old RESULT/DISCOVERED-specific content, reclaims the `.dialogue-area`'s
          `min-height: 84px` reserved space so the hero pizza is the first thing on screen
          (the task's own "完成ピザを押し下げない" requirement), rather than leaving an empty
          gap above it. ORDER/BAKE dialogue is completely unaffected, Mission or not. */}
      {state.phase !== "PREPARE" && !isFreeResultScreen && (
        <section className="dialogue-area">
          {state.phase === "ORDER" && (
            <>
              <DialogueBox {...mitoOrderLine} />
              <DialogueBox {...buildTetoOrderLine(state.recipe)} />
            </>
          )}
          {state.phase === "BAKE" && <DialogueBox {...buildTetoBakeLine(state.recipe)} />}
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
      {/* Issue #86 (UX-2): the primary making-step navigation, replacing "next-only" CTA
          navigation as the way a player understands which step they're on and which is next.
          Rendered for every PREPARE step, including DOUGH (which had no tab of its own before
          this -- see MakingStepTabs.tsx's own header comment for the full SSOT contract). The
          pre-existing 「次へ」/「焼く！」 CTA bar below stays as an auxiliary control, unchanged. */}
      {state.phase === "PREPARE" && (
        <MakingStepTabs
          currentStep={state.makingStep}
          nextReady={nextStepReady}
          onAdvance={onConfirmMakingStep}
        />
      )}

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
        resultRevealed={isFreeResultScreen}
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
              recipe={state.recipe}
              inventory={state.inventory}
              pizza={state.pizza}
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
                disabled={!nextStepReady}
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

      {state.phase === "RESULT" && state.score && state.completion && isMissionPlaying && (
        <MissionServePanel
          score={state.score}
          servedCount={mission.metrics.servedCount}
          completion={state.completion}
          onNext={onMissionServeNext}
        />
      )}

      {/* RESULT 2.0 Slice 1: one merged Hero result screen replaces the old two-phase
          ResultPanel (RESULT, score/stars only, behind a "レシピ図鑑に登録する" tap) +
          DISCOVERED (a separate action-row for the banner/Pitz/retry CTAs) split. The
          underlying phase split and REGISTER_TO_DEX's reducer transaction are both unchanged
          (see App.tsx's `handleConfirmBake` and ../state/gameReducer.ts) -- this only merges
          what was already, by the time a player could see it, always-together information
          into one component. Issue #47 Finding D's two retry CTAs are unchanged. */}
      {isFreeResultScreen && state.score && (
        <ResultPanel
          completion={state.completion}
          score={state.score}
          bakeState={state.bakeState}
          sauceScore={
            state.scoringV2Result?.components.sauce.available
              ? state.scoringV2Result.components.sauce.score
              : null
          }
          headingJa={resultHeadingJa}
          recipeNameJa={state.recipe.nameJa}
          justDiscovered={state.justDiscovered}
          justGotNewBest={state.justGotNewBest}
          pitzCredit={state.lastPitzCredit}
          efficiencyCredit={state.lastEfficiencyCredit}
          starterGrantNotice={state.lastStarterGrantNotice}
          onRetrySameRecipe={onRetrySameRecipe}
          onBackToPizzaSelect={onBackToPizzaSelect}
        />
      )}

      {/* Phase 4A-2 / A1: Scoring 2.0 debug panel (Preview-only internal breakdown) -- shown
          for both FREE and Lunch Rush RESULT, and internally gated on VITE_PREVIEW_MODE so
          production never renders it (see ScoringV2DebugPanel.tsx's own file header). RESULT
          2.0 Slice 1: FREE's own RESULT/DISCOVERED are now merged (`isFreeResultScreen`) --
          Mission's still-separate RESULT (`isMissionPlaying`, MissionServePanel) is unchanged. */}
      {(isFreeResultScreen || (state.phase === "RESULT" && isMissionPlaying)) && (
        <ScoringV2DebugPanel result={state.scoringV2Result} />
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
          onShowRanking={onShowRanking}
        />
      )}
    </div>
  );
}
