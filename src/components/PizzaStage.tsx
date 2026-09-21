import {
  useEffect,
  useCallback,
  useId,
  useMemo,
  useReducer as useReactReducer,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getIngredient, type Ingredient } from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import type { Recipe } from "../data/recipes";
import type { PizzaState, PlacementFeedback, SauceDeposit } from "../state/pizzaState";
import type { MakingStep } from "../state/gameReducer";
import { classifyBake } from "../logic/bake";
import {
  charIntensity,
  cheeseVisualFrame,
  computeBakeHeat,
  doughVisualColors,
  rawSheenIntensity,
} from "../logic/bakeVisual";
import { SauceDispenseController } from "../logic/sauceDispenseController";
import { PointerTimestampNormalizer } from "../logic/pointerTimestampNormalizer";
import { applyStretchPoint, smoothDoughShapeForDisplay, type DoughShape } from "../logic/doughShape";
import { insideDoughShapeFraction, SAUCE_TARGET_RADIUS } from "../logic/sauceField";
import { SauceHeatmapCanvas } from "./SauceHeatmapCanvas";
import {
  clampToDough,
  clientPointToDoughPercent,
  DOUGH_CENTER,
  DOUGH_RADIUS,
  isInsideDough,
  toSauceLayerPercent,
  type DoughPoint,
} from "../logic/pizzaCoordinates";
import { stablePieceRotation } from "../logic/pieceDrag";
import { buildRimToRimCutLine, resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { requiredCutCount } from "../logic/cut/evaluation";
import type { CutState } from "../logic/cut/state";
import { computeGuideOpacity } from "../logic/bakeGuideFade";

/** Screen-space finger/mouse movement (px) before a press becomes a drag instead of a tap. */
const DRAG_THRESHOLD_PX = 10;
/** How long the freehand paint trail lingers before fading, roughly matching the sauce-spread
 * animation's own duration so the trail reads as "becoming" the sauce rather than vanishing. */
const TRAIL_FADE_MS = 260;
/** Internal pixel resolution of the overflow-marker canvas -- matches `SauceHeatmapCanvas`'s
 * own internal resolution (../components/SauceHeatmapCanvas.tsx) purely so the two overlaid
 * canvases share one rasterization fidelity; independent of SAUCE_FIELD_SIZE. */
const OVERFLOW_MARKER_CANVAS_PX = 200;

interface PizzaStageProps {
  pizza: PizzaState;
  recipe: Recipe;
  interactive: boolean;
  /** Currently selected ingredient in the tray; drives whether drag paints a trail (sauce) or
   * stays tap-only (toppings, which never got drag placement in this phase). */
  activeIngredient: Ingredient | null;
  bakeProgress: number | null;
  placement: PlacementFeedback | null;
  /** True while RESULT is showing the finished pizza; gates the one-shot perfect glow. */
  resultRevealed: boolean;
  /** True only for the FREE Margherita Reference UI. App.tsx still folds an open Reference
   *  popover into `interactive`, so opening it aborts an active gesture. */
  referenceModeEnabled: boolean;
  /** Canonical pizza reset generation, shared with IngredientTray. A change permanently
   * invalidates every gesture that started against the pre-reset pizza, including buffered
   * Sauce deposits that have not reached canonical state yet. */
  resetToken: number;
  /** Issue #32 Phase 2: bumped by the reducer's own CONFIRM_MAKING_STEP/RESET_PIZZA (see
   *  GameState.makingStepToken, src/state/gameReducer.ts). A step confirmation changes only
   *  `state.makingStep` -- none of `interactive`/`activeIngredient`/`resetToken` moves when it
   *  fires -- so without this, a dispense (or topping-drag) gesture in flight when the player
   *  confirms SAUCE/CHEESE could still commit into the step that follows it. Mirrors
   *  `resetToken`'s own abort effect below exactly. */
  makingStepToken: number;
  /** Issue #33 D1: the reducer's current making step -- gates the DOUGH radial-stretch
   *  gesture branch below (active only while `makingStep === "DOUGH"`), mirroring how
   *  `isPaintMode`/`activeIngredient?.placement` already gate the sauce/topping gesture
   *  families. */
  makingStep: MakingStep;
  /** True once the round has actually entered PREPARE (or later) -- the dough boundary only
   *  starts rendering/clipping `.pizza-dough` from that point on, so ORDER's pre-existing
   *  plain-circle dough preview (Lunch Rush's own order screen) is untouched. */
  showDoughShape: boolean;
  /** Fired with the current in-progress (uncommitted) shape on every DOUGH gesture update,
   *  and with `null` the instant that gesture ends for any reason (commit or discard) --
   *  mirrors `onDispenseProgress`'s own live-preview contract exactly, letting the CTA's
   *  size-completion gate (GameScreen) react in real time without canonical game state ever
   *  seeing an uncommitted gesture. */
  onDoughStretchProgress: (shape: DoughShape | null) => void;
  /** Fired exactly once, at a successful pointerup, with the gesture's final shape. Never
   *  fired for a cancelled/discarded gesture (pointercancel, lost capture, blur/hidden, a
   *  reset or step change mid-hold, or unmount) -- those all discard locally instead. */
  onDoughStretchCommit: (shape: DoughShape) => void;
  onDoughElementChange?: (element: HTMLDivElement | null) => void;
  onTap: (xPercent: number, yPercent: number) => void;
  /** Phase 4A-1A (Post-Codex-Fix): fired with the *entire* accumulated-so-far deposit array
   *  for the in-progress dispense session on every tick, and with `[]` the instant that
   *  session ends for any reason (commit or discard) -- lets the Prototype Metrics panel
   *  (App.tsx) show live numbers during the hold without canonical game state ever seeing an
   *  uncommitted gesture (MUST FIX 7 -- Cancel Transaction). */
  onDispenseProgress: (deposits: readonly SauceDeposit[]) => void;
  /** Phase 4A-1A (Post-Codex-Fix): fired exactly once, at a *successful* pointerup, with the
   *  complete dispense session's deposits. Never fired for a cancelled/discarded session
   *  (pointercancel, lost capture, blur/visibilitychange, an ingredient change or Reference
   *  overlay open mid-hold, a BAKE abort, or unmount) -- those all discard locally instead.
   *  App.tsx dispatches this as one atomic COMMIT_SAUCE_DISPENSE action. */
  onDispenseCommit: (ingredientId: string, deposits: SauceDeposit[]) => void;
  /** Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md §2.2/§11): the CUT step's
   *  own transient state (committed lines + config), read-only here -- rendering and the cut
   *  limit/guide-line-count gates below, never mutated directly (PizzaStage only ever calls
   *  `onAddCutLine`, mirroring every other gesture family's "gesture layer buffers locally,
   *  dispatches once at a successful commit" contract). */
  cutState: CutState;
  /** Fired exactly once, at a successful pointerup, with one complete rim-to-rim `CutLine`
   *  (already constructed by `buildRimToRimCutLine` below). Never fired for a cancelled/
   *  discarded gesture or a tap with no real drag. */
  onAddCutLine: (line: CutLine) => void;
  /** Visual Polish 2.0A (Finding P1-1): purely presentational sizing hint for the outer
   *  `.pizza-stage` wrapper -- never touches gesture math (pointer coordinates stay
   *  percent-of-rendered-box via `clientPointToDoughPercent`, see pizzaCoordinates.ts, so
   *  they track whatever size CSS actually renders regardless of this flag). `true` for
   *  BAKE/CUT (App.css's `.pizza-stage--roomy`, a larger static cap on `.pizza-dough`) --
   *  Gameplay UX Phase 1 removed PREPARE from this set (see GameScreen.tsx's `roomyStage`
   *  comment) once the Fresh Audit traced it as the biggest single contributor to PREPARE
   *  overflowing 390x844/360x800 with more than one owned ingredient per category. `false`
   *  (the default) keeps ORDER's small preview and RESULT's own hero (Finding P1-5, out of
   *  this pass's scope) at the exact pre-2.0A size. */
  roomy?: boolean;
  /** Gameplay UX Phase 1: PREPARE-only, a few percent smaller than the shared `.pizza-dough`
   *  default ORDER also uses (`.pizza-stage--compact`, App.css) -- purely a real-device safety
   *  margin on top of `roomy=false` already reverting PREPARE's stage size. The Fresh Audit's
   *  own 複数材料 regression fixture (quattro-formaggi, SAUCE step) measured exactly 0px of
   *  headroom left at 360x800 in headless Chromium once every other trim in this pass was
   *  applied -- real Safari's font metrics can easily differ by a few px, so this buys back
   *  slack without touching ORDER (a phase with no scroll problem at all, out of this pass's
   *  scope) by scoping the smaller size to a separate modifier class instead of changing the
   *  shared default. Never combined with `roomy` (GameScreen.tsx only ever sets one). */
  compact?: boolean;
}

interface GestureState {
  pointerId: number | null;
  rect: DOMRect | null;
  startClientX: number;
  startClientY: number;
  startDough: DoughPoint;
  dragging: boolean;
  pathD: string;
  lastInsideDough: DoughPoint | null;
}

function createGestureState(): GestureState {
  return {
    pointerId: null,
    rect: null,
    startClientX: 0,
    startClientY: 0,
    startDough: { x: 0, y: 0 },
    dragging: false,
    pathD: "",
    lastInsideDough: null,
  };
}

/** Phase 4A-1A (Post-Codex-Fix) MUST FIX 1 -- Gesture Session Safety: an immutable snapshot
 *  taken once, at pointerdown, of everything the rest of a dispense gesture's lifetime needs
 *  to behave consistently. Every subsequent pointermove/up/cancel/lostpointercapture (and
 *  every abort trigger: ingredient change, Reference overlay open, BAKE, blur/hidden,
 *  unmount) is driven by comparing against *this* snapshot -- never by re-reading whatever
 *  `activeIngredient`/`referenceModeEnabled` happen to be by the time that later event fires.
 *  `token` additionally invalidates any in-flight `requestAnimationFrame` callback that
 *  somehow outlives `cancelAnimationFrame` (belt-and-suspenders: it shouldn't, but a stale
 *  frame checking the token can never call back into a stopped or superseded session). */
interface DispenseSession {
  token: number;
  pointerId: number;
  ingredientId: string;
}

export function PizzaStage({
  pizza,
  recipe,
  interactive,
  activeIngredient,
  bakeProgress,
  placement,
  resultRevealed,
  referenceModeEnabled,
  resetToken,
  makingStepToken,
  makingStep,
  showDoughShape,
  onDoughStretchProgress,
  onDoughStretchCommit,
  onDoughElementChange,
  onTap,
  onDispenseProgress,
  onDispenseCommit,
  cutState,
  onAddCutLine,
  roomy = false,
  compact = false,
}: PizzaStageProps) {
  const circleRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const overflowCanvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<GestureState>(createGestureState());
  const fadeTimeoutRef = useRef<number | null>(null);
  /** Pizza Cutting 1.0 Phase 2: imperative refs for the in-progress drag preview -- mirrors
   *  `pathRef`'s own "ref + direct SVG attribute writes while dragging" pattern exactly, never
   *  triggering a React re-render per pointermove. */
  const cutPreviewLineRef = useRef<SVGLineElement>(null);
  const cutCutterIconRef = useRef<HTMLSpanElement>(null);
  /** The angle-guide `<g>`'s own opacity is driven by a self-contained requestAnimationFrame
   *  loop (see the effect below), independent of React state, matching every other purely
   *  visual per-frame update in this component. */
  const cutGuideGroupRef = useRef<SVGGElement>(null);
  const cutGuideRafRef = useRef<number | null>(null);
  /** Issue #33 D1: the current in-progress (uncommitted) DOUGH gesture's shape -- null
   *  whenever no DOUGH gesture is active. Mirrors `pendingDepositsRef`'s own
   *  ephemeral/canonical split: only ever committed to canonical `pizza.doughShape` via
   *  `onDoughStretchCommit` at a successful pointerup, discarded on every other end trigger. */
  const doughGestureShapeRef = useRef<DoughShape | null>(null);
  const doughClipId = useId();

  // Issue #33 D1: gates the DOUGH radial-stretch gesture branch below, mirroring isPaintMode's
  // own role for sauce -- mutually exclusive with it in practice (IngredientTray/activeIngredient
  // are never set during DOUGH, see GameScreen), but each branch below checks its own gate
  // independently rather than assuming that.
  const isDoughStep = makingStep === "DOUGH";
  const isPaintMode = activeIngredient?.placement === "spread";
  // Pizza Cutting 1.0 Phase 2 (design doc §2.2): gates the CUT edge-to-edge drag gesture branch
  // below, mirroring isDoughStep's own role -- mutually exclusive with sauce/dough gestures in
  // practice (CUT only ever becomes the active `makingStep` during POST_BAKE, after PREPARE/BAKE
  // have both already ended), but each branch below checks its own gate independently. Declared
  // this early (ahead of every other gesture helper) because the guide-fade effect below already
  // needs it in its own dependency array.
  const isCutStep = makingStep === "CUT";
  const cutRequiredCount = requiredCutCount(resolveRequestedSliceCount(cutState.config));
  // design doc §8.4: `requiredCutCount + 2` -- bounds the interaction with slack for an
  // intentional redraw-via-undo-then-redraw cycle, without feeling hard-gated.
  const cutLimit = cutRequiredCount + 2;

  // Phase 4A-1A (Post-Codex-Fix) dispense session bookkeeping. `forceRender` is the escape
  // hatch that lets `activeSessionRef`/`pendingDepositsRef` (necessarily refs -- they're
  // mutated from a requestAnimationFrame loop and from event handlers alike, synchronously,
  // for correct cap math) still drive a re-render for the heatmap/opacity visuals below;
  // every mutation site pairs a ref write with a `forceRender()` call. `pendingVersion`
  // (the counter itself) doubles as a stable memoization key for `effectiveDeposits` below,
  // so that derived array is only ever rebuilt when a session mutation actually happened --
  // never on every unrelated re-render (e.g. a BAKE-overlay tick elsewhere on the page).
  const [pendingVersion, forceRender] = useReactReducer((c: number) => c + 1, 0);
  const sessionTokenCounterRef = useRef(0);
  const activeSessionRef = useRef<DispenseSession | null>(null);
  const dispenseControllerRef = useRef<SauceDispenseController | null>(null);
  const dispenseRafRef = useRef<number | null>(null);
  /** MUST FIX 7 -- Cancel Transaction: every tick of the *current, not-yet-committed*
   *  session, held here only -- never dispatched to canonical game state until a successful
   *  pointerup calls `onDispenseCommit`. Discarded (never sent anywhere) on cancel/lost
   *  capture/blur/hidden/ingredient-change/overlay-open/BAKE/unmount. */
  const pendingDepositsRef = useRef<SauceDeposit[]>([]);
  const pendingTotalRef = useRef(0);
  /** Sum of every deposit already committed to canonical state for this sauce application
   *  (prior finished strokes) -- combined with `pendingTotalRef` to give the dispense
   *  controller the true running total for cap purposes across the whole application. */
  const committedTotalRef = useRef(0);
  const activeIngredientIdRef = useRef<string | null>(activeIngredient?.id ?? null);
  /** Timestamp-preservation follow-up: one instance per active dispense session, built at
   *  pointerdown from that event's own `timeStamp` + a single `performance.now()` sample
   *  (see PointerTimestampNormalizer's doc comment) -- never re-created per pointermove
   *  sample. `null` whenever no reference-dispense session is active. */
  const timestampNormalizerRef = useRef<PointerTimestampNormalizer | null>(null);

  const setDoughElement = useCallback((element: HTMLDivElement | null) => {
    circleRef.current = element;
    onDoughElementChange?.(element);
  }, [onDoughElementChange]);

  useEffect(() => {
    committedTotalRef.current = pizza.sauceDeposits.reduce((sum, d) => sum + d.amount, 0);
  }, [pizza.sauceDeposits]);

  function resetSessionBuffers() {
    pendingDepositsRef.current = [];
    pendingTotalRef.current = 0;
  }

  function appendPendingDeposit(deposit: SauceDeposit) {
    pendingDepositsRef.current = [...pendingDepositsRef.current, deposit];
    pendingTotalRef.current += deposit.amount;
    onDispenseProgress(pendingDepositsRef.current);
    forceRender();
  }

  /** Ends the active session (if any), either committing its buffered deposits as one
   *  atomic action (`commit: true`, only ever called from a successful pointerup) or
   *  discarding them entirely (every abort path). Safe to call with no active session. */
  function endDispenseSession(commit: boolean) {
    if (dispenseRafRef.current !== null) {
      cancelAnimationFrame(dispenseRafRef.current);
      dispenseRafRef.current = null;
    }
    dispenseControllerRef.current?.stop();
    dispenseControllerRef.current = null;

    const session = activeSessionRef.current;
    activeSessionRef.current = null;
    timestampNormalizerRef.current = null;
    if (commit && session && pendingDepositsRef.current.length > 0) {
      onDispenseCommit(session.ingredientId, pendingDepositsRef.current);
    }
    resetSessionBuffers();
    onDispenseProgress([]);
    forceRender();
  }

  /** Issue #33 D1: discards the in-progress DOUGH gesture (if any) without committing --
   *  called from every abort trigger below, exactly mirroring `endDispenseSession(false)`'s
   *  own "discard, never dispatch" contract for sauce. Safe to call with no active gesture. */
  function discardDoughGesture() {
    if (doughGestureShapeRef.current === null) return;
    doughGestureShapeRef.current = null;
    onDoughStretchProgress(null);
    forceRender();
  }

  /** Pizza Cutting 1.0 Phase 2: hides the in-progress CUT preview line/cutter icon -- called on
   *  every commit and every abort trigger, mirroring `clearTrail`'s own role for the sauce
   *  paint trail. Safe to call with no active CUT gesture (a no-op opacity write). */
  function clearCutPreviewLine() {
    if (cutPreviewLineRef.current) cutPreviewLineRef.current.style.opacity = "0";
    if (cutCutterIconRef.current) cutCutterIconRef.current.style.opacity = "0";
  }

  /** Updates the in-progress CUT preview line + cutter icon to the real rim-to-rim chord the
   *  current drag would commit if released right now (`buildRimToRimCutLine`, same construction
   *  `handlePointerUp` uses for the real commit) -- so the preview never lies about what's about
   *  to happen. The cutter icon (🔪) follows the live pointer position, offset above it (design
   *  doc §8.3) so it's never hidden under the finger itself. */
  function updateCutPreviewLine(start: DoughPoint, current: DoughPoint) {
    const line = buildRimToRimCutLine(start, current);
    const previewEl = cutPreviewLineRef.current;
    if (!previewEl) return;
    if (!line) {
      previewEl.style.opacity = "0";
      return;
    }
    previewEl.setAttribute("x1", line.start.x.toFixed(2));
    previewEl.setAttribute("y1", line.start.y.toFixed(2));
    previewEl.setAttribute("x2", line.end.x.toFixed(2));
    previewEl.setAttribute("y2", line.end.y.toFixed(2));
    previewEl.style.opacity = "1";
    const cutterEl = cutCutterIconRef.current;
    if (cutterEl) {
      cutterEl.style.left = `${current.x}%`;
      cutterEl.style.top = `${Math.max(0, current.y - 8)}%`;
      cutterEl.style.opacity = "1";
    }
  }

  /** Shared cleanup for every abort trigger (ingredient change, Reference overlay open via
   *  `interactive`, BAKE via `interactive`, blur/hidden, window-level fallback): discards
   *  any active session, releases pointer capture if still held, and resets the gesture. */
  function abortActiveGesture() {
    const pointerId = gestureRef.current.pointerId;
    if (activeSessionRef.current) endDispenseSession(false);
    discardDoughGesture();
    clearCutPreviewLine();
    if (pointerId !== null) {
      try {
        circleRef.current?.releasePointerCapture(pointerId);
      } catch {
        // Already released.
      }
    }
    clearTrail();
    gestureRef.current = createGestureState();
  }

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current !== null) window.clearTimeout(fadeTimeoutRef.current);
      if (activeSessionRef.current) endDispenseSession(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup.
  }, []);

  // If interaction is disabled mid-gesture -- BAKE starting via a second pointer while the
  // first is still down on the dough, or App.tsx setting `interactive` false while the
  // Reference popover is open -- abort immediately rather than letting a since-stale
  // pointerup still commit into a later phase or overlay-hidden state. This is the fix for
  // the Phase 3A BAKE race, generalized (Codex Broad Review MUST FIX 1) to every trigger
  // that can end a gesture out from under its own pointer events.
  useEffect(() => {
    if (interactive) return;
    abortActiveGesture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  // RESET_PIZZA changes canonical pizza state without changing `interactive` or the selected
  // ingredient, so neither lifecycle guard above can observe it. Reuse GameScreen's existing
  // reset generation (already consumed by IngredientTray) to invalidate the complete local
  // gesture transaction: controller/RAF, pending deposits, pointer capture, trail and gesture
  // refs. A later pointerup/cancel/lost-capture from the pre-reset pointer then sees no matching
  // gesture/session and cannot dispatch COMMIT_SAUCE_DISPENSE. The next pointerdown starts a
  // fresh session normally against the reset pizza.
  useEffect(() => {
    if (activeSessionRef.current || gestureRef.current.pointerId !== null) {
      abortActiveGesture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires purely off the reset generation.
  }, [resetToken]);

  // Issue #32 Phase 2: a making-step confirmation (SAUCE -> CHEESE, CHEESE -> TOPPING) must
  // invalidate an in-flight gesture exactly like a whole-pizza RESET_PIZZA already does above
  // -- otherwise a slow drag started while SAUCE was still open could still commit its
  // COMMIT_SAUCE_DISPENSE after the player has already confirmed CHEESE. The reducer's own
  // `state.makingStep` gate (src/state/gameReducer.ts) is the final backstop either way; this
  // is what stops the gesture from surviving long enough to reach it.
  useEffect(() => {
    if (activeSessionRef.current || gestureRef.current.pointerId !== null) {
      abortActiveGesture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires purely off the token bump.
  }, [makingStepToken]);

  // Pizza Cutting 1.0 Phase 2 (design doc §8.2.1): the angle-guide's own fade curve, reusing
  // BakeOverlay's already-shipped `computeGuideOpacity` unchanged -- full opacity for the first
  // few seconds of *this* CUT attempt (teaches the ideal spacing every time, never gated behind
  // a persisted first-time-only flag), fading to 0 afterward while the low-opacity center marker
  // (rendered separately, never fading) remains for the whole step. Keyed on `makingStepToken` so
  // entering CUT always restarts the fade at full opacity, matching every other per-step-entry
  // reset in this component (resetToken/makingStepToken gesture-abort effects above).
  useEffect(() => {
    if (!isCutStep || !interactive) return;
    const startTime = performance.now();
    function loop(now: number) {
      const elapsedSeconds = (now - startTime) / 1000;
      const opacity = computeGuideOpacity(elapsedSeconds);
      if (cutGuideGroupRef.current) cutGuideGroupRef.current.style.opacity = String(opacity);
      cutGuideRafRef.current = opacity > 0 ? requestAnimationFrame(loop) : null;
    }
    cutGuideRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (cutGuideRafRef.current !== null) cancelAnimationFrame(cutGuideRafRef.current);
      cutGuideRafRef.current = null;
    };
  }, [isCutStep, interactive, makingStepToken]);

  // Codex Broad Review MUST FIX 1: an ingredient switch mid-hold (a second finger tapping a
  // different tray item while the first is still dispensing) must abort the session using
  // the ingredient it was *started* with, never silently continue under a stale
  // `isTomatoSauceReference` re-check against the *new* selection.
  useEffect(() => {
    const newId = activeIngredient?.id ?? null;
    if (activeIngredientIdRef.current === newId) return;
    activeIngredientIdRef.current = newId;
    if (activeSessionRef.current) abortActiveGesture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIngredient]);

  // Codex Broad Review MUST FIX 3 / MUST FIX 9: a backgrounded tab or an app-switch on
  // mobile must never leave a dispense session (and its requestAnimationFrame loop) running
  // -- `visibilitychange`/`blur` abort it outright, independent of and in addition to
  // MAX_TICKS_PER_STEP's own defense against a stale session's next `step()` depositing a
  // huge backlog burst if this ever somehow failed to fire.
  useEffect(() => {
    function abortForBackgrounding() {
      // Issue #33 D1: this used to only check activeSessionRef (the sauce dispense session),
      // silently missing an in-progress DOUGH gesture (which never sets that ref) -- widened
      // to the same general "is any gesture live" check the resetToken/makingStepToken abort
      // effects already use, so backgrounding the tab mid-stretch discards it too.
      if (activeSessionRef.current || gestureRef.current.pointerId !== null) abortActiveGesture();
    }
    function handleVisibilityChange() {
      if (document.hidden) abortForBackgrounding();
    }
    window.addEventListener("blur", abortForBackgrounding);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", abortForBackgrounding);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Codex Broad Review MUST FIX 9 -- window-level pointerup/pointercancel fallback: if
  // setPointerCapture ever fails (some browsers can refuse it) and the finger lifts off
  // after leaving the dough element, the native pointerup fires on whatever element is now
  // under it, never bubbling through this component's own onPointerUp/onPointerCancel at
  // all. This window listener is the backstop -- a no-op whenever the element-level handler
  // already handled the same event (see below), so it never double-processes the normal,
  // captured case.
  useEffect(() => {
    function handleWindowPointerEnd(event: PointerEvent) {
      const g = gestureRef.current;
      if (g.pointerId !== event.pointerId) return; // already handled by the element itself.
      if (activeSessionRef.current?.pointerId === event.pointerId) {
        endDispenseSession(event.type === "pointerup");
      }
      if (doughGestureShapeRef.current !== null) {
        if (event.type === "pointerup") onDoughStretchCommit(doughGestureShapeRef.current);
        discardDoughGesture();
      }
      clearCutPreviewLine();
      clearTrail();
      gestureRef.current = createGestureState();
    }
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTrail() {
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    const path = pathRef.current;
    if (path) {
      path.setAttribute("d", "");
      path.classList.remove("pizza-paint-trail__stroke--fade");
    }
  }

  function appendTrailPoint(x: number, y: number) {
    const g = gestureRef.current;
    g.pathD += g.pathD ? ` L ${x.toFixed(2)} ${y.toFixed(2)}` : `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    pathRef.current?.setAttribute("d", g.pathD);
  }

  // PR #26 Final P2 Follow-up #2 (discussion_r4021268603): SPREAD ingredients have no working
  // keyboard activation (see handleKeyDown below), so the dough must not advertise one via
  // tabIndex/aria-label while one is selected -- misleading assistive tech about a control that
  // silently does nothing useful is worse than temporarily dropping it from the tab order.
  // Scatter (TAP_PLACE) toppings are completely unaffected.
  // Issue #33 D1: DOUGH has no keyboard equivalent yet either (same gap as sauce painting,
  // tracked under Issue #27 -- not reinvented here per the D0 audit's own scope note), so it
  // must not advertise a "place material" tab stop/aria-label a keypress can't actually do
  // anything useful with.
  const isKeyboardPlaceable = interactive && !isPaintMode && !isDoughStep && !isCutStep;

  /** Starts a Phase 4A-1A dispense session for `pointerId` at `dough`, snapshotting the
   *  ingredient it's for, and drives it from a requestAnimationFrame loop keyed on real
   *  timestamps (never on how many pointermove events fire) -- see
   *  SauceDispenseController's own doc comment for why. `startTimestamp` is the single
   *  `performance.now()` sample taken at pointerdown, shared with the
   *  `PointerTimestampNormalizer` constructed alongside it so both agree on "now" at the
   *  exact same instant. */
  function startDispenseSession(
    pointerId: number,
    ingredientId: string,
    dough: DoughPoint,
    startTimestamp: number,
  ) {
    sessionTokenCounterRef.current += 1;
    const token = sessionTokenCounterRef.current;
    activeSessionRef.current = { token, pointerId, ingredientId };
    resetSessionBuffers();

    const controller = new SauceDispenseController({
      onDeposit: (deposit) => appendPendingDeposit(deposit),
      getTotalDispensed: () => committedTotalRef.current + pendingTotalRef.current,
    });
    dispenseControllerRef.current = controller;
    controller.start(startTimestamp, dough);

    const loop = (now: number) => {
      if (activeSessionRef.current?.token !== token) return; // superseded/stopped -- self-halt.
      controller.step(now);
      dispenseRafRef.current =
        controller.isActive && activeSessionRef.current?.token === token
          ? requestAnimationFrame(loop)
          : null;
    };
    dispenseRafRef.current = requestAnimationFrame(loop);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || !circleRef.current) return;
    if (gestureRef.current.pointerId !== null) return; // ignore multi-touch: first finger wins

    const rect = circleRef.current.getBoundingClientRect();
    const dough = clientPointToDoughPercent(event.clientX, event.clientY, rect);
    if (!isInsideDough(dough.x, dough.y)) return;
    // design doc §8.4: once the cut limit is reached, a new press simply starts no gesture at
    // all (mirrors every other "reject at the source" gate in this component) -- ADD_CUT_LINE's
    // own reducer-level guard is the real backstop, this is purely to avoid a confusing
    // "nothing happens on release" interaction.
    if (isCutStep && cutState.lines.length >= cutLimit) return;

    clearTrail();
    gestureRef.current = {
      pointerId: event.pointerId,
      rect,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startDough: dough,
      dragging: false,
      pathD: "",
      lastInsideDough: dough,
    };

    // MUST FIX 9: prevents this press from also producing a compatibility mouse event, a
    // text-selection drag, or (combined with the CSS below) a long-press context menu/
    // callout competing with the dispenser's own long-press gesture.
    event.preventDefault();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can refuse capture; the window-level fallback above covers release.
    }

    // Issue #32 sauce parity fix: every spread (sauce) ingredient uses this same incremental
    // dispense/heatmap session, whether or not it's the current recipe's own required sauce --
    // see COMMIT_SAUCE_DISPENSE's own comment (src/state/gameReducer.ts) for why a mismatched
    // sauce no longer needs (or gets) a different gesture contract.
    const wantsDispenseSession = isPaintMode;
    if (wantsDispenseSession && activeIngredient) {
      // Human Feel Fix 2: no trail point here (unlike the legacy paint-drag path below) --
      // a dispense session's visual is the sauce heatmap alone (see showSauceHeatmap/the
      // canvas draw effect further down), which already re-renders every tick. A raw
      // pointer-path stroke drawn on top of it is what iPhone retesting flagged
      // as "looks like a thick red line", not "sauce spreading" -- see
      // docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix2_Result.md.
      // Timestamp-preservation follow-up: one performance.now() sample here, shared by both
      // the controller's own start() and the normalizer built alongside it -- every later
      // pointermove sample (including each one inside a coalesced batch) is normalized
      // relative to *this* pair, never re-stamped with a fresh performance.now() of its own.
      const startTimestamp = performance.now();
      timestampNormalizerRef.current = new PointerTimestampNormalizer(
        event.nativeEvent.timeStamp,
        startTimestamp,
      );
      startDispenseSession(event.pointerId, activeIngredient.id, dough, startTimestamp);
    } else if (isDoughStep) {
      // Issue #33 D1: position-driven, no RAF/tick -- applying the very first stretch point
      // immediately at pointerdown (rather than waiting for the first pointermove) is what
      // makes the gesture read as instantly responsive (task requirement: "Gesture feedback
      // must feel immediate") and, just as importantly, structurally guarantees this gesture
      // can never fall through to the generic tap/onTap path below at pointerup even for a
      // press with no movement at all (Issue #32 Finding 1-B's lesson, pinned by a regression
      // test).
      doughGestureShapeRef.current = applyStretchPoint(pizza.doughShape, dough.x, dough.y);
      onDoughStretchProgress(doughGestureShapeRef.current);
      forceRender();
    }
  }

  function processMovePoint(
    clientX: number,
    clientY: number,
    pointerId: number,
    rawEventTimestamp: number,
  ) {
    const g = gestureRef.current;
    if (!g.rect) return;

    const dough = clientPointToDoughPercent(clientX, clientY, g.rect);
    const session = activeSessionRef.current;

    if (session && session.pointerId === pointerId) {
      // Reference dispense mode: quantity is produced only by the timer loop started in
      // startDispenseSession() above (see SauceDispenseController). A move only records the
      // finger's timestamped path for tick interpolation and updates the trail -- it never
      // deposits by itself, or a fast drag firing many pointermove events would dispense
      // more sauce than a slow one over the same hold.
      //
      // Timestamp-preservation follow-up: `rawEventTimestamp` is *this specific sample's*
      // own event.timeStamp (the main event's, or one coalesced sample's -- see
      // handlePointerMove) normalized through this gesture's one PointerTimestampNormalizer,
      // never a freshly-read performance.now(). Re-stamping every sample with "now" at the
      // moment this loop runs is exactly the bug this fixes: on a slow/coalesced frame,
      // several samples processed in the same synchronous loop would otherwise all collapse
      // to nearly the same instant, destroying the finger's real movement-over-time history
      // that SauceDispenseController's tick interpolation depends on. Human Feel Fix 2: no
      // appendTrailPoint here -- see the matching comment in handlePointerDown above.
      if (isInsideDough(dough.x, dough.y)) g.lastInsideDough = dough;
      const normalizedTimestamp =
        timestampNormalizerRef.current?.normalize(rawEventTimestamp) ?? performance.now();
      dispenseControllerRef.current?.move(dough, normalizedTimestamp);
      return;
    }

    // Issue #33 D1: every move updates the shape live, with no drag-threshold gate (unlike
    // the tap-vs-drag logic below) -- position-driven, no RAF/tick, a pure function of the
    // current pointer position (D0 §4.2). `applyStretchPoint` clamps distance to DOUGH_RADIUS
    // internally, so a point dragged outside the dough still projects correctly onto the rim
    // without needing isInsideDough/clampToDough here.
    if (isDoughStep && doughGestureShapeRef.current !== null && pointerId === g.pointerId) {
      doughGestureShapeRef.current = applyStretchPoint(doughGestureShapeRef.current, dough.x, dough.y);
      onDoughStretchProgress(doughGestureShapeRef.current);
      forceRender();
      return;
    }

    if (!g.dragging) {
      const dx = clientX - g.startClientX;
      const dy = clientY - g.startClientY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      if (isPaintMode) appendTrailPoint(g.startDough.x, g.startDough.y);
    }

    if (isInsideDough(dough.x, dough.y)) g.lastInsideDough = dough;
    if (isPaintMode) appendTrailPoint(dough.x, dough.y);
    // Pizza Cutting 1.0 Phase 2 (design doc §2.2): reuses the exact same DRAG_THRESHOLD_PX
    // tap-vs-drag distinction above verbatim -- the live preview only appears once a real drag
    // is underway, never for a press that turns out to be a tap.
    if (isCutStep && g.dragging) updateCutPreviewLine(g.startDough, dough);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId || !g.rect) return;

    // Coalesced events give the finer-grained samples the browser batched between frames,
    // so a fast drag still produces a continuous trail instead of a few widely-spaced dots.
    // Timestamp-preservation follow-up: each sample's *own* event.timeStamp travels with it
    // all the way to processMovePoint/the dispense controller now -- getCoalescedEvents()'s
    // whole value is recovering the finger's real sub-frame movement *and timing* history on
    // a slow/coalesced frame, which re-stamping every sample with a fresh performance.now()
    // (the pre-fix behavior) silently threw away. When it returns entries, they fully
    // replace the single main-event entry below (never concatenated) -- per spec the target
    // event's own sample is itself the last entry in that list, so this never double-
    // registers it alongside the array.
    let events: Array<{ clientX: number; clientY: number; timeStamp: number }> = [
      event.nativeEvent,
    ];
    try {
      const coalesced = event.nativeEvent.getCoalescedEvents?.();
      if (coalesced && coalesced.length > 0) events = coalesced;
    } catch {
      // Fall back to the single event above.
    }

    for (const point of events) {
      processMovePoint(point.clientX, point.clientY, event.pointerId, point.timeStamp);
    }
  }

  function releaseCapture(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released (browser auto-releases on up/cancel in most cases).
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId) return;
    releaseCapture(event);

    const session = activeSessionRef.current;
    if (session && session.pointerId === event.pointerId) {
      // MUST FIX 7: the *only* place a dispense session's buffered deposits are ever
      // committed to canonical state -- a successful, in-element pointerup.
      endDispenseSession(true);
      pathRef.current?.classList.add("pizza-paint-trail__stroke--fade");
      fadeTimeoutRef.current = window.setTimeout(clearTrail, TRAIL_FADE_MS);
      gestureRef.current = createGestureState();
      return;
    }

    // Issue #33 D1: the DOUGH gesture's own commit, ahead of the generic tap/topping-drag
    // fallback below -- a DOUGH-step press always populates doughGestureShapeRef at
    // pointerdown (even a tap with no movement), so this branch structurally intercepts
    // every DOUGH-step release before it could ever reach onTap/PLACE_TOPPING/APPLY_SAUCE
    // (regression-pinned, learning directly from Issue #32 Finding 1-B).
    if (doughGestureShapeRef.current !== null) {
      onDoughStretchCommit(doughGestureShapeRef.current);
      doughGestureShapeRef.current = null;
      onDoughStretchProgress(null);
      forceRender();
      gestureRef.current = createGestureState();
      return;
    }

    const rect = g.rect;
    if (!rect) {
      gestureRef.current = createGestureState();
      return;
    }

    // Pizza Cutting 1.0 Phase 2 (design doc §2.2): CUT has no "tap" outcome at all -- a press
    // with no real drag is simply discarded (never a degenerate zero-length cut, never routed
    // to the generic onTap fallback below). A genuine drag commits one rim-to-rim `CutLine`,
    // constructed from the raw press/release pair (`buildRimToRimCutLine` extends both ends out
    // to the dough's rim along the drag's own direction, satisfying the "press/release may land
    // short of the rim" start tolerance) -- ahead of every other branch below since CUT is
    // mutually exclusive with sauce paint/topping drag by construction (`makingStep` gate).
    if (isCutStep) {
      clearCutPreviewLine();
      if (g.dragging) {
        const releaseDough = clientPointToDoughPercent(event.clientX, event.clientY, rect);
        const line = buildRimToRimCutLine(g.startDough, releaseDough);
        if (line) onAddCutLine(line);
      }
      gestureRef.current = createGestureState();
      return;
    }

    if (!g.dragging) {
      // Tap: unchanged Phase 2C one-tap behavior.
      onTap(g.startDough.x, g.startDough.y);
      gestureRef.current = createGestureState();
      return;
    }

    if (!isPaintMode) {
      // Topping drag is out of scope for this phase: commit a single point at release,
      // matching the previous click-based placement exactly (no multi-drop from a drag).
      const dough = clientPointToDoughPercent(event.clientX, event.clientY, rect);
      if (isInsideDough(dough.x, dough.y)) onTap(dough.x, dough.y);
      gestureRef.current = createGestureState();
      return;
    }

    // Sauce paint (legacy, non-Reference path): commit wherever the stroke last touched the
    // dough, clamped onto it so releasing just past the rim still lands cleanly instead of
    // doing nothing.
    const commitPoint = g.lastInsideDough ?? g.startDough;
    const clamped = clampToDough(commitPoint.x, commitPoint.y);
    onTap(clamped.x, clamped.y);

    // Let the freehand trail sit for a beat, then fade it as the real sauce layer spreads in
    // (Phase 2C's sauce-spread keyframes), so painting reads as "this became the sauce".
    pathRef.current?.classList.add("pizza-paint-trail__stroke--fade");
    fadeTimeoutRef.current = window.setTimeout(clearTrail, TRAIL_FADE_MS);

    gestureRef.current = createGestureState();
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId) return;
    releaseCapture(event);
    if (activeSessionRef.current?.pointerId === event.pointerId) endDispenseSession(false);
    discardDoughGesture();
    clearCutPreviewLine();
    clearTrail();
    gestureRef.current = createGestureState();
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    // A browser can revoke pointer capture without ever firing pointercancel (e.g. a system
    // gesture stealing it) -- treat that exactly like pointercancel so a dispense session
    // (or an in-progress topping/sauce/dough/CUT gesture) can never keep running with nothing
    // left able to stop it. Safe even when this pointerId was never the active gesture.
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId) return;
    if (activeSessionRef.current?.pointerId === event.pointerId) endDispenseSession(false);
    discardDoughGesture();
    clearCutPreviewLine();
    clearTrail();
    gestureRef.current = createGestureState();
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    // MUST FIX 9: a long-press dispense hold must never surface the browser's own
    // long-press context menu / callout mid-gesture.
    if (gestureRef.current.pointerId !== null) event.preventDefault();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    // PR #26 Final P2 Follow-up #2 (discussion_r4021268603): a SPREAD ingredient (tomato-sauce's
    // Reference dispense path) has no real keyboard interaction yet -- the generic center-point
    // onTap silently dispatches APPLY_SAUCE without ever populating sauceDeposits, so Reference
    // Sauce rendering (which only draws from deposits) and Sauce Metrics both stay blank/zero
    // while pizza state has actually changed. Rather than invent a keyboard Sauce painter in
    // this PR, don't expose a "placement" for SPREAD at all; scatter (TAP_PLACE) toppings are
    // unaffected and keep the exact behavior below. isKeyboardPlaceable (tabIndex/aria-label
    // below) already keeps the dough out of the tab order in this state, but this guard is the
    // one that actually matters -- a click can still focus a tabIndex={-1} element.
    if (isPaintMode) return;
    // discussion_r4021268607: holding Enter/Space auto-repeats keydown, and each event used to
    // call onTap again -- one physical key press must place at most one piece.
    if (event.repeat) return;
    onTap(50, 50);
  }

  const sauceId = pizza.sauceIds[0];
  const sauceIngredient = sauceId ? getIngredient(sauceId) : undefined;
  const isOilSauce = sauceIngredient?.id === "olive-oil";
  const bakeState = bakeProgress !== null ? classifyBake(bakeProgress, recipe.bakeTarget) : null;
  // M3A Bake Judgment: `bakeHeat` (see ../logic/bakeVisual.ts's own file header) is the
  // continuous doneness scalar every visual below reads instead of `bakeState` -- `bakeState`
  // itself is kept only for the one thing that still legitimately wants a hard reveal, the
  // RESULT-screen perfect glow further down (gated on `resultRevealed`, i.e. after the
  // player has already committed their CONFIRM_BAKE tap, not a BAKE-time "tell").
  const bakeHeat = bakeProgress === null ? 0 : computeBakeHeat(bakeProgress, recipe.bakeTarget);
  const doughColors = bakeProgress === null ? null : doughVisualColors(bakeHeat);
  const doughShapeStyle: CSSProperties | undefined = doughColors
    ? {
        background: `radial-gradient(circle at 40% 35%, ${doughColors.colorA}, ${doughColors.colorB} 85%)`,
      }
    : undefined;
  const cheeseFrame = bakeProgress === null ? null : cheeseVisualFrame(bakeHeat);
  const cheeseStyle: CSSProperties | undefined = cheeseFrame
    ? ({
        "--bake-melt-scale": cheeseFrame.scale,
        filter: `brightness(${cheeseFrame.brightness.toFixed(3)}) saturate(${cheeseFrame.saturate.toFixed(3)}) sepia(${cheeseFrame.sepia.toFixed(3)})`,
      } as CSSProperties)
    : undefined;
  const bakeCharIntensity = bakeProgress === null ? 0 : charIntensity(bakeHeat);
  const bakeRawSheenIntensity = bakeProgress === null ? 0 : rawSheenIntensity(bakeHeat);
  // sauceOrigin.x/y are dough-local percent, but the clip-path "at X% Y%" on .pizza-sauce-layer
  // resolves against that layer's own box, which is inset 6% from the dough. Re-project into
  // the sauce layer's coordinate space so the spread starts under the tap/paint point.
  const sauceOrigin = pizza.sauceOrigin ?? { x: 50, y: 50 };
  const sauceOriginStyle = {
    "--sauce-origin-x": `${toSauceLayerPercent(sauceOrigin.x)}%`,
    "--sauce-origin-y": `${toSauceLayerPercent(sauceOrigin.y)}%`,
  } as CSSProperties;
  const trailStrokeStyle = { stroke: activeIngredient?.color ?? "#c73b2e" } as CSSProperties;

  // Pizza Cutting 1.0 Phase 2 (design doc §8.2): `cutRequiredCount` evenly-spaced full diameters
  // through the dough's exact center -- the "aim for these" guide, faded by the effect above.
  const cutGuideLines = useMemo(() => {
    if (!isCutStep) return [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < cutRequiredCount; i += 1) {
      const angle = (Math.PI * i) / cutRequiredCount;
      const dx = Math.cos(angle) * DOUGH_RADIUS;
      const dy = Math.sin(angle) * DOUGH_RADIUS;
      lines.push({
        x1: DOUGH_CENTER - dx,
        y1: DOUGH_CENTER - dy,
        x2: DOUGH_CENTER + dx,
        y2: DOUGH_CENTER + dy,
      });
    }
    return lines;
  }, [isCutStep, cutRequiredCount]);

  // Issue #33 D1: the shape actually drawn -- the live in-progress gesture's shape while one
  // is active, otherwise the canonical committed `pizza.doughShape` (carried through every
  // later making step/BAKE/RESULT unchanged, since COMMIT_DOUGH_STRETCH only ever fires
  // while makingStep is still "DOUGH" -- see gameReducer.ts). Mirrors `effectiveDeposits`'
  // own ref-plus-pendingVersion pattern immediately below.
  const displayDoughShape = useMemo<DoughShape>(() => {
    return doughGestureShapeRef.current ?? pizza.doughShape;
    // pendingVersion is the reactive proxy for doughGestureShapeRef.current -- see its own
    // declaration above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pizza.doughShape, pendingVersion]);
  // objectBoundingBox clipPath units (0-1 fractions) so the clip stays correct regardless of
  // .pizza-dough's own responsive rendered pixel size (min(78vw, 300px)) -- see the CSS's own
  // comment on .pizza-dough-shape for why clip-path targets the dedicated inner layer rather
  // than .pizza-dough itself.
  const doughClipPathD = useMemo(
    () => smoothDoughShapeForDisplay(displayDoughShape, 0.01),
    [displayDoughShape],
  );

  // Sauce parity keeps the Phase 4A-1A visual-truth contract for every recipe: the sauce is
  // represented only by the field-derived heatmap while a gesture is pending and after it
  // commits. A flat, full-circle fill would misrepresent low coverage as sauce everywhere.
  // Issue #32 sauce parity fix: this used to require the *committed* sauce to match
  // `sauceInteractionProfile.ingredientId` -- that made a committed off-recipe sauce fall
  // back to the flat legacy layer below even though COMMIT_SAUCE_DISPENSE (the only action
  // that ever populates `sauceDeposits`) now accepts every sauce ingredient. Checking
  // `sauceDeposits.length` instead keys off which *path* actually produced this pizza's
  // committed sauce -- the legacy one-shot `APPLY_SAUCE` always resets deposits to `[]`
  // (gameReducer.ts), so any non-empty deposit log can only have come from the dispense
  // pipeline, whatever ingredient it's for.
  const hasCommittedFieldDeposits = pizza.sauceDeposits.length > 0;
  const hasActiveDispenseSession = activeSessionRef.current !== null;
  const isFieldSauceContext = hasCommittedFieldDeposits || hasActiveDispenseSession;
  const effectiveDeposits = useMemo<readonly SauceDeposit[]>(() => {
    if (!isFieldSauceContext || pendingDepositsRef.current.length === 0) {
      return pizza.sauceDeposits;
    }
    return [...pizza.sauceDeposits, ...pendingDepositsRef.current];
    // pendingVersion is the reactive proxy for pendingDepositsRef.current -- see its own
    // declaration above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFieldSauceContext, pizza.sauceDeposits, pendingVersion]);
  const showSauceHeatmap = isFieldSauceContext && effectiveDeposits.length > 0;
  const fieldSauceColor = sauceIngredient?.color ?? activeIngredient?.color ?? "#c73b2e";

  // Issue #167 PR-B (Reference Truth): the field-rasterization pipeline (buildSauceField ->
  // smoothSauceFieldForDisplay -> sauceFieldToRgbaPixels) that used to live inline here has
  // moved to `SauceHeatmapCanvas` (../components/SauceHeatmapCanvas.tsx), shared verbatim with
  // the static Reference views -- see that component's own doc comment. This effect now only
  // draws the overflow markers, which stay PizzaStage-only: an interactive, in-progress
  // painting-mistake signal with no meaning for a static target that is correct by
  // construction. Overlaid in its own canvas, same box as SauceHeatmapCanvas's, drawn after it
  // in DOM order.
  useEffect(() => {
    if (!showSauceHeatmap) return;
    const canvas = overflowCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Overflow markers where sauce landed off (or straddling) the player's *actual* dough
    // silhouette -- alpha scaled by how much of that deposit actually missed it, so a near-rim
    // dab reads as a faint touch and a fully overflowed one (genuinely off the dough entirely)
    // as a solid mark. Only sauce that misses the real (possibly D3A-distorted) dough shape
    // gets this treatment now; sauce inside it, even past the old fixed DOUGH_RADIUS circle, is
    // real heatmap paint (SauceHeatmapCanvas), not a marker dot.
    for (const deposit of effectiveDeposits) {
      const overflowFraction = 1 - insideDoughShapeFraction(pizza.doughShape, deposit.x, deposit.y);
      if (overflowFraction <= 0) continue;
      const px = (deposit.x / 100) * canvas.width;
      const py = (deposit.y / 100) * canvas.height;
      ctx.save();
      ctx.globalAlpha = 0.55 * overflowFraction;
      ctx.fillStyle = fieldSauceColor;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [showSauceHeatmap, effectiveDeposits, fieldSauceColor, pizza.doughShape]);

  const stageClassName = `pizza-stage ${roomy ? "pizza-stage--roomy" : ""} ${compact ? "pizza-stage--compact" : ""}`;

  return (
    <div className={stageClassName}>
      <div
        ref={setDoughElement}
        data-pizza-drop-target="true"
        role="button"
        tabIndex={isKeyboardPlaceable ? 0 : -1}
        aria-label={isKeyboardPlaceable ? "ピザ。選択中の素材を置くにはEnterまたはスペース" : "ピザ"}
        className={`pizza-dough ${interactive ? "pizza-dough--interactive" : ""} ${
          bakeState ? `pizza-dough--${bakeState}` : ""
        } ${showDoughShape ? "pizza-dough--has-shape-layer" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {/* Issue #33 D1: the player's actual hand-shaped dough boundary -- rendered from
            `displayDoughShape` (the live in-progress gesture while dragging, else the
            canonical committed `pizza.doughShape`), clipped to itself via an
            objectBoundingBox <clipPath> so only this layer (not the outer .pizza-dough
            plate/border) takes the organic shape. First child (below sauce/heatmap/toppings)
            so they visually sit on top of it, satisfying "sauce/cheese/toppings sit on the
            shaped dough" with no per-layer change needed elsewhere. Carries through every
            phase once the round has entered PREPARE (`showDoughShape`), including BAKE/RESULT's
            own continuous doneness coloring (M3A Bake Judgment: `doughShapeStyle` above,
            ../logic/bakeVisual.ts) overriding App.css's neutral has-shape-layer default. */}
        {showDoughShape && (
          <div
            className="pizza-dough-shape"
            aria-hidden="true"
            style={{ clipPath: `url(#${doughClipId})`, ...doughShapeStyle }}
          >
            <svg width="0" height="0" style={{ position: "absolute" }}>
              <defs>
                <clipPath id={doughClipId} clipPathUnits="objectBoundingBox">
                  <path d={doughClipPathD} />
                </clipPath>
              </defs>
            </svg>
          </div>
        )}
        {/* Issue #33 D1: a faint dashed ring at the full DOUGH_RADIUS target -- the same
            "paint/stretch up to here" guide convention as Human Feel Fix 2's own
            sauce-target-guide below, so a first-time player always has a visible target to
            pull the dough out toward even while it's still small. Shown only during the
            DOUGH step's own interaction, never once it's confirmed. */}
        {isDoughStep && interactive && (
          <svg className="dough-target-guide" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={DOUGH_RADIUS} />
          </svg>
        )}
        {/* Human Feel Fix 2 (Target Area Guide): a very faint, dashed "paint up to here"
            ring at SAUCE_TARGET_RADIUS -- the exact same constant edgeAmount/edgeRatio
            (../logic/sauceField.ts) score against, so this can never show a different area
            than what actually counts as "the ear" (brief section 5). First child, no
            z-index, so it sits below the sauce/heatmap/toppings that follow it by DOM order
            alone -- same convention the heatmap itself already uses. Shown only while the
            player can actually paint (referenceModeEnabled + interactive), never during
            BAKE/RESULT or behind the Reference popover. */}
        {referenceModeEnabled && interactive && (
          <svg className="sauce-target-guide" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={SAUCE_TARGET_RADIUS} />
          </svg>
        )}
        {sauceIngredient && !isFieldSauceContext && (
          <div
            key={pizza.sauceToken}
            className={`pizza-sauce-layer ${isOilSauce ? "pizza-sauce-layer--oil" : ""}`}
            style={{
              ...(isOilSauce ? {} : { backgroundColor: sauceIngredient.color, opacity: 0.85 }),
              ...sauceOriginStyle,
            }}
          />
        )}
        {showSauceHeatmap && (
          <SauceHeatmapCanvas
            deposits={effectiveDeposits}
            doughShape={pizza.doughShape}
            color={fieldSauceColor}
            className={`pizza-sauce-heatmap ${isOilSauce ? "pizza-sauce-heatmap--oil" : ""} ${
              bakeState ? `pizza-sauce-heatmap--${bakeState}` : ""
            }`}
          />
        )}
        {/* Issue #167 PR-B (Reference Truth): overflow markers (see the effect above) live in
            their own overlaid canvas now that the base sauce pixels render via the shared
            SauceHeatmapCanvas -- same box/filter classes (so the markers keep the exact same
            blur/bake-state tint the pre-extraction single-canvas version applied to them),
            drawn after it in DOM order so the markers sit on top. */}
        {showSauceHeatmap && (
          <canvas
            ref={overflowCanvasRef}
            className={`pizza-sauce-heatmap ${isOilSauce ? "pizza-sauce-heatmap--oil" : ""} ${
              bakeState ? `pizza-sauce-heatmap--${bakeState}` : ""
            }`}
            width={OVERFLOW_MARKER_CANVAS_PX}
            height={OVERFLOW_MARKER_CANVAS_PX}
            aria-hidden="true"
          />
        )}
        {/* Issue #159 P1 (olive oil visibility): olive oil's own paint color (#e9d9a0,
            ingredients.ts) is a near-match for the dough's own warm pale gold background, so
            even with the existing saturate/contrast/drop-shadow filter (Issue #32 Finding 2-A/
            2-B, above) a real-device Fresh Audit (2026-09-21) still found it hard to read at a
            glance. This adds a distinct glossy highlight sweep + a soft ring tracing the dough's
            own edge -- rendering-only (a `pointer-events: none` decorative layer keyed off the
            same `isOilSauce`/`showSauceHeatmap`/`!isFieldSauceContext` conditions the sauce
            visuals above already use), never reads or writes
            `sauceDeposits`/`sauceIds`/anything Scoring 2.0 sees. */}
        {isOilSauce && (showSauceHeatmap || !isFieldSauceContext) && (
          <div className="pizza-sauce-oil-sheen" aria-hidden="true" />
        )}
        {pizza.toppings.map((t) => {
          const ingredient = getIngredient(t.ingredientId);
          if (!ingredient) return null;
          return (
            <span
              key={t.id}
              className={`pizza-topping pizza-topping--${ingredient.id}`}
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                "--piece-rotation": `${stablePieceRotation(t.ingredientId, t.x, t.y)}deg`,
              } as CSSProperties}
            >
              {/* Issue #167 PR-B (Reference Truth): unified with every Reference view's own
                  piece rendering (renderPizzaVisualPieces, ../components/PizzaVisualPieces.tsx)
                  -- both branches now always go through IngredientPieceVisual, instead of a
                  locally hand-rolled `.pizza-topping__emoji` span bypassing it for non-cheese
                  ingredients. `cheeseStyle` (bake melt/toast/char) is a no-op for the emoji
                  branch (IngredientPieceVisual only applies `style` there for forward-compat --
                  see its own doc comment), so this is a pure consolidation, not a behavior
                  change for either branch. */}
              <IngredientPieceVisual ingredient={ingredient} style={cheeseStyle} />
            </span>
          );
        })}
        {placement?.status === "rejected" && (
          <span
            key={placement.token}
            className="pizza-reject-mark"
            style={{ left: `${placement.x}%`, top: `${placement.y}%` }}
          >
            {"✕"}
          </span>
        )}
        {/* M3A Bake Judgment: the old `pizza-bake-overlay--raw/--perfect/--burnt` swapped
            `background` (a radial-gradient) per discrete `bakeState` -- the same un-animatable
            snap `../logic/bakeVisual.ts`'s file header documents for the dough color. Split
            into two always-mounted layers whose only per-frame change is `opacity` (which
            *does* transition/interpolate natively), each driven by a continuous intensity, so
            neither can pop in or swap look at a fixed instant. */}
        {bakeProgress !== null && (
          <>
            <div className="pizza-bake-overlay pizza-bake-overlay--sheen" style={{ opacity: bakeRawSheenIntensity * 0.5 }} />
            <div className="pizza-bake-overlay pizza-bake-overlay--char" style={{ opacity: bakeCharIntensity * 0.85 }} />
          </>
        )}
        {bakeProgress !== null && (
          <>
            <div className="pizza-char-spots" style={{ opacity: bakeCharIntensity }} />
            {/* `smoke-rise`'s own keyframes (App.css) already drive this span's opacity each
                cycle -- a CSS animation always wins the cascade over an inline style on the
                same property, so `bakeCharIntensity` fades a wrapping element instead. */}
            <span className="pizza-smoke-wrap" style={{ left: "32%", top: "18%", opacity: bakeCharIntensity }}>
              <span className="pizza-smoke">{"\u{1F4A8}"}</span>
            </span>
            <span className="pizza-smoke-wrap" style={{ left: "62%", top: "24%", opacity: bakeCharIntensity }}>
              <span className="pizza-smoke pizza-smoke--delay">{"\u{1F4A8}"}</span>
            </span>
          </>
        )}
        {resultRevealed && bakeState === "perfect" && (
          <div key="perfect-glow" className="pizza-perfect-glow" />
        )}
        {/* Pizza Cutting 1.0 Phase 2 (design doc §8): angle guide (fades, §8.2.1) + persistent
            center marker + committed cut lines + the in-progress drag preview, all in the same
            0-100 dough-percent coordinate space every other overlay already uses. Shown only
            while CUT is actually the active step. */}
        {isCutStep && (
          <svg className="pizza-cut-layer" viewBox="0 0 100 100" aria-hidden="true">
            <g ref={cutGuideGroupRef} className="pizza-cut-guide-lines">
              {cutGuideLines.map((line, index) => (
                <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              ))}
            </g>
            <circle className="pizza-cut-guide-center" cx={DOUGH_CENTER} cy={DOUGH_CENTER} r={1.4} />
            {cutState.lines.map((line, index) => (
              <line
                key={index}
                className="pizza-cut-line"
                x1={line.start.x}
                y1={line.start.y}
                x2={line.end.x}
                y2={line.end.y}
              />
            ))}
            <line
              ref={cutPreviewLineRef}
              className="pizza-cut-preview-line"
              x1={0}
              y1={0}
              x2={0}
              y2={0}
              style={{ opacity: 0 }}
            />
          </svg>
        )}
        {isCutStep && (
          <span ref={cutCutterIconRef} className="pizza-cut-cutter-icon" aria-hidden="true" style={{ opacity: 0 }}>
            {"\u{1F52A}"}
          </span>
        )}
        <svg className="pizza-paint-trail" viewBox="0 0 100 100" aria-hidden="true">
          <path ref={pathRef} className="pizza-paint-trail__stroke" style={trailStrokeStyle} />
        </svg>
      </div>
    </div>
  );
}
