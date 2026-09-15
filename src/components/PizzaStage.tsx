import {
  useEffect,
  useMemo,
  useReducer as useReactReducer,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getIngredient, type Ingredient } from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import type { PizzaState, PlacementFeedback, SauceDeposit } from "../state/pizzaState";
import { classifyBake } from "../logic/bake";
import { SauceDispenseController } from "../logic/sauceDispenseController";
import {
  buildSauceField,
  insideDoughFraction,
  isCellInsideDough,
  SAUCE_FIELD_SIZE,
} from "../logic/sauceField";
import {
  clampToDough,
  clientPointToDoughPercent,
  isInsideDough,
  toSauceLayerPercent,
  type DoughPoint,
} from "../logic/pizzaCoordinates";

/** Screen-space finger/mouse movement (px) before a press becomes a drag instead of a tap. */
const DRAG_THRESHOLD_PX = 10;
/** How long the freehand paint trail lingers before fading, roughly matching the sauce-spread
 * animation's own duration so the trail reads as "becoming" the sauce rather than vanishing. */
const TRAIL_FADE_MS = 260;
/** Internal pixel resolution of the Phase 4A-1A sauce heatmap canvas -- purely a rendering
 * detail, independent of SAUCE_FIELD_SIZE (the 16x16 metrics grid it visualizes). */
const HEATMAP_CANVAS_PX = 200;

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
  /** Phase 4A-1A: true only for the Margherita Reference prototype in free play (never
   *  Mission play, never any other recipe -- see App.tsx's `referenceModeEnabled`). Gates
   *  the hold-to-build-quantity tomato-sauce dispenser and its heatmap visualization;
   *  every other ingredient/recipe/phase keeps the original Phase 3A tap/drag-commit path
   *  below completely untouched. Also doubles as this component's one and only "abort any
   *  active dispense session" switch: App.tsx sets this false while the Reference popover
   *  is open, reusing the same effect BAKE already aborts through (Codex Broad Review MUST
   *  FIX 1 -- Gesture Session Safety).
   */
  referenceModeEnabled: boolean;
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
  onTap,
  onDispenseProgress,
  onDispenseCommit,
}: PizzaStageProps) {
  const circleRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const heatmapRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<GestureState>(createGestureState());
  const fadeTimeoutRef = useRef<number | null>(null);

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
    if (commit && session && pendingDepositsRef.current.length > 0) {
      onDispenseCommit(session.ingredientId, pendingDepositsRef.current);
    }
    resetSessionBuffers();
    onDispenseProgress([]);
    forceRender();
  }

  /** Shared cleanup for every abort trigger (ingredient change, Reference overlay open via
   *  `interactive`, BAKE via `interactive`, blur/hidden, window-level fallback): discards
   *  any active session, releases pointer capture if still held, and resets the gesture. */
  function abortActiveGesture() {
    const pointerId = gestureRef.current.pointerId;
    if (activeSessionRef.current) endDispenseSession(false);
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
      if (activeSessionRef.current) abortActiveGesture();
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

  const isPaintMode = activeIngredient?.placement === "spread";

  /** Starts a Phase 4A-1A dispense session for `pointerId` at `dough`, snapshotting the
   *  ingredient it's for, and drives it from a requestAnimationFrame loop keyed on real
   *  timestamps (never on how many pointermove events fire) -- see
   *  SauceDispenseController's own doc comment for why. */
  function startDispenseSession(pointerId: number, ingredientId: string, dough: DoughPoint) {
    sessionTokenCounterRef.current += 1;
    const token = sessionTokenCounterRef.current;
    activeSessionRef.current = { token, pointerId, ingredientId };
    resetSessionBuffers();

    const controller = new SauceDispenseController({
      onDeposit: (deposit) => appendPendingDeposit(deposit),
      getTotalDispensed: () => committedTotalRef.current + pendingTotalRef.current,
    });
    dispenseControllerRef.current = controller;
    controller.start(performance.now(), dough);

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

    const wantsReferenceDispense =
      referenceModeEnabled && isPaintMode && activeIngredient?.id === "tomato-sauce";
    if (wantsReferenceDispense && activeIngredient) {
      // Sauce starts coming out the instant the dispenser is pressed, not on release --
      // draw the trail's first point immediately to match.
      appendTrailPoint(dough.x, dough.y);
      startDispenseSession(event.pointerId, activeIngredient.id, dough);
    }
  }

  function processMovePoint(clientX: number, clientY: number, pointerId: number) {
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
      if (isInsideDough(dough.x, dough.y)) g.lastInsideDough = dough;
      appendTrailPoint(dough.x, dough.y);
      dispenseControllerRef.current?.move(dough, performance.now());
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
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId || !g.rect) return;

    // Coalesced events give the finer-grained samples the browser batched between frames,
    // so a fast drag still produces a continuous trail instead of a few widely-spaced dots.
    // Position interpolation only -- see processMovePoint's session branch above for why
    // this can never be used to compute dispensed quantity.
    let events: Array<{ clientX: number; clientY: number }> = [event.nativeEvent];
    try {
      const coalesced = event.nativeEvent.getCoalescedEvents?.();
      if (coalesced && coalesced.length > 0) events = coalesced;
    } catch {
      // Fall back to the single event above.
    }

    for (const point of events) {
      processMovePoint(point.clientX, point.clientY, event.pointerId);
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

    const rect = g.rect;
    if (!rect) {
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
    clearTrail();
    gestureRef.current = createGestureState();
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    // A browser can revoke pointer capture without ever firing pointercancel (e.g. a system
    // gesture stealing it) -- treat that exactly like pointercancel so a dispense session
    // (or an in-progress topping/sauce drag) can never keep running with nothing left able
    // to stop it. Safe even when this pointerId was never the active gesture.
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId) return;
    if (activeSessionRef.current?.pointerId === event.pointerId) endDispenseSession(false);
    clearTrail();
    gestureRef.current = createGestureState();
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    // MUST FIX 9: a long-press dispense hold must never surface the browser's own
    // long-press context menu / callout mid-gesture.
    if (gestureRef.current.pointerId !== null) event.preventDefault();
  }

  const sauceId = pizza.sauceIds[0];
  const sauceIngredient = sauceId ? getIngredient(sauceId) : undefined;
  const isOilSauce = sauceIngredient?.id === "olive-oil";
  const bakeState = bakeProgress !== null ? classifyBake(bakeProgress, recipe.bakeTarget) : null;
  const bakeIntensity = bakeProgress === null ? 0 : Math.min(1, bakeProgress / 100);
  const meltClass =
    bakeState === "perfect"
      ? "pizza-cheese--melted pizza-cheese--toasted"
      : bakeState === "burnt"
        ? "pizza-cheese--melted pizza-cheese--charred"
        : "";
  // sauceOrigin.x/y are dough-local percent, but the clip-path "at X% Y%" on .pizza-sauce-layer
  // resolves against that layer's own box, which is inset 6% from the dough. Re-project into
  // the sauce layer's coordinate space so the spread starts under the tap/paint point.
  const sauceOrigin = pizza.sauceOrigin ?? { x: 50, y: 50 };
  const sauceOriginStyle = {
    "--sauce-origin-x": `${toSauceLayerPercent(sauceOrigin.x)}%`,
    "--sauce-origin-y": `${toSauceLayerPercent(sauceOrigin.y)}%`,
  } as CSSProperties;
  const trailStrokeStyle = { stroke: activeIngredient?.color ?? "#c73b2e" } as CSSProperties;

  // Phase 4A-1A (Post-Codex-Fix) MUST FIX 8 -- Visual Truth: the Margherita Reference
  // prototype's tomato sauce is represented *only* by the field-derived heatmap below, both
  // while an active dispense session is buffering uncommitted ticks and once a stroke is
  // committed -- never by the flat, full-circle base fill every other sauce/recipe still
  // uses (a uniformly-tinted whole dough would misrepresent low coverage as "sauce
  // everywhere, just faint", exactly the complaint this fixes). `isReferenceSauceContext`
  // covers both cases so the flat fill and the heatmap never both try to render at once.
  const committedSauceIsTomatoReference = referenceModeEnabled && sauceIngredient?.id === "tomato-sauce";
  const hasActiveReferenceSession = activeSessionRef.current !== null;
  const isReferenceSauceContext = committedSauceIsTomatoReference || hasActiveReferenceSession;
  const effectiveDeposits = useMemo<readonly SauceDeposit[]>(() => {
    if (!isReferenceSauceContext || pendingDepositsRef.current.length === 0) {
      return pizza.sauceDeposits;
    }
    return [...pizza.sauceDeposits, ...pendingDepositsRef.current];
    // pendingVersion is the reactive proxy for pendingDepositsRef.current -- see its own
    // declaration above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReferenceSauceContext, pizza.sauceDeposits, pendingVersion]);
  const showSauceHeatmap = isReferenceSauceContext && effectiveDeposits.length > 0;

  useEffect(() => {
    if (!showSauceHeatmap) return;
    const canvas = heatmapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // MUST FIX 5: each deposit's amount is split continuously between its inside-dough
    // share (what the heatmap paints) and its overflow share (drawn as a faint marker
    // below), via the exact same insideDoughFraction the metrics use -- so the visual and
    // the numbers can never disagree about a deposit straddling the rim.
    const insideWeighted = effectiveDeposits
      .map((d) => ({ x: d.x, y: d.y, amount: d.amount * insideDoughFraction(d.x, d.y) }))
      .filter((d) => d.amount > 0);
    const field = buildSauceField(insideWeighted);
    const cellPx = canvas.width / SAUCE_FIELD_SIZE;

    for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
      for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
        if (!isCellInsideDough(row, col)) continue;
        const value = field[row * SAUCE_FIELD_SIZE + col];
        if (value <= 0.005) continue;
        const alpha = Math.min(0.85, value * 2.2);
        ctx.fillStyle = `rgba(196, 46, 34, ${alpha})`;
        ctx.fillRect(col * cellPx, row * cellPx, cellPx + 0.5, cellPx + 0.5);
      }
    }

    // Overflow markers where sauce landed off (or straddling) the dough -- alpha scaled by
    // how much of that deposit actually missed, so a near-rim dab reads as a faint touch and
    // a fully overflowed one as a solid mark, matching the continuous split above.
    for (const deposit of effectiveDeposits) {
      const overflowFraction = 1 - insideDoughFraction(deposit.x, deposit.y);
      if (overflowFraction <= 0) continue;
      const px = (deposit.x / 100) * canvas.width;
      const py = (deposit.y / 100) * canvas.height;
      ctx.fillStyle = `rgba(196, 46, 34, ${0.55 * overflowFraction})`;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [showSauceHeatmap, effectiveDeposits]);

  return (
    <div className="pizza-stage">
      <div
        ref={circleRef}
        className={`pizza-dough ${interactive ? "pizza-dough--interactive" : ""} ${
          bakeState ? `pizza-dough--${bakeState}` : ""
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onContextMenu={handleContextMenu}
      >
        {sauceIngredient && !isReferenceSauceContext && (
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
          <canvas
            ref={heatmapRef}
            className={`pizza-sauce-heatmap ${bakeState ? `pizza-sauce-heatmap--${bakeState}` : ""}`}
            width={HEATMAP_CANVAS_PX}
            height={HEATMAP_CANVAS_PX}
            aria-hidden="true"
          />
        )}
        {pizza.toppings.map((t) => {
          const ingredient = getIngredient(t.ingredientId);
          if (!ingredient) return null;
          return (
            <span
              key={t.id}
              className="pizza-topping"
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              {ingredient.category === "cheese" ? (
                <span
                  className={`pizza-cheese pizza-cheese--${ingredient.id} ${meltClass}`}
                  style={{ "--cheese-color": ingredient.color } as CSSProperties}
                />
              ) : (
                <span className="pizza-topping__emoji">{ingredient.emoji}</span>
              )}
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
        {bakeState && (
          <div
            className={`pizza-bake-overlay pizza-bake-overlay--${bakeState}`}
            style={{ opacity: bakeState === "perfect" ? 0.3 + bakeIntensity * 0.25 : undefined }}
          />
        )}
        {bakeState === "burnt" && (
          <>
            <div className="pizza-char-spots" />
            <span className="pizza-smoke" style={{ left: "32%", top: "18%" }}>
              {"\u{1F4A8}"}
            </span>
            <span className="pizza-smoke pizza-smoke--delay" style={{ left: "62%", top: "24%" }}>
              {"\u{1F4A8}"}
            </span>
          </>
        )}
        {resultRevealed && bakeState === "perfect" && (
          <div key="perfect-glow" className="pizza-perfect-glow" />
        )}
        <svg className="pizza-paint-trail" viewBox="0 0 100 100" aria-hidden="true">
          <path ref={pathRef} className="pizza-paint-trail__stroke" style={trailStrokeStyle} />
        </svg>
      </div>
    </div>
  );
}
