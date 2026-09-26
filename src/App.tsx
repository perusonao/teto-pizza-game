import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { PizzaSelectScreen } from "./screens/PizzaSelectScreen";
import { PreviewBadge } from "./components/PreviewBadge";
import { GameScreen } from "./screens/GameScreen";
import { DexOverlay } from "./components/DexOverlay";
import { ShopOverlay } from "./components/ShopOverlay";
import { InventoryOverlay } from "./components/InventoryOverlay";
import { SettingsOverlay } from "./components/SettingsOverlay";
import { WeeklyRankingOverlay } from "./components/WeeklyRankingOverlay";
import { getReferencePizza } from "./data/referencePizza";
import { computeSauceMetrics, emptySauceMetrics } from "./logic/sauceField";
import { scorePiecesAgainstReference, scoreSauceAgainstReference } from "./logic/referenceScoring";
import { resolvePieceDrop } from "./logic/pieceDrag";
import type { DoughPoint } from "./logic/pizzaCoordinates";
import type { CutLine } from "./logic/cut/types";
import { isDuplicateCutLine } from "./logic/cut/geometry";
import type { SauceDeposit } from "./state/pizzaState";
import { RECIPES, type RecipeId } from "./data/recipes";
import { getIngredient, type Ingredient, type IngredientCategory } from "./data/ingredients";
import { isDoughShapeComplete, type DoughShape } from "./logic/doughShape";
import { isAnyCookingTimingPauseReasonActive } from "./logic/cookingTiming";
import {
  createInitialGameState,
  gameReducer,
  type GameState,
  type MakingStep,
} from "./state/gameReducer";
import {
  loadSave,
  loadMissionBest,
  persistProgress,
  persistMissionBest,
  resetSave,
} from "./state/persistence";
import { ingredientCollectionCount, newShopMaterialCount, resolveShopEntitlement } from "./state/materialEntitlement";
import { ensureAnonymousUser, isFirebaseAvailable, submitLunchRushScore } from "./firebase";
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
import { canStartGuidedRound, countRecipeDiscoveryStates } from "./state/recipeDiscoveryState";
import "./App.css";

const MISSION_TICK_MS = 250;

/** Pizza Cutting 1.0 Phase 4A: how long a duplicate-cut-line rejection message stays visible
 *  before auto-clearing -- long enough to read in one glance, short enough to never linger past
 *  the player's next attempt. */
const CUT_DUPLICATE_REJECTION_MESSAGE_MS = 1800;

/** Same tone as ../data/completionMessages.ts's own short, plain FAILED-reason copy -- one
 *  concrete, non-blaming sentence, no jargon (never "angular separation"/"duplicate"). */
const CUT_DUPLICATE_LINE_MESSAGE = "同じ位置には切れません";

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
 *  shared type (Issue #33 D1 Risk 1: keep `IngredientCategory` untouched).
 *
 *  Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8): `default`
 *  covers the five widened `MakingStep` values (CUT/FOLD/SEAL/EDGE_FILL/FINISH) with the same
 *  harmless "topping" placeholder DOUGH already used above -- no `CookingProfile` for any of the
 *  15 shipped recipes ever produces one of these, and `IngredientTray` (the only consumer of
 *  `activeCategory`) is hidden outside PREPARE, so this is exactly as unreachable as DOUGH's own
 *  placeholder was before this phase, kept a total function ahead of each step's own UI. */
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
    default:
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
    // Progression 2.0 W1 Integration I4b-3 (REC-04; replaces EP4's load-time Starter Grant
    // catch-up, which is retired): resolve the Discovery Ladder once on load, before
    // `createInitialGameState`. For an existing save this is the migration -- the Shop
    // entitlement becomes the stored ledger + every finite material already OWNED (EP4-granted
    // ones included, stock untouched) + the ladder materials reached at the Dex discovered count;
    // anything newly entitled starts at stock 0. Nothing is granted and
    // `starterGrantClaimedRecipeIds` is carried through unchanged (so a rollback to a pre-I4b
    // build never re-grants a claimed recipe). A complete no-op for an up-to-date save.
    const entitlement = resolveShopEntitlement(
      save.dex,
      save.ownedIngredientIds,
      save.unlockedForShopIngredientIds,
    );
    return createInitialGameState(
      save.dex,
      save.ownedIngredientIds,
      save.pitzBalance,
      save.inventory,
      save.starterGrantClaimedRecipeIds,
      entitlement.unlockedForShopIngredientIds,
    );
  });
  // HOME is always the first screen shown (Issue #24 requirement) regardless of what round
  // hydration produced -- a resumed ORDER-phase round from a prior session is simply what
  // GAME shows once the player taps into it from HOME.
  const [screen, setScreen] = useState<Screen>("HOME");
  // Progression 2.0 Phase 3-3 (Issue #198): true once the player has discovered any recipe at
  // all -- gates Lunch Rush (HOME's own button + handleStartLunchRush below) until the player's
  // first discovery. Derived, never independently stored, same discipline as `activeCategory`.
  const hasAnyDiscovery = state.dex.some((entry) => entry.discovered);
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
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  // Firebase Ranking 1.0 Phase 2A (Issue #87): WeeklyRankingOverlay's open/closed state -- same
  // App-level useState shape as isDexOpen/isShopOpen/isInventoryOpen/isSettingsOpen above.
  // Originally opened only from Lunch Rush RESULT (MissionResultOverlay's own "ランキングを見る"
  // button, threaded through GameScreen's onShowRanking prop); HOME Weekly Ranking route now
  // opens the exact same state from HomeScreen's onOpenRanking prop too -- one overlay, one
  // fetch path, two entry points. WeeklyRankingOverlay is rendered once, outside the `screen`
  // switch below (same pattern as the Dex/Shop/Inventory/Settings overlays), so closing it just
  // reveals whichever screen (HOME or GAME) was already showing underneath -- no extra
  // navigation state needed to "return" to the right place.
  const [isRankingOpen, setRankingOpen] = useState(false);
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
  // Pizza Cutting 1.0 Phase 4A (design doc §2.2/Phase 4 Fresh Audit §5B): a short-lived, local-
  // only rejection message for a near-duplicate CUT line -- never part of `GameState` (the
  // reducer's own `ADD_CUT_LINE` rejection is a pure, silent no-op, matching every other
  // "reject at the source" gate in this app; the *user-facing* message is purely a gesture-layer
  // concern, mirroring `pendingSauceDeposits`/`pendingDoughShape`'s own "mirrored up from a
  // gesture, canonical state never sees it" pattern). Cleared automatically after a short delay
  // and on every CUT step (re-)entry/exit below.
  const [cutRejectionMessage, setCutRejectionMessage] = useState<string | null>(null);
  const cutRejectionTimeoutRef = useRef<number | null>(null);
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
    // Pizza Cutting 1.0 Phase 4A: a duplicate-line rejection message never survives past the CUT
    // step it was shown in -- entering CUT fresh (a new round) or leaving it (confirm) both
    // clear it, so it can never reappear stale on a later round. Mirrors `setSelectedIngredientId`
    // just above: plain derived-state-during-render, same as every other reset in this block.
    setCutRejectionMessage(null);
  }

  // Cancels any still-pending auto-clear timeout from a rejection shown *before* this step
  // change, so it can never fire later and clear a different, freshly-shown rejection message
  // from a subsequent CUT attempt. Pure cleanup, no `setState` call -- kept in its own effect
  // (rather than the render-phase block above) purely because a ref read/write belongs in an
  // effect/event handler, never directly in the render body.
  useEffect(() => {
    return () => {
      if (cutRejectionTimeoutRef.current !== null) {
        window.clearTimeout(cutRejectionTimeoutRef.current);
        cutRejectionTimeoutRef.current = null;
      }
    };
  }, [state.makingStep]);

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
      unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
    });
  }, [
    state.dex,
    state.pitzBalance,
    state.ownedIngredientIds,
    state.inventory,
    state.starterGrantClaimedRecipeIds,
    state.unlockedForShopIngredientIds,
  ]);

  // Firebase Ranking 1.0 Phase 1A (Issue #87): establishes an anonymous Firebase identity in
  // the background, ahead of Phase 1B's score-submission path actually needing one -- purely
  // fire-and-forget, no UI, no gameplay dependency. `isFirebaseAvailable()` is `false` for
  // every build without a Firebase config (all of local dev/CI/production today, until Manual
  // Setup happens -- see docs/design/TETO_FIREBASE-RANKING_SETUP.md), so this is a no-op then;
  // `ensureAnonymousUser()` itself never throws or rejects, so a network failure here can never
  // surface as an error to the player. Empty deps: runs once per mount, matching the "resolve
  // to a stable identity for the session" intent -- there is nothing to re-run on state change.
  useEffect(() => {
    if (!isFirebaseAvailable()) return;
    void ensureAnonymousUser();
  }, []);

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
  // Firebase Ranking 1.0 Phase 1B: the last `mission.runId` a score submission was already
  // attempted for -- see the submission effect below for why this guards against resubmitting
  // the same run's score a second time.
  const submittedMissionRunIdRef = useRef<number | null>(null);
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

  // Firebase Ranking 1.0 Phase 1B (Issue #87): the trusted score-submission path's one call
  // site -- Lunch Rush RESULT -> submitLunchRushScore (src/firebase/submitLunchRushScore.ts),
  // itself a no-op whenever Firebase is unconfigured or no auth user can be established. Purely
  // fire-and-forget: nothing here awaits or branches on the result, so a rejected/failed/
  // unavailable submission can never fail Lunch Rush's own RESULT screen or block offline
  // gameplay -- this run's local `missionBest` (the effect above) has already been persisted
  // regardless of whether this succeeds. `submittedMissionRunIdRef` guards against resubmitting
  // the same run a second time if this effect body re-runs while `mission.mode` is still
  // "RESULT" (a rerender, React StrictMode's dev-only double effect invocation, opening/closing
  // an overlay) -- the same idempotency shape `CLAIM_MISSION_REWARD`'s own runId guard already
  // uses for the Pitz reward effect below, applied here at the effect level since this call has
  // no reducer state of its own to guard with.
  useEffect(() => {
    if (mission.mode !== "RESULT") return;
    if (submittedMissionRunIdRef.current === mission.runId) return;
    submittedMissionRunIdRef.current = mission.runId;
    if (!isFirebaseAvailable()) return;
    const clientDurationMs = mission.clock ? mission.clock.endsAt - mission.clock.startedAt : 0;
    void submitLunchRushScore({ clientDurationMs, serves: mission.serves });
  }, [mission.mode, mission.runId, mission.clock, mission.serves]);

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
    dispatch({ type: "CONFIRM_BAKE", value, now: Date.now() });
    if (!state.isMissionRound) {
      // REGISTER_TO_DEX's own `state.phase !== "RESULT"` guard makes this a safe no-op the
      // instant a CUT-enabled recipe's profile lands the round on "POST_BAKE" instead --
      // handleConfirmMakingStep below is what actually fires it once POST_BAKE's own last step
      // (CUT) confirms and the round *really* reaches RESULT (Pizza Cutting 1.0 Phase 2,
      // design doc §12's "REGISTER_TO_DEX orchestration must move" finding).
      dispatch({ type: "REGISTER_TO_DEX" });
    }
  }

  // Pizza Cutting 1.0 Phase 2 (design doc §12): CONFIRM_MAKING_STEP is also what finally leaves
  // POST_BAKE for RESULT (confirming a CUT-enabled recipe's own last post-BAKE step) -- mirrors
  // handleConfirmBake's own back-to-back dispatch exactly, relying on the same
  // `state.phase !== "RESULT"` guard to make every other CONFIRM_MAKING_STEP call (every PREPARE
  // step confirm, for every recipe) a harmless no-op here. Lunch Rush is unaffected: Mission's
  // own registration (MISSION_NEXT_ORDER) fires from MissionServePanel's own explicit "次の注文へ"
  // tap once phase is "RESULT" -- untouched by this dispatch.
  function handleConfirmMakingStep() {
    dispatch({ type: "CONFIRM_MAKING_STEP", now: Date.now() });
    if (!state.isMissionRound) {
      dispatch({ type: "REGISTER_TO_DEX" });
    }
  }

  function handleMissionServeNext() {
    if (!state.score) return;
    const now = Date.now();
    // Lunch Rush Completion Gate 1A: reads the exact same `state.completion` FREE's own
    // REGISTER_TO_DEX gates on (../logic/completionGate.ts's `evaluatePizzaCompletion`,
    // already computed unconditionally at CONFIRM_BAKE -- see gameReducer.ts's own comment)
    // rather than any new Lunch Rush-only check, so the two modes can never drift on what
    // counts as "a real, servable dish". A FAILED pizza's quality never enters the run's
    // metrics (qualityTotal forced to 0 and completionFailed tells missionRunReducer to skip
    // recordServe entirely) -- see lunchRush.ts's own SERVE case for why the order still
    // advances below regardless.
    const completionFailed = state.completion?.status === "FAILED";
    missionDispatch({
      type: "SERVE",
      qualityTotal: completionFailed ? 0 : state.score.total,
      recipeId: state.recipe.id,
      completionFailed,
      now,
    });
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

  // Pizza Cutting 1.0 Phase 2: mirrors handleDoughStretchCommit's own "gesture layer buffers
  // locally, dispatches once at a successful pointerup" contract -- PizzaStage's CUT-mode
  // pointer handling already constructed a genuine rim-to-rim `CutLine` (../logic/cut/types.ts's
  // `buildRimToRimCutLine`) before calling this.
  // Pizza Cutting 1.0 Phase 4A (design doc §2.2/Phase 4 Fresh Audit §5B): checks the exact same
  // orientation-modulo-pi rule the reducer's own `ADD_CUT_LINE` backstop enforces
  // (`isDuplicateCutLine`, ../logic/cut/geometry.ts -- one shared rule, never two independently
  // drifting copies of it) *before* dispatching, purely so a rejected line can show the player a
  // short reason instead of a silent no-op. A near-duplicate line is never dispatched at all: it
  // cannot increment `cutState.lines`, invalidate `evaluation`, or disturb undo history, because
  // the reducer never even sees it.
  function handleAddCutLine(line: CutLine) {
    if (isDuplicateCutLine(line, state.cutState.lines)) {
      if (cutRejectionTimeoutRef.current !== null) window.clearTimeout(cutRejectionTimeoutRef.current);
      setCutRejectionMessage(CUT_DUPLICATE_LINE_MESSAGE);
      cutRejectionTimeoutRef.current = window.setTimeout(() => {
        setCutRejectionMessage(null);
        cutRejectionTimeoutRef.current = null;
      }, CUT_DUPLICATE_REJECTION_MESSAGE_MS);
      return;
    }
    setCutRejectionMessage(null);
    dispatch({ type: "ADD_CUT_LINE", line });
  }

  function handleUndoCutLine() {
    dispatch({ type: "UNDO_CUT_LINE" });
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

  // Full Game Reset (Issue #89): the reload itself is the reset mechanism (Fresh Audit §13
  // Option B), not a new fresh-state construction here -- clearing the one save key means the
  // very next mount's `useReducer` lazy initializer above (`loadSave()` -> `createDefaultSave()`
  // -> `resolveShopEntitlement` -> `createInitialGameState`) runs exactly as it does for a genuine
  // first launch, and the reload also discards every one of this component's other ~13
  // useState/useReducer hooks (screen, overlay flags, mission state, ...) for free, with no
  // per-field enumeration to keep in sync. `resetSave` (persistence.ts) verifies the key is
  // actually gone before this reloads -- a `false` return (storage removal failed/unavailable
  // in a way that leaves the old save intact) must not reload into what would look like a
  // silently-broken reset, so `SettingsOverlay` shows an error and lets the player retry instead.
  function handleResetGameData(): boolean {
    const succeeded = resetSave();
    if (succeeded) {
      window.location.reload();
    }
    return succeeded;
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
  // (SELECT_RECIPE, src/state/gameReducer.ts) and enters GAME. Discovery 2.0 (LK-8d / NF-2): GAME
  // is entered only when the reducer will accept the selection -- the same pure authority
  // (`canStartGuidedRound`) SELECT_RECIPE applies, evaluated on the same state -- so a rejected
  // pick can never surface a stale ORDER left over from an earlier round.
  function handleSelectRecipe(recipeId: RecipeId) {
    if (!canStartGuidedRound(recipeId, state)) return;
    dispatch({ type: "SELECT_RECIPE", recipeId, now: Date.now() });
    setScreen("GAME");
  }

  // RESULT's 「もう一度つくる」. A guided retry follows the same authority as SELECT_RECIPE
  // (Discovery 2.0, F-15): when the recipe can no longer be cooked (its stock ran out), the reducer
  // rejects the retry, so App goes to Pizza Select instead of leaving a dead button.
  function handleRetrySameRecipe() {
    if (!state.freeCook && !canStartGuidedRound(state.recipe.id, state)) {
      setScreen("PIZZA_SELECT");
      return;
    }
    dispatch({ type: "RETRY_SAME_RECIPE", now: Date.now() });
  }

  // Progression 2.0 Phase 3-2 (Issue #194): HOME's フリークッキング -- a fresh FREE round with
  // no recipe selected (START_FREE_COOK). Like SELECT_RECIPE it lands straight at PREPARE; the
  // previous round (whatever phase it was left in) is replaced wholesale by the reducer.
  function handleStartFreeCook() {
    dispatch({ type: "START_FREE_COOK", now: Date.now() });
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

  // Progression 2.0 Phase 3-3 (Issue #198): Lunch Rush stays closed until the player's very
  // first discovery -- HOME's own button is disabled (see the `lunchRushLocked` prop below), but
  // this is the reducer-adjacent backstop so a stray dispatch can never start it early either.
  // `missionRunReducer` (../mission/lunchRush.ts) has no Dex awareness of its own, so the guard
  // lives here rather than inside SHOW_INTRO's own case.
  function handleStartLunchRush() {
    if (!hasAnyDiscovery) return;
    setScreen("GAME");
    missionDispatch({ type: "SHOW_INTRO" });
  }

  // Gameplay UX PR-E (Finished Pizza Visual 2.0): POST_BAKE (the CUT step) used to fall through
  // to `null` here, the same "no bake-derived styling" value PREPARE uses -- so the pizza's own
  // crust/cheese/topping bake tint visibly reverted to raw the instant BAKE ended, then reappeared
  // at RESULT. `state.pizza.bakeResult` (the same committed value RESULT already reads) is already
  // available the whole time POST_BAKE is active, so this closes that gap: the finished pizza now
  // stays visually baked continuously from the end of BAKE through CUT into RESULT.
  const bakeProgress =
    state.phase === "BAKE"
      ? liveBake
      : state.phase === "POST_BAKE" || state.phase === "RESULT" || state.phase === "DISCOVERED"
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
  // Progression 2.0 I5a-3: Home's "所持 N/M種" counts obtainable ingredients (the same SSOT as
  // InventoryOverlay's summary), not every catalog row.
  const ingredientCollection = ingredientCollectionCount(state.ownedIngredientIds);

  return (
    <div className="app-frame">
      <PreviewBadge />
      {screen === "HOME" && (
        <HomeScreen
          pitzBalance={state.pitzBalance}
          dex={state.dex}
          ownedIngredientCount={ingredientCollection.owned}
          totalIngredientCount={ingredientCollection.total}
          onStartFreePlay={handleStartFreePlay}
          onStartFreeCook={handleStartFreeCook}
          onStartLunchRush={handleStartLunchRush}
          lunchRushLocked={!hasAnyDiscovery}
          onOpenDex={() => setDexOpen(true)}
          onOpenShop={() => setShopOpen(true)}
          onOpenInventory={() => setInventoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenRanking={() => setRankingOpen(true)}
          newShopMaterialCount={newShopMaterialCount(state.ownedIngredientIds, state.unlockedForShopIngredientIds)}
          dexHasNew={state.justDiscovered}
          discoverableCount={countRecipeDiscoveryStates(RECIPES, state).DISCOVERABLE}
        />
      )}

      {screen === "PIZZA_SELECT" && (
        <PizzaSelectScreen
          dex={state.dex}
          ownedIngredientIds={state.ownedIngredientIds}
          unlockedForShopIngredientIds={state.unlockedForShopIngredientIds}
          inventory={state.inventory}
          onSelectRecipe={handleSelectRecipe}
          onBack={handleBackFromPizzaSelect}
          onGoFreeCook={handleStartFreeCook}
          onOpenShop={() => setShopOpen(true)}
          newlyDiscoveredId={state.justDiscovered ? state.recipe.id : null}
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
          isGlobalOverlayOpen={isDexOpen || isShopOpen || isInventoryOpen || isSettingsOpen || isRankingOpen}
          sauceMetrics={sauceMetrics}
          sauceShadowScore={sauceShadowScore}
          isDispensingSauce={pendingSauceDeposits.length > 0}
          pieceShadowMetrics={pieceShadowMetrics}
          showDoughShape={showDoughShape}
          doughShapeComplete={doughShapeComplete}
          onGoHome={handleGoHome}
          onBeginPrepare={() => dispatch({ type: "BEGIN_PREPARE", now: Date.now() })}
          onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
          onConfirmMakingStep={handleConfirmMakingStep}
          onStartBake={() => dispatch({ type: "START_BAKE", now: Date.now() })}
          onShowHint={() => dispatch({ type: "SHOW_HINT" })}
          onChangeCategory={handleChangeCategory}
          onSelectIngredient={handleSelectIngredient}
          onClearIngredientSelection={() => setSelectedIngredientId(null)}
          onTapPizza={handleTapPizza}
          onBakeTick={handleBakeTick}
          onConfirmBake={handleConfirmBake}
          onRetrySameRecipe={handleRetrySameRecipe}
          onBackToPizzaSelect={handleBackToPizzaSelectFromDiscovered}
          onOpenShop={() => setShopOpen(true)}
          onOpenDex={() => setDexOpen(true)}
          onMissionServeNext={handleMissionServeNext}
          onMissionStart={startMission}
          onMissionExitToFree={exitMissionToFree}
          onMissionCloseIntro={() => missionDispatch({ type: "EXIT_TO_FREE" })}
          onShowRanking={() => setRankingOpen(true)}
          onReferencePopoverChange={setReferencePopoverOpen}
          onDispenseProgress={handleDispenseProgress}
          onDispenseCommit={handleDispenseCommit}
          onDoughStretchProgress={handleDoughStretchProgress}
          onDoughStretchCommit={handleDoughStretchCommit}
          onAddCutLine={handleAddCutLine}
          onUndoCutLine={handleUndoCutLine}
          cutRejectionMessage={cutRejectionMessage}
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
          ownedIngredientIds={state.ownedIngredientIds}
          unlockedForShopIngredientIds={state.unlockedForShopIngredientIds}
          inventory={state.inventory}
          onGoFreeCook={
            mission.mode === "FREE"
              ? () => {
                  setDexOpen(false);
                  handleStartFreeCook();
                }
              : undefined
          }
          onOpenShop={() => setShopOpen(true)}
        />
      )}

      {isShopOpen && (
        <ShopOverlay
          dex={state.dex}
          ownedIngredientIds={state.ownedIngredientIds}
          unlockedForShopIngredientIds={state.unlockedForShopIngredientIds}
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

      {isSettingsOpen && (
        <SettingsOverlay onClose={() => setSettingsOpen(false)} onResetGameData={handleResetGameData} />
      )}

      {isRankingOpen && <WeeklyRankingOverlay onClose={() => setRankingOpen(false)} />}
    </div>
  );
}

export default App;
