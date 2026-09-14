import { useEffect, useReducer, useRef, useState } from "react";
import { DialogueBox } from "./components/DialogueBox";
import { PizzaStage } from "./components/PizzaStage";
import { IngredientTray } from "./components/IngredientTray";
import { BakeOverlay } from "./components/BakeOverlay";
import { ResultPanel } from "./components/ResultPanel";
import { DexOverlay } from "./components/DexOverlay";
import { MissionHud } from "./components/MissionHud";
import { MissionIntroOverlay } from "./components/MissionIntroOverlay";
import { MissionServePanel } from "./components/MissionServePanel";
import { MissionResultOverlay } from "./components/MissionResultOverlay";
import {
  buildBlueResultLine,
  buildMitoOrderLine,
  buildTetoBakeLine,
  buildTetoOrderLine,
  buildTetoResultLine,
  type DialogueLine,
} from "./data/dialogue";
import { getIngredient, type Ingredient, type IngredientCategory } from "./data/ingredients";
import { createInitialGameState, gameReducer, type GameState } from "./state/gameReducer";
import { discoveredRecipeIds } from "./state/dex";
import { loadSave, loadMissionBest, persistDex, persistMissionBest } from "./state/persistence";
import {
  DEFAULT_MISSION_CONFIG,
  LUNCH_RUSH_MISSION_ID,
  isMissionExpired,
  missionRunReducer,
  remainingSeconds,
  INITIAL_MISSION_STATE,
  type MissionConfig,
} from "./mission/lunchRush";
import { averageQualityScore, missionScore } from "./logic/missionScoring";
import "./App.css";

const MISSION_TICK_MS = 250;

/**
 * Production always runs the canonical 180s Lunch Rush duration. The only way to shorten it
 * is a `?missionDuration=` URL param gated behind `import.meta.env.DEV` -- Vite statically
 * replaces that check with `false` in a production build, so this whole branch (and the
 * shortened-duration code path) is dead-code-eliminated from what ships; it exists purely so
 * manual browser verification (Playwright, real device) doesn't have to sit through a real
 * 3-minute run. This is not a debug UI -- there is no on-screen control, only a URL param.
 */
function resolveMissionConfig(): MissionConfig {
  if (import.meta.env.DEV) {
    const override = Number(new URLSearchParams(window.location.search).get("missionDuration"));
    if (Number.isFinite(override) && override > 0) {
      return { durationSeconds: override };
    }
  }
  return DEFAULT_MISSION_CONFIG;
}

function findPrimarySauceId(recipe: GameState["recipe"]): string | null {
  const primarySauce = recipe.requiredIngredients.find(
    (req) => getIngredient(req.ingredientId)?.category === "sauce",
  );
  return primarySauce?.ingredientId ?? null;
}

function App() {
  // The round in progress never persists (ORDER/PREPARE/BAKE/RESULT always start fresh), but
  // Dex BEST/timesMade and owned ingredients do -- load them once on mount and hydrate the
  // initial state with them.
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const save = loadSave();
    return createInitialGameState(save.dex, save.ownedIngredientIds);
  });
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>("sauce");
  // Every order (including the very first one) should start the player off with the
  // recipe's own sauce selected, so PREPARE never opens with nothing selected.
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(() =>
    findPrimarySauceId(state.recipe),
  );
  const [isDexOpen, setDexOpen] = useState(false);
  const [liveBake, setLiveBake] = useState(0);
  const bakeFrameSkip = useRef(0);

  // Every new order should start the player off with the recipe's own sauce selected,
  // so a fresh order never opens on a sauce that belongs to a different recipe.
  const [lastOrderId, setLastOrderId] = useState(state.order.id);
  if (lastOrderId !== state.order.id) {
    setLastOrderId(state.order.id);
    setSelectedIngredientId(findPrimarySauceId(state.recipe));
    setActiveCategory("sauce");
  }

  const [lastPhase, setLastPhase] = useState(state.phase);
  if (lastPhase !== state.phase) {
    setLastPhase(state.phase);
    if (state.phase === "BAKE") {
      setLiveBake(0);
    }
  }

  // Only fires when the Dex reference actually changes (REGISTER_TO_DEX), not on every
  // render -- the reducer itself stays pure, this is the one place progression is saved.
  useEffect(() => {
    persistDex(state.dex);
  }, [state.dex]);

  // --- Lunch Rush mission (Phase 3C-4) --------------------------------------------------
  // A separate reducer, not a field on GameState: Mission run state (which screen, the
  // clock, served-this-run metrics) has no overlap with what GameState already tracks
  // (order/recipe/pizza/dex/ownedIngredientIds), so keeping it apart is a clean boundary,
  // not duplication -- see src/mission/lunchRush.ts's top comment.
  const [mission, missionDispatch] = useReducer(missionRunReducer, INITIAL_MISSION_STATE);
  // The persisted Mission BEST as of the *start* of the current/most recent run -- read fresh
  // from storage every time a run starts (see `startMission` below), not tracked as a
  // continuously-updated cache. This is purely a snapshot for the "NEW BEST!" comparison on
  // the eventual Mission Result screen: it deliberately does not move when the persistence
  // effect below writes a new BEST mid-run, so that comparison (and the badge it drives)
  // stays stable for the rest of this run instead of flickering off the instant it's written.
  const [missionBestAtStartOfRun, setMissionBestAtStartOfRun] = useState(() =>
    loadMissionBest(LUNCH_RUSH_MISSION_ID),
  );
  // Ticks a display timestamp roughly 4x/second while PLAYING, driving both the HUD's
  // countdown and the expiration check below. One interval, cleared whenever Mission stops
  // PLAYING -- never a per-second (or finer) setTimeout chain (SSOT section 4/14).
  const [missionNow, setMissionNow] = useState(() => Date.now());
  useEffect(() => {
    if (mission.mode !== "PLAYING") return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setMissionNow(now);
      missionDispatch({ type: "TICK", now });
    }, MISSION_TICK_MS);
    return () => window.clearInterval(id);
  }, [mission.mode]);

  // Persists the Mission BEST exactly once per run, the moment the run's own Result screen
  // appears -- mirrors the persistDex effect's "fires on the canonical state change" shape.
  // Talks only to storage (an external system), never back into local component state, so
  // this can't cascade into an extra render of its own.
  useEffect(() => {
    if (mission.mode !== "RESULT") return;
    persistMissionBest(LUNCH_RUSH_MISSION_ID, missionScore(mission.metrics));
  }, [mission.mode, mission.metrics]);

  // Canonical entry point for both a fresh Mission start (from Intro) and "もう一度"
  // (retry, from Result) -- both must behave identically. Codex review (PR #18, P2-2): the
  // Dex overlay has a higher z-index than Mission's own overlays, so if it was left open
  // when the previous run ended (Result covers it, but doesn't close it), it would resurface
  // on top of the *newly started* run the instant Result unmounts, with that run's timer
  // already counting down underneath. Force it closed here so neither entry point can leave
  // it open over a running Mission.
  function startMission() {
    setDexOpen(false);
    setMissionBestAtStartOfRun(loadMissionBest(LUNCH_RUSH_MISSION_ID));
    missionDispatch({ type: "START", now: Date.now(), config: resolveMissionConfig() });
    dispatch({ type: "MISSION_RESET_ORDER" });
  }

  function handleMissionServeNext() {
    if (!state.score) return;
    const now = Date.now();
    missionDispatch({ type: "SERVE", qualityTotal: state.score.total, now });
    // Mirrors missionRunReducer's own SERVE deadline check (Codex review, P2-1): a serve at
    // or after the deadline is rejected there (metrics untouched, run ends), so the
    // underlying round must likewise not be registered/advanced here -- it stays frozen at
    // RESULT with its score unregistered, exactly like a TICK-detected expiry would leave it.
    if (mission.clock && !isMissionExpired(now, mission.clock)) {
      dispatch({ type: "MISSION_NEXT_ORDER" });
    }
  }

  function exitMissionToFree() {
    missionDispatch({ type: "EXIT_TO_FREE" });
    dispatch({ type: "PLAY_AGAIN" });
  }

  function handleSelectIngredient(ingredient: Ingredient) {
    setSelectedIngredientId(ingredient.id);
  }

  function handleChangeCategory(category: IngredientCategory) {
    setActiveCategory(category);
  }

  function handleTapPizza(x: number, y: number) {
    if (!selectedIngredientId) return;
    const ingredient = getIngredient(selectedIngredientId);
    if (!ingredient) return;
    if (ingredient.placement === "spread") {
      dispatch({ type: "APPLY_SAUCE", ingredientId: ingredient.id, x, y });
    } else {
      dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x, y });
    }
  }

  function handleBakeTick(value: number) {
    bakeFrameSkip.current += 1;
    if (bakeFrameSkip.current % 3 !== 0) return;
    setLiveBake(value);
  }

  const bakeProgress =
    state.phase === "BAKE"
      ? liveBake
      : state.phase === "RESULT" || state.phase === "DISCOVERED"
        ? state.pizza.bakeResult
        : null;

  const orderLine = buildMitoOrderLine(
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

  return (
    <div className="app-frame">
      <header className="app-header">
        <h1 className="app-header__title">テトのピザ屋さん</h1>
        <button type="button" className="app-header__dex-button" onClick={() => setDexOpen(true)}>
          {"\u{1F4D6}"} レシピ図鑑
        </button>
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
            <DialogueBox {...orderLine} />
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
        interactive={state.phase === "PREPARE"}
        activeIngredient={selectedIngredientId ? (getIngredient(selectedIngredientId) ?? null) : null}
        bakeProgress={bakeProgress}
        placement={state.placement}
        resultRevealed={state.phase === "RESULT"}
        onTap={handleTapPizza}
      />

      {state.phase === "ORDER" && (
        <div className="action-row">
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={() => dispatch({ type: "BEGIN_PREPARE" })}
          >
            {mission.mode === "FREE" ? <>{"\u{1F355}"} フリープレイ</> : "ピザを作る！"}
          </button>
          {mission.mode === "FREE" && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => missionDispatch({ type: "SHOW_INTRO" })}
            >
              {"⏱"} Lunch Rush
            </button>
          )}
        </div>
      )}

      {state.phase === "PREPARE" && (
        <>
          <IngredientTray
            activeCategory={activeCategory}
            onChangeCategory={handleChangeCategory}
            selectedIngredientId={selectedIngredientId}
            onSelectIngredient={handleSelectIngredient}
          />
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatch({ type: "RESET_PIZZA" })}
            >
              やり直す
            </button>
            <button
              type="button"
              className="cta-button cta-button--bake"
              onClick={() => dispatch({ type: "START_BAKE" })}
            >
              {"\u{1F525}"} 焼く！
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => dispatch({ type: "SHOW_HINT" })}
            >
              ヒント
            </button>
          </div>
        </>
      )}

      {state.phase === "BAKE" && (
        <BakeOverlay
          targetStart={state.recipe.bakeTarget.start}
          targetEnd={state.recipe.bakeTarget.end}
          onConfirm={(value) => dispatch({ type: "CONFIRM_BAKE", value })}
          onTick={handleBakeTick}
        />
      )}

      {state.phase === "RESULT" && state.score && isMissionPlaying && (
        <MissionServePanel
          score={state.score}
          servedCount={mission.metrics.servedCount}
          onNext={handleMissionServeNext}
        />
      )}

      {state.phase === "RESULT" && state.score && !isMissionActive && (
        <ResultPanel
          score={state.score}
          bakeState={state.bakeState}
          onRegister={() => dispatch({ type: "REGISTER_TO_DEX" })}
        />
      )}

      {state.phase === "DISCOVERED" && (
        <div className="action-row action-row--column">
          {state.justDiscovered && (
            <p className="discovered-banner">{"✨"} {state.recipe.nameJa}を発見しました！</p>
          )}
          {!state.justDiscovered && state.justGotNewBest && (
            <p className="discovered-banner discovered-banner--best">{"🌟"} NEW BEST!</p>
          )}
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={() => dispatch({ type: "PLAY_AGAIN" })}
          >
            もう一度作る
          </button>
        </div>
      )}

      {isDexOpen && (
        <DexOverlay
          dex={state.dex}
          newlyDiscoveredId={state.justDiscovered ? state.recipe.id : null}
          newBestRecipeId={!state.justDiscovered && state.justGotNewBest ? state.recipe.id : null}
          onClose={() => setDexOpen(false)}
        />
      )}

      {mission.mode === "INTRO" && (
        <MissionIntroOverlay
          durationSeconds={resolveMissionConfig().durationSeconds}
          onStart={startMission}
          onClose={() => missionDispatch({ type: "EXIT_TO_FREE" })}
        />
      )}

      {mission.mode === "RESULT" && (
        <MissionResultOverlay
          servedCount={mission.metrics.servedCount}
          averageQuality={averageQualityScore(mission.metrics)}
          bestQuality={mission.metrics.bestQualityScore}
          score={missionScore(mission.metrics)}
          isNewBest={missionScore(mission.metrics) > missionBestAtStartOfRun}
          onRetry={startMission}
          onExit={exitMissionToFree}
        />
      )}
    </div>
  );
}

export default App;
