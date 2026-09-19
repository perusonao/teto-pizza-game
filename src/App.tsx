import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { PizzaSelectScreen } from "./screens/PizzaSelectScreen";
import { PreviewBadge } from "./components/PreviewBadge";
import { GameScreen } from "./screens/GameScreen";
import { DexOverlay } from "./components/DexOverlay";
import { ShopOverlay } from "./components/ShopOverlay";
import { InventoryOverlay } from "./components/InventoryOverlay";
import { getReferencePizza } from "./data/referencePizza";
import { computeSauceMetrics, emptySauceMetrics } from "./logic/sauceField";
import { scorePiecesAgainstReference, scoreSauceAgainstReference } from "./logic/referenceScoring";
import { resolvePieceDrop } from "./logic/pieceDrag";
import type { DoughPoint } from "./logic/pizzaCoordinates";
import type { SauceDeposit } from "./state/pizzaState";
import type { RecipeId } from "./data/recipes";
import { getIngredient, INGREDIENTS, type Ingredient, type IngredientCategory } from "./data/ingredients";
import { isDoughShapeComplete, type DoughShape } from "./logic/doughShape";
import { isAnyCookingTimingPauseReasonActive } from "./logic/cookingTiming";
import {
  createInitialGameState,
  gameReducer,
  type GameState,
  type MakingStep,
} from "./state/gameReducer";
import { loadSave, loadMissionBest, persistProgress, persistMissionBest } from "./state/persistence";
import { applyStarterGrants } from "./state/starterStock";
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

/** Issue #32 Phase 2: `activeCategory` is a *view* of the reducer's own `state.makingStep`,
 *  never the other way around -- the tray always shows the category for whichever making
 *  step is currently open (App.tsx no longer owns an independent, freely-switchable
 *  category selection). Issue #33 D1: DOUGH has no tray/`IngredientCategory` of its own --
 *  IngredientTray is hidden entirely while `makingStep === "DOUGH"` (see GameScreen.tsx), so
 *  this value is never actually rendered for it; "sauce" is a harmless placeholder purely to
 *  keep this a total function without inventing a new `IngredientCategory`/widening that
 *  shared type (Issue #33 D1 Risk 1: keep `IngredientCategory` untouched). */
function makingStepToCategory(step: MakingStep): IngredientCategory {
  switch (step) {
    case "DOUGH":
      return "sauce";
    case "SAUCE":
      return "sauce";
    case "CHEESE":
      return "cheese";
    case "TOPPING":
      return "topping";
  }
}

function findPrimarySauceId(recipe: GameState["recipe"]): string | null {
  const primarySauce = recipe.requiredIngredients.find(
    (req) => getIngredient(req.ingredientId)?.category === "sauce",
  );
  return primarySauce?.ingredientId ?? null;
}

/** Which top-level view is showing (Issue #24: HOME/GAME separation; Issue #39 adds
 *  PIZZA_SELECT between HOME and GAME for FREE). Lives in App.tsx, not any screen component --
 *  HomeScreen/PizzaSelectScreen/GameScreen are all pure views over the one GameState/
 *  MissionState this component owns, so which of the three is on screen is itself just more
 *  App-level UI state, the same way `isDexOpen`/`isShopOpen` already were pre-split. */
type Screen = "HOME" | "PIZZA_SELECT" | "GAME";

const GO_HOME_CONFIRM_MESSAGE =
  "ピザ作りを中断してホームに戻りますか？作りかけのピザは失われます。";

function App() {
  // The round in progress never persists (ORDER/PREPARE/BAKE/RESULT always start fresh), but
  // Dex BEST/timesMade, owned ingredients, and Pitz balance do -- load them once on mount and
  // hydrate the initial state with them.
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const save = loadSave();
    // Economy & Progression 1.0 EP4 migration catch-up: `recipeUnlocked` (src/state/
    // progression.ts) is purely a function of `dex`, so an existing player's save can already
    // show one or more Chapter 1 recipes unlocked (from play before this build ever shipped)
    // with no Starter Grant ever recorded for them (`starterGrantClaimedRecipeIds` reads back
    // empty for any pre-EP4 save -- see persistence.ts's own doc comment on that field). Running
    // `applyStarterGrants` once here, before `createInitialGameState`, backfills exactly those
    // recipes' Starter Stock so an existing player is never left holding an unlocked recipe they
    // still can't make even once -- and is a complete no-op (same reference back) for a save that
    // already has every currently-unlocked recipe's grant claimed, so it's safe to run
    // unconditionally on every load, not just an existing player's very first post-EP4 load.
    // `createInitialGameState` itself deliberately never does this (see its own doc comment) --
    // this load path is the one explicit call site.
    const grant = applyStarterGrants(
      save.dex,
      save.ownedIngredientIds,
      save.inventory,
      save.starterGrantClaimedRecipeIds,
    );
    return createInitialGameState(
      save.dex,
      grant.ownedIngredientIds,
      save.pitzBalance,
      grant.inventory,
      grant.claimedRecipeIds,
    );
  });
  // HOME is always the first screen shown (Issue #24 requirement) regardless of what round
  // hydration produced -- a resumed ORDER-phase round from a prior session is simply what
  // GAME shows once the player taps into it from HOME.
  const [screen, setScreen] = useState<Screen>("HOME");
  // Issue #32 Phase 2: derived, never independently set -- see makingStepToCategory's doc
  // comment above.
  const activeCategory = makingStepToCategory(state.makingStep);
  // Issue #33 D1: a fresh round now starts at DOUGH, which has no tray/selectable ingredient
  // at all -- nothing is pre-selected here any more. SAUCE's own "start with the recipe's
  // primary sauce already picked" behavior (unchanged) now fires from the `lastMakingStep`
  // sync below, the moment the round actually reaches SAUCE, instead of at round start.
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [isDexOpen, setDexOpen] = useState(false);
  const [isShopOpen, setShopOpen] = useState(false);
  const [isInventoryOpen, setInventoryOpen] = useState(false);
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
  // Issue #33 D1: mirrors `pendingSauceDeposits` exactly -- the current in-progress DOUGH
  // gesture's uncommitted shape, mirrored up from PizzaStage purely so the DOUGH step's CTA
  // can react to the size-completion threshold live, while dragging, without canonical game
  // state ever seeing an uncommitted gesture. `null` whenever no DOUGH gesture is active.
  const [pendingDoughShape, setPendingDoughShape] = useState<DoughShape | null>(null);
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
    // Issue #33 D1: a fresh round starts at DOUGH, not SAUCE -- nothing selectable yet (see
    // `selectedIngredientId`'s own declaration above).
    setSelectedIngredientId(null);
    // A leftover-open Reference popover from the previous round must never carry over --
    // it would otherwise hold `interactive` false on the fresh round for no visible reason.
    setReferencePopoverOpen(false);
    // Defensive: a fresh round's pizza is always empty, so any uncommitted dispense preview
    // from the previous round (which should already be [] by the time a round can end) must
    // never bleed into the new one's Prototype Metrics.
    setPendingSauceDeposits([]);
    setPendingDoughShape(null);
  }

  // Issue #32 Phase 2 / Issue #33 D1: a making-step confirmation (or a RESET_PIZZA, which
  // returns `makingStep` to "DOUGH") never carries the previous step's selection forward --
  // the tray only ever offers the new step's own category, so a stale selection would
  // otherwise sit unusable (or, worse, silently no-op the next tap since the reducer rejects
  // it) until the player explicitly picks something new from the tray. DOUGH/CHEESE/TOPPING
  // all start with nothing selected (tap-to-pick, unchanged); SAUCE is the one step that
  // starts with the recipe's own primary sauce already picked for the player -- previously
  // this ran once, at round start, back when SAUCE was itself the first step; now it fires
  // here instead, the moment the round actually reaches SAUCE (round start or a same-round
  // DOUGH -> SAUCE confirm alike). `lastOrderId`'s own sync above already handles a brand new
  // round's own reset, so this only fires for a same-round step change.
  const [lastMakingStep, setLastMakingStep] = useState(state.makingStep);
  if (lastMakingStep !== state.makingStep) {
    setLastMakingStep(state.makingStep);
    if (lastOrderId === state.order.id) {
      setSelectedIngredientId(state.makingStep === "SAUCE" ? findPrimarySauceId(state.recipe) : null);
    }
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
      inventory: state.inventory,
      starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    });
  }, [
    state.dex,
    state.pitzBalance,
    state.ownedIngredientIds,
    state.inventory,
    state.starterGrantClaimedRecipeIds,
  ]);

  // Cooking Time CT2: closes CT1's own deliberately-deferred gap -- the app being backgrounded
  // (iOS home-screen swipe / app switch, browser tab switch, alt-tab) must not silently keep
  // billing Cooking Time while the player isn't even looking at the screen. Tracks
  // `document.visibilitychange` and `window` `blur`/`focus` as two independent booleans (a
  // mobile Safari backgrounding fires both roughly together, a desktop alt-tab may fire only
  // `blur`) rather than one merged handler, so neither signal going stale on its own platform
  // can mask the other.
  const [isDocumentHidden, setDocumentHidden] = useState(() => document.hidden);
  const [isWindowBlurred, setWindowBlurred] = useState(false);
  useEffect(() => {
    const handleVisibilityChange = () => setDocumentHidden(document.hidden);
    const handleBlur = () => setWindowBlurred(true);
    const handleFocus = () => setWindowBlurred(false);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Cooking Time CT1/CT2: the pause boundary (see the Fresh Audit report's §2.2 and
  // gameReducer.ts's GameAction doc comment) -- CT1 covered `isReferencePopoverOpen`/
  // `isGlobalOverlayOpen` only (the Reference popover and the Dex/Shop/Inventory overlays);
  // CT2 adds the background signals above into the same combined boolean via
  // `isAnyCookingTimingPauseReasonActive` (../logic/cookingTiming.ts). This is still a single
  // OR, not a reason-`Set`/counter, and that is deliberately enough: because every reason feeds
  // this one signal and the effect below only dispatches on *its* transitions, an overlapping
  // case -- Reference open -> app backgrounds -> foregrounds -> Reference still open -- can
  // never resume early. The combined value only flips to `false` once every reason is `false`
  // at the same time, regardless of the order they toggled in. A no-op whenever `cookingTiming`
  // isn't running (Mission rounds, or FREE outside PREPARE) since PAUSE/RESUME_COOKING_TIMING's
  // own reducer guards already handle that; this effect only needs to track the transitions.
  const isCookingTimingPauseSignal = isAnyCookingTimingPauseReasonActive(
    isReferencePopoverOpen,
    isDexOpen,
    isShopOpen,
    isInventoryOpen,
    isDocumentHidden,
    isWindowBlurred,
  );
  const wasCookingTimingPausedRef = useRef(false);
  useEffect(() => {
    if (isCookingTimingPauseSignal === wasCookingTimingPausedRef.current) return;
    wasCookingTimingPausedRef.current = isCookingTimingPauseSignal;
    const now = Date.now();
    if (isCookingTimingPauseSignal) {
      dispatch({ type: "PAUSE_COOKING_TIMING", now });
    } else {
      dispatch({ type: "RESUME_COOKING_TIMING", now });
    }
  }, [isCookingTimingPauseSignal]);

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

  // RESULT 2.0 Slice 1: FREE's Dex/BEST/Pitz registration (REGISTER_TO_DEX) used to be a
  // separate player-facing "レシピ図鑑に登録する" tap between two phases (RESULT -> DISCOVERED).
  // That two-step bureaucratic-feeling flow is gone -- this dispatches both actions back to
  // back in the same handler, so useReducer applies REGISTER_TO_DEX against the state
  // CONFIRM_BAKE just produced (phase: "RESULT", state.score set) before anything renders.
  // REGISTER_TO_DEX itself, its exactly-once phase guard, and the Pitz/BEST/Dex reducer logic
  // it runs (../state/gameReducer.ts) are completely unchanged -- only the trigger moved from
  // a button's onClick to this orchestration point. Guarded on `!state.isMissionRound` (the
  // same flag REGISTER_TO_DEX's own Pitz-credit branch already reads) so a Mission round's
  // CONFIRM_BAKE never also fires this -- Lunch Rush keeps registering exclusively via its own
  // MISSION_NEXT_ORDER/MISSION_SERVE path, untouched by this change.
  function handleConfirmBake(value: number) {
    dispatch({ type: "CONFIRM_BAKE", value });
    if (!state.isMissionRound) {
      dispatch({ type: "REGISTER_TO_DEX" });
    }
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
      // Issue #85 UX-1: MISSION_NEXT_ORDER always lands at a fresh phase "ORDER"
      // (gameReducer.ts's buildOrderState), which used to wait for a second, redundant
      // 「ピザを作る！」 tap before PREPARE reopened. React 18 batches same-tick dispatches (this
      // mirrors handleConfirmBake's own back-to-back CONFIRM_BAKE + REGISTER_TO_DEX above), so
      // this never renders the ORDER screen -- it advances straight to PREPARE, the same way
      // SELECT_RECIPE/RETRY_SAME_RECIPE already skip it (gameReducer.ts's startPreparingRecipe).
      // FREE's own onBeginPrepare/ORDER gate is a separate call site, untouched by this.
      // Cooking Time CT1: `now` is passed here too, but MISSION_NEXT_ORDER above already set
      // `isMissionRound: true` before this reducer case runs, so it stays a no-op --
      // Lunch Rush never accumulates a Cooking Time of its own.
      dispatch({ type: "BEGIN_PREPARE", now: Date.now() });
    }
  }

  function exitMissionToFree() {
    missionDispatch({ type: "EXIT_TO_FREE" });
    dispatch({ type: "PLAY_AGAIN" });
  }

  function handlePurchaseIngredient(ingredientId: string) {
    dispatch({ type: "PURCHASE_INGREDIENT", ingredientId });
  }

  // Economy & Progression 1.0 EP3: a separate dispatch from handlePurchaseIngredient above --
  // see gameReducer.ts's RESTOCK_INGREDIENT case for why the two transactions stay distinct.
  function handleRestockIngredient(ingredientId: string) {
    dispatch({ type: "RESTOCK_INGREDIENT", ingredientId });
  }

  function handleSelectIngredient(ingredient: Ingredient) {
    setSelectedIngredientId(ingredient.id);
  }

  // Issue #32 Phase 2: `activeCategory` is derived from `state.makingStep` (see
  // makingStepToCategory above) -- tabs no longer freely switch, so there is nothing left for
  // a category-tab click to do. IngredientTray still calls this (its own tabs stay disabled
  // for every category but the current step, see IngredientTray.tsx), so this is kept as an
  // explicit no-op rather than removed, to make that "does nothing" intentional rather than
  // an unwired prop.
  function handleChangeCategory(_category: IngredientCategory) {}

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

  // Issue #33 D1: mirrors handleDispenseProgress/handleDispenseCommit exactly -- see
  // PizzaStageProps' own doc comments for the full contract.
  function handleDoughStretchProgress(shape: DoughShape | null) {
    setPendingDoughShape(shape);
  }

  function handleDoughStretchCommit(shape: DoughShape) {
    dispatch({ type: "COMMIT_DOUGH_STRETCH", shape });
    setPendingDoughShape(null);
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
  // any of those loses nothing. Issue #47 Finding C: SELECT_RECIPE/RETRY_SAME_RECIPE now land
  // straight at PREPARE with a still-untouched round (no more intermediate ORDER tap), so
  // PREPARE alone no longer implies anything would actually be lost -- also require the round
  // to have actually moved (past the DOUGH making step, or with sauce/toppings already on the
  // pizza -- Issue #33 D1: DOUGH is now the first step, replacing SAUCE here). BAKE is
  // unconditional: reaching it always means TOPPING was confirmed, a real step worth
  // confirming before discarding.
  function isRoundInProgress(): boolean {
    const hasStartedPreparing =
      state.makingStep !== "DOUGH" ||
      state.pizza.sauceIds.length > 0 ||
      state.pizza.toppings.length > 0;
    return (
      mission.mode === "PLAYING" ||
      (mission.mode === "FREE" &&
        (state.phase === "BAKE" || (state.phase === "PREPARE" && hasStartedPreparing)))
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

  // Issue #39: 「ピザを作る」no longer drops straight into GAME/ORDER with whatever recipe
  // random selection last landed on -- it goes to Pizza Select first, so the player picks the
  // recipe explicitly (see handleSelectRecipe below). No stale-RESULT reset is needed here
  // (unlike the old direct-to-GAME behavior this replaces): SELECT_RECIPE always builds a
  // fresh ORDER-phase round via buildOrderState regardless of whatever phase the previous
  // round was left in.
  function handleStartFreePlay() {
    setScreen("PIZZA_SELECT");
  }

  // Pizza Select's card tap -- starts a fresh FREE round for the explicitly chosen recipe
  // (SELECT_RECIPE, src/state/gameReducer.ts) and enters GAME. The reducer itself re-checks
  // availability, so a locked recipe can never start a round even via a stray dispatch; the
  // UI-level guard is PizzaSelectScreen's LOCKED cards never wiring this callback at all.
  function handleSelectRecipe(recipeId: RecipeId) {
    dispatch({ type: "SELECT_RECIPE", recipeId, now: Date.now() });
    setScreen("GAME");
  }

  // Pizza Select's own back button. No confirmation needed -- Pizza Select never has an
  // in-progress round of its own to lose (mirrors leaving ORDER/RESULT today), and this must
  // not reuse `handleGoHome`'s Mission-exit branch, which is irrelevant here since Pizza
  // Select is only reachable while `mission.mode` is already "FREE".
  function handleBackFromPizzaSelect() {
    setScreen("HOME");
  }

  // Issue #47 Finding D: DISCOVERED's "別のピザを作る" -- same destination/no-confirmation
  // shape as HOME's own 「ピザを作る」 entry point (handleStartFreePlay); DISCOVERED has
  // nothing in-progress to lose, mirroring handleGoHome's own isRoundInProgress() exemption
  // for DISCOVERED.
  function handleBackToPizzaSelectFromDiscovered() {
    setScreen("PIZZA_SELECT");
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

  // Issue #33 D1: the dough boundary only starts rendering/clipping `.pizza-dough` once the
  // round has actually entered PREPARE (or later) -- ORDER's own pre-existing plain-circle
  // dough preview (shown before Lunch Rush's own "ピザを作る！" tap) is untouched.
  const showDoughShape = state.phase !== "ORDER";
  // Live size-completion gate for the DOUGH step's own CTA (GameScreen): includes the
  // current in-progress gesture's uncommitted shape (`pendingDoughShape`) alongside the
  // canonical committed one, mirroring `sauceMetrics`' own live-preview pattern above, so the
  // CTA can unlock mid-drag rather than only after the player releases.
  const doughShapeComplete = useMemo(
    () => isDoughShapeComplete(pendingDoughShape ?? state.pizza.doughShape),
    [pendingDoughShape, state.pizza.doughShape],
  );

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
          ownedIngredientCount={state.ownedIngredientIds.length}
          totalIngredientCount={INGREDIENTS.length}
          onStartFreePlay={handleStartFreePlay}
          onStartLunchRush={handleStartLunchRush}
          onOpenDex={() => setDexOpen(true)}
          onOpenShop={() => setShopOpen(true)}
          onOpenInventory={() => setInventoryOpen(true)}
        />
      )}

      {screen === "PIZZA_SELECT" && (
        <PizzaSelectScreen
          dex={state.dex}
          ownedIngredientIds={state.ownedIngredientIds}
          onSelectRecipe={handleSelectRecipe}
          onBack={handleBackFromPizzaSelect}
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
          isGlobalOverlayOpen={isDexOpen || isShopOpen || isInventoryOpen}
          sauceMetrics={sauceMetrics}
          sauceShadowScore={sauceShadowScore}
          isDispensingSauce={pendingSauceDeposits.length > 0}
          pieceShadowMetrics={pieceShadowMetrics}
          showDoughShape={showDoughShape}
          doughShapeComplete={doughShapeComplete}
          onGoHome={handleGoHome}
          onBeginPrepare={() => dispatch({ type: "BEGIN_PREPARE", now: Date.now() })}
          onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
          onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
          onStartBake={() => dispatch({ type: "START_BAKE", now: Date.now() })}
          onShowHint={() => dispatch({ type: "SHOW_HINT" })}
          onChangeCategory={handleChangeCategory}
          onSelectIngredient={handleSelectIngredient}
          onTapPizza={handleTapPizza}
          onBakeTick={handleBakeTick}
          onConfirmBake={handleConfirmBake}
          onRetrySameRecipe={() => dispatch({ type: "RETRY_SAME_RECIPE", now: Date.now() })}
          onBackToPizzaSelect={handleBackToPizzaSelectFromDiscovered}
          onMissionServeNext={handleMissionServeNext}
          onMissionStart={startMission}
          onMissionExitToFree={exitMissionToFree}
          onMissionCloseIntro={() => missionDispatch({ type: "EXIT_TO_FREE" })}
          onReferencePopoverChange={setReferencePopoverOpen}
          onDispenseProgress={handleDispenseProgress}
          onDispenseCommit={handleDispenseCommit}
          onDoughStretchProgress={handleDoughStretchProgress}
          onDoughStretchCommit={handleDoughStretchCommit}
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
          inventory={state.inventory}
          onPurchase={handlePurchaseIngredient}
          onRestock={handleRestockIngredient}
          onClose={() => setShopOpen(false)}
        />
      )}

      {isInventoryOpen && (
        <InventoryOverlay
          ownedIngredientIds={state.ownedIngredientIds}
          inventory={state.inventory}
          onClose={() => setInventoryOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
