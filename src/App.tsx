import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { PreviewBadge } from "./components/PreviewBadge";
import { GameScreen } from "./screens/GameScreen";
import { DexOverlay } from "./components/DexOverlay";
import { ShopOverlay } from "./components/ShopOverlay";
import { getReferencePizza } from "./data/referencePizza";
import { computeSauceMetrics, emptySauceMetrics } from "./logic/sauceField";
import { scorePiecesAgainstReference, scoreSauceAgainstReference } from "./logic/referenceScoring";
import { resolvePieceDrop } from "./logic/pieceDrag";
import type { DoughPoint } from "./logic/pizzaCoordinates";
import type { SauceDeposit } from "./state/pizzaState";
import { getIngredient, type Ingredient, type IngredientCategory } from "./data/ingredients";
import { createInitialGameState, gameReducer, type GameState } from "./state/gameReducer";
import { loadSave, loadMissionBest, persistProgress, persistMissionBest } from "./state/persistence";
import {
  DEFAULT_MISSION_CONFIG,
  LUNCH_RUSH_MISSION_ID,
  isMissionExpired,
  missionRunReducer,
  INITIAL_MISSION_STATE,
  type MissionConfig,
} from "./mission/lunchRush";
import { missionScore } from "./logic/missionScoring";
import { calculateMissionReward } from "./logic/economy";
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

/** Which top-level view is showing (Issue #24: HOME/GAME separation). Lives in App.tsx, not
 *  either screen -- both HomeScreen and GameScreen are pure views over the one GameState/
 *  MissionState this component owns, so which of the two is on screen is itself just more
 *  App-level UI state, the same way `isDexOpen`/`isShopOpen` already were pre-split. */
type Screen = "HOME" | "GAME";

const GO_HOME_CONFIRM_MESSAGE =
  "ピザ作りを中断してホームに戻りますか？作りかけのピザは失われます。";

function App() {
  // The round in progress never persists (ORDER/PREPARE/BAKE/RESULT always start fresh), but
  // Dex BEST/timesMade, owned ingredients, and Pitz balance do -- load them once on mount and
  // hydrate the initial state with them.
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const save = loadSave();
    return createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance);
  });
  // HOME is always the first screen shown (Issue #24 requirement) regardless of what round
  // hydration produced -- a resumed ORDER-phase round from a prior session is simply what
  // GAME shows once the player taps into it from HOME.
  const [screen, setScreen] = useState<Screen>("HOME");
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>("sauce");
  // Every order (including the very first one) should start the player off with the
  // recipe's own sauce selected, so PREPARE never opens with nothing selected.
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(() =>
    findPrimarySauceId(state.recipe),
  );
  const [isDexOpen, setDexOpen] = useState(false);
  const [isShopOpen, setShopOpen] = useState(false);
  // Phase 4A-1A (Post-Codex-Fix) MUST FIX 1/9: opening the Reference ("見本") popover must
  // abort any in-progress tomato-sauce dispense session, exactly like BAKE does -- lifted
  // here (rather than left as ReferencePreview's own local state) so `interactive` below can
  // fold it in, reusing PizzaStage's existing "interactive went false -> abort" effect
  // instead of adding a second, parallel abort mechanism.
  const [isReferencePopoverOpen, setReferencePopoverOpen] = useState(false);
  // Phase 4A-1A (Post-Codex-Fix) MUST FIX 7 -- Cancel Transaction: the current in-progress
  // dispense session's not-yet-committed deposits, mirrored up from PizzaStage purely so
  // Prototype Metrics can show live numbers while holding -- see handleDispenseProgress/
  // handleDispenseCommit below. Declared here (not lower, near those handlers) so the
  // lastOrderId reset block just below can safely clear it.
  const [pendingSauceDeposits, setPendingSauceDeposits] = useState<SauceDeposit[]>([]);
  const [liveBake, setLiveBake] = useState(0);
  const bakeFrameSkip = useRef(0);
  const pizzaDropTargetRef = useRef<HTMLDivElement | null>(null);

  const handleDoughElementChange = useCallback((element: HTMLDivElement | null) => {
    pizzaDropTargetRef.current = element;
  }, []);

  const resolvePhysicalDrop = useCallback((clientX: number, clientY: number) => {
    const element = pizzaDropTargetRef.current;
    return element ? resolvePieceDrop(clientX, clientY, element.getBoundingClientRect()) : null;
  }, []);

  // Every new order should start the player off with the recipe's own sauce selected,
  // so a fresh order never opens on a sauce that belongs to a different recipe.
  const [lastOrderId, setLastOrderId] = useState(state.order.id);
  if (lastOrderId !== state.order.id) {
    setLastOrderId(state.order.id);
    setSelectedIngredientId(findPrimarySauceId(state.recipe));
    setActiveCategory("sauce");
    // A leftover-open Reference popover from the previous round must never carry over --
    // it would otherwise hold `interactive` false on the fresh round for no visible reason.
    setReferencePopoverOpen(false);
    // Defensive: a fresh round's pizza is always empty, so any uncommitted dispense preview
    // from the previous round (which should already be [] by the time a round can end) must
    // never bleed into the new one's Prototype Metrics.
    setPendingSauceDeposits([]);
  }

  const [lastPhase, setLastPhase] = useState(state.phase);
  if (lastPhase !== state.phase) {
    setLastPhase(state.phase);
    if (state.phase === "BAKE") {
      setLiveBake(0);
    }
  }

  // Fires whenever any of GameState's own persisted progression fields change (Dex BEST/
  // timesMade, Pitz balance, owned ingredients) -- the reducer itself stays pure, this is the
  // one place that saves them (Phase 3C-5's canonical `persistProgress`, see
  // src/state/persistence.ts). `missionBest` is a separate concern, saved by its own effect
  // below.
  useEffect(() => {
    persistProgress({
      dex: state.dex,
      pitzBalance: state.pitzBalance,
      ownedIngredientIds: state.ownedIngredientIds,
    });
  }, [state.dex, state.pitzBalance, state.ownedIngredientIds]);

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

  // Grants this run's Pitz reward exactly once (Phase 3C-5). Deliberately does NOT rely on
  // this effect only ever firing once per run -- a rerender, React StrictMode's dev-only
  // double effect invocation, or opening/closing the Dex/Shop overlay can all cause this
  // effect body to run again while `mission.mode` is still "RESULT". Safety instead comes
  // from `CLAIM_MISSION_REWARD`'s own idempotency guard (src/state/gameReducer.ts): it's keyed
  // on `mission.runId` (a fresh id assigned by every START, retry included -- see
  // src/mission/lunchRush.ts), so dispatching the exact same runId+amount any number of times
  // only ever applies the first one. The reward amount itself
  // (`calculateMissionReward`, ../logic/economy.ts) is a pure function of `mission.metrics`,
  // which is frozen the instant `mode` becomes "RESULT" -- recomputing it here on every fire
  // always yields the same amount for the same run.
  useEffect(() => {
    if (mission.mode !== "RESULT") return;
    dispatch({
      type: "CLAIM_MISSION_REWARD",
      runId: mission.runId,
      amount: calculateMissionReward(mission.metrics),
    });
  }, [mission.mode, mission.runId, mission.metrics]);

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

  function handlePurchaseIngredient(ingredientId: string) {
    dispatch({ type: "PURCHASE_INGREDIENT", ingredientId });
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

  function handlePhysicalDrop(ingredient: Ingredient, point: DoughPoint) {
    setSelectedIngredientId(ingredient.id);
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }

  // Phase 4A-1A (Post-Codex-Fix) MUST FIX 7 -- Cancel Transaction: PizzaStage buffers every
  // dispense tick locally and only ever calls one of these two -- `onDispenseProgress` many
  // times per session (live preview, never touching canonical state) and
  // `onDispenseCommit` at most once, only from a *successful* pointerup. A cancelled/
  // discarded session calls neither commit nor leaves anything in `pendingSauceDeposits`
  // (PizzaStage always follows a discard with `onDispenseProgress([])`).
  function handleDispenseProgress(deposits: readonly SauceDeposit[]) {
    setPendingSauceDeposits(deposits as SauceDeposit[]);
  }

  function handleDispenseCommit(ingredientId: string, deposits: SauceDeposit[]) {
    dispatch({ type: "COMMIT_SAUCE_DISPENSE", ingredientId, deposits });
    setPendingSauceDeposits([]);
  }

  function handleBakeTick(value: number) {
    bakeFrameSkip.current += 1;
    if (bakeFrameSkip.current % 3 !== 0) return;
    setLiveBake(value);
  }

  // --- HOME / GAME navigation (Issue #24) -----------------------------------------------
  // A round only counts as "in progress" (and therefore worth confirming before it's
  // discarded) while the player has actually started building or is mid-Mission -- ORDER,
  // RESULT and DISCOVERED all reflect a completed or not-yet-started step, so leaving from
  // any of those loses nothing.
  function isRoundInProgress(): boolean {
    return (
      mission.mode === "PLAYING" ||
      (mission.mode === "FREE" && (state.phase === "PREPARE" || state.phase === "BAKE"))
    );
  }

  function handleGoHome() {
    if (isRoundInProgress() && !window.confirm(GO_HOME_CONFIRM_MESSAGE)) {
      return;
    }
    if (mission.mode !== "FREE") {
      // Also tidies up a lingering Mission Intro/Result overlay (no confirmation needed for
      // those -- nothing in-progress to lose there).
      exitMissionToFree();
    } else if (state.phase === "PREPARE" || state.phase === "BAKE") {
      dispatch({ type: "PLAY_AGAIN" });
    }
    setScreen("HOME");
  }

  function handleStartFreePlay() {
    // A completed round (RESULT/DISCOVERED) left over from before the player went back to
    // HOME must not resurface here -- "ピザを作る" always means "start a fresh pizza", not
    // "reopen whatever I last finished". `handleGoHome` deliberately leaves RESULT/DISCOVERED
    // alone when *leaving* GAME (nothing in-progress to confirm/lose there), so this is the
    // one place that resets it, right before GAME shows again. mission.mode is guaranteed
    // "FREE" here: HOME is only ever reached via `handleGoHome`, which always calls
    // `exitMissionToFree()` first when it isn't already FREE.
    if (state.phase === "RESULT" || state.phase === "DISCOVERED") {
      dispatch({ type: "PLAY_AGAIN" });
    }
    setScreen("GAME");
  }

  function handleStartLunchRush() {
    setScreen("GAME");
    missionDispatch({ type: "SHOW_INTRO" });
  }

  const bakeProgress =
    state.phase === "BAKE"
      ? liveBake
      : state.phase === "RESULT" || state.phase === "DISCOVERED"
        ? state.pizza.bakeResult
        : null;

  // Mirrors GameScreen's own `isMissionActive` derivation (mission.mode-based, cheap to
  // recompute) -- needed here too because `referenceModeEnabled` below must stay gated on it
  // regardless of which screen is currently showing.
  const isMissionActive = mission.mode === "PLAYING" || mission.mode === "RESULT";

  // Phase 4A-1A Scope Guard: the Reference Pizza / tomato-sauce dispenser / Prototype
  // Metrics are a shadow-only prototype for exactly one case -- FREE Margherita, never
  // Mission play, never any other recipe. `referencePizza` is null for every other recipe
  // (../data/referencePizza.ts), which alone would gate everything below it, but the
  // explicit `!isMissionActive` check keeps that true by construction even if a future
  // recipe reuses "margherita" during a Mission-only variant.
  const referencePizza = getReferencePizza(state.recipe.id);
  const referenceModeEnabled = referencePizza !== null && !isMissionActive;
  // Live metrics include the current in-progress dispense session's uncommitted deposits
  // (`pendingSauceDeposits`, MUST FIX 7) alongside canonical `state.pizza.sauceDeposits`, so
  // the Prototype Metrics panel updates in real time while holding -- without canonical game
  // state ever seeing the uncommitted stroke itself.
  const sauceMetrics = useMemo(
    () =>
      referenceModeEnabled
        ? computeSauceMetrics([...state.pizza.sauceDeposits, ...pendingSauceDeposits])
        : emptySauceMetrics(),
    [referenceModeEnabled, state.pizza.sauceDeposits, pendingSauceDeposits],
  );
  const sauceShadowScore = useMemo(
    () =>
      referencePizza
        ? scoreSauceAgainstReference(sauceMetrics, referencePizza.sauce)
        : { quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 },
    [referencePizza, sauceMetrics],
  );
  const pieceShadowMetrics = useMemo(
    () =>
      referencePizza
        ? scorePiecesAgainstReference(state.pizza.toppings, referencePizza.pieceGroups)
        : [],
    [referencePizza, state.pizza.toppings],
  );

  return (
    <div className="app-frame">
      <PreviewBadge />
      {screen === "HOME" && (
        <HomeScreen
          pitzBalance={state.pitzBalance}
          dex={state.dex}
          onStartFreePlay={handleStartFreePlay}
          onStartLunchRush={handleStartLunchRush}
          onOpenDex={() => setDexOpen(true)}
          onOpenShop={() => setShopOpen(true)}
        />
      )}

      {screen === "GAME" && (
        <GameScreen
          state={state}
          mission={mission}
          missionNow={missionNow}
          missionDurationSeconds={resolveMissionConfig().durationSeconds}
          missionBestAtStartOfRun={missionBestAtStartOfRun}
          activeCategory={activeCategory}
          selectedIngredientId={selectedIngredientId}
          bakeProgress={bakeProgress}
          referenceModeEnabled={referenceModeEnabled}
          referencePizza={referencePizza}
          isReferencePopoverOpen={isReferencePopoverOpen}
          isGlobalOverlayOpen={isDexOpen || isShopOpen}
          sauceMetrics={sauceMetrics}
          sauceShadowScore={sauceShadowScore}
          isDispensingSauce={pendingSauceDeposits.length > 0}
          pieceShadowMetrics={pieceShadowMetrics}
          onGoHome={handleGoHome}
          onOpenDex={() => setDexOpen(true)}
          onOpenShop={() => setShopOpen(true)}
          onBeginPrepare={() => dispatch({ type: "BEGIN_PREPARE" })}
          onShowMissionIntro={() => missionDispatch({ type: "SHOW_INTRO" })}
          onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
          onStartBake={() => dispatch({ type: "START_BAKE" })}
          onShowHint={() => dispatch({ type: "SHOW_HINT" })}
          onChangeCategory={handleChangeCategory}
          onSelectIngredient={handleSelectIngredient}
          onTapPizza={handleTapPizza}
          onBakeTick={handleBakeTick}
          onConfirmBake={(value) => dispatch({ type: "CONFIRM_BAKE", value })}
          onRegisterToDex={() => dispatch({ type: "REGISTER_TO_DEX" })}
          onPlayAgain={() => dispatch({ type: "PLAY_AGAIN" })}
          onMissionServeNext={handleMissionServeNext}
          onMissionStart={startMission}
          onMissionExitToFree={exitMissionToFree}
          onMissionCloseIntro={() => missionDispatch({ type: "EXIT_TO_FREE" })}
          onReferencePopoverChange={setReferencePopoverOpen}
          onDispenseProgress={handleDispenseProgress}
          onDispenseCommit={handleDispenseCommit}
          onDoughElementChange={handleDoughElementChange}
          resolvePhysicalDrop={resolvePhysicalDrop}
          onPhysicalDrop={handlePhysicalDrop}
        />
      )}

      {isDexOpen && (
        <DexOverlay
          dex={state.dex}
          newlyDiscoveredId={state.justDiscovered ? state.recipe.id : null}
          newBestRecipeId={!state.justDiscovered && state.justGotNewBest ? state.recipe.id : null}
          onClose={() => setDexOpen(false)}
        />
      )}

      {isShopOpen && (
        <ShopOverlay
          dex={state.dex}
          ownedIngredientIds={state.ownedIngredientIds}
          pitzBalance={state.pitzBalance}
          onPurchase={handlePurchaseIngredient}
          onClose={() => setShopOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
