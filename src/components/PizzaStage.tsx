import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getIngredient, type Ingredient } from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import type { PizzaState, PlacementFeedback } from "../state/pizzaState";
import { classifyBake } from "../logic/bake";
import { SauceDispenseController } from "../logic/sauceDispenseController";
import {
  buildSauceField,
  computeSauceMetrics,
  isCellInsideDough,
  SAUCE_FIELD_SIZE,
  totalDispensed,
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
   *  below completely untouched. */
  referenceModeEnabled: boolean;
  onTap: (xPercent: number, yPercent: number) => void;
  /** Phase 4A-1A: fired once per dispense tick while painting tomato sauce in Reference
   *  mode (see `referenceModeEnabled`). Never fired for any other ingredient/recipe. */
  onSauceDeposit: (ingredientId: string, xPercent: number, yPercent: number, amount: number) => void;
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
  onSauceDeposit,
}: PizzaStageProps) {
  const circleRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const heatmapRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<GestureState>(createGestureState());
  const fadeTimeoutRef = useRef<number | null>(null);
  // Phase 4A-1A dispense session (see ../logic/sauceDispenseController.ts). Both refs are
  // only ever non-null between a reference-mode pointerdown and its stopDispensing() --
  // stopDispensing() is unconditionally safe to call even when neither is set.
  const dispenseControllerRef = useRef<SauceDispenseController | null>(null);
  const dispenseRafRef = useRef<number | null>(null);
  // Kept in sync with pizza.sauceDeposits below so the dispense controller can read "how
  // much has this application already put down (inside dough + overflow)" without holding
  // its own copy of state that could drift from the reducer's.
  const totalDispensedRef = useRef(0);

  const isPaintMode = activeIngredient?.placement === "spread";
  const isTomatoSauceReference =
    referenceModeEnabled && isPaintMode && activeIngredient?.id === "tomato-sauce";

  useEffect(() => {
    totalDispensedRef.current = totalDispensed(pizza.sauceDeposits);
  }, [pizza.sauceDeposits]);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current !== null) window.clearTimeout(fadeTimeoutRef.current);
      stopDispensing();
    };
  }, []);

  // If interaction is disabled mid-gesture (e.g. the player starts BAKE with a second
  // pointer while the first is still down on the dough), abort immediately rather than
  // letting a since-stale pointerup still commit APPLY_SAUCE/DEPOSIT_SAUCE into a later
  // phase. This is the fix for the Phase 3A BAKE race, extended to also stop a Phase 4A-1A
  // dispense session the same way -- never leave its timer loop running past this point.
  useEffect(() => {
    if (interactive) return;
    const g = gestureRef.current;
    if (g.pointerId === null) return;
    try {
      circleRef.current?.releasePointerCapture(g.pointerId);
    } catch {
      // Already released.
    }
    stopDispensing();
    clearTrail();
    gestureRef.current = createGestureState();
  }, [interactive]);

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

  function appendPoint(x: number, y: number) {
    const g = gestureRef.current;
    g.pathD += g.pathD ? ` L ${x.toFixed(2)} ${y.toFixed(2)}` : `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    pathRef.current?.setAttribute("d", g.pathD);
  }

  /** Starts a Phase 4A-1A dispense session at `dough` and drives it from a
   *  requestAnimationFrame loop keyed on real timestamps (never on how many pointermove
   *  events fire) -- see SauceDispenseController's own doc comment for why. */
  function startDispensing(dough: DoughPoint) {
    if (!activeIngredient) return;
    const ingredientId = activeIngredient.id;
    const controller = new SauceDispenseController({
      onDeposit: (deposit) => onSauceDeposit(ingredientId, deposit.x, deposit.y, deposit.amount),
      getTotalDispensed: () => totalDispensedRef.current,
    });
    dispenseControllerRef.current = controller;
    controller.start(performance.now(), dough);

    const loop = (now: number) => {
      controller.step(now);
      dispenseRafRef.current = controller.isActive ? requestAnimationFrame(loop) : null;
    };
    dispenseRafRef.current = requestAnimationFrame(loop);
  }

  function stopDispensing() {
    if (dispenseRafRef.current !== null) {
      cancelAnimationFrame(dispenseRafRef.current);
      dispenseRafRef.current = null;
    }
    dispenseControllerRef.current?.stop();
    dispenseControllerRef.current = null;
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

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers can refuse capture; the drag still works via normal event bubbling.
    }

    if (isTomatoSauceReference) {
      // Sauce starts coming out the instant the dispenser is pressed, not on release --
      // draw the trail's first point immediately to match.
      appendPoint(dough.x, dough.y);
      startDispensing(dough);
    }
  }

  function processMovePoint(clientX: number, clientY: number) {
    const g = gestureRef.current;
    if (!g.rect) return;

    const dough = clientPointToDoughPercent(clientX, clientY, g.rect);

    if (isTomatoSauceReference) {
      // Reference dispense mode: quantity is produced only by the timer loop started in
      // startDispensing() above (see SauceDispenseController). A move only updates the
      // trail and where the *next* timed tick lands -- it never deposits by itself, or a
      // fast drag firing many pointermove events would dispense more sauce than a slow one
      // over the same hold, exactly what SAUCE_TICK_MS-based ticking is meant to prevent.
      if (isInsideDough(dough.x, dough.y)) g.lastInsideDough = dough;
      appendPoint(dough.x, dough.y);
      dispenseControllerRef.current?.move(dough);
      return;
    }

    if (!g.dragging) {
      const dx = clientX - g.startClientX;
      const dy = clientY - g.startClientY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      if (isPaintMode) appendPoint(g.startDough.x, g.startDough.y);
    }

    if (isInsideDough(dough.x, dough.y)) g.lastInsideDough = dough;
    if (isPaintMode) appendPoint(dough.x, dough.y);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId || !g.rect) return;

    // Coalesced events give the finer-grained samples the browser batched between frames,
    // so a fast drag still produces a continuous trail instead of a few widely-spaced dots.
    // Position interpolation only -- see processMovePoint's reference-mode branch above for
    // why this can never be used to compute dispensed quantity.
    let events: Array<{ clientX: number; clientY: number }> = [event.nativeEvent];
    try {
      const coalesced = event.nativeEvent.getCoalescedEvents?.();
      if (coalesced && coalesced.length > 0) events = coalesced;
    } catch {
      // Fall back to the single event above.
    }

    for (const point of events) {
      processMovePoint(point.clientX, point.clientY);
    }
  }

  function releaseCapture(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released (browser auto-releases on up/cancel in most cases).
    }
  }

  function endDispenseGesture() {
    stopDispensing();
    pathRef.current?.classList.add("pizza-paint-trail__stroke--fade");
    fadeTimeoutRef.current = window.setTimeout(clearTrail, TRAIL_FADE_MS);
    gestureRef.current = createGestureState();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId) return;
    releaseCapture(event);

    if (isTomatoSauceReference) {
      // Every deposit was already committed as it happened (DEPOSIT_SAUCE ticks) -- there
      // is nothing left to commit on release, only the dispense session itself to stop.
      endDispenseGesture();
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

    // Sauce paint: commit wherever the stroke last touched the dough, clamped onto it so
    // releasing just past the rim still lands cleanly instead of doing nothing.
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
    stopDispensing();
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
    stopDispensing();
    clearTrail();
    gestureRef.current = createGestureState();
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

  // Phase 4A-1A Visual Feedback: for the Margherita Reference prototype's tomato sauce
  // only, the flat base sauce fill's own opacity now tracks dispensed quantity (a light
  // dab reads thin/translucent, a full application reads thick/opaque) instead of the
  // fixed 0.85 every other recipe/sauce still uses -- otherwise the heatmap below it would
  // be nearly invisible against an already-fully-opaque fill regardless of how little
  // sauce was actually applied. Deliberately a small, local opacity formula, not a new
  // rendering system -- every other ingredient/recipe's `.pizza-sauce-layer` is untouched.
  const referenceSauceMetrics = useMemo(() => {
    if (!referenceModeEnabled || sauceIngredient?.id !== "tomato-sauce") return null;
    return computeSauceMetrics(pizza.sauceDeposits);
  }, [referenceModeEnabled, sauceIngredient?.id, pizza.sauceDeposits]);
  // `null` (every recipe/sauce but this prototype's tomato sauce) deliberately omits the
  // CSS var entirely below, so `var(--sauce-target-opacity, 1)` falls through to the exact
  // same 1 the keyframe used to hard-code -- no visual change for anything but this one case.
  const baseSauceOpacity = referenceSauceMetrics
    ? Math.min(0.92, 0.22 + referenceSauceMetrics.quantity * 0.68)
    : null;
  const sauceOpacityStyle = (
    baseSauceOpacity !== null ? { "--sauce-target-opacity": baseSauceOpacity } : {}
  ) as CSSProperties;

  // Phase 4A-1A: Prototype-only tomato-sauce heatmap for the Margherita Reference
  // prototype, drawn from the exact same field the Prototype Metrics panel reads
  // (../logic/sauceField.ts) so what the player sees always matches what is measured.
  const showSauceHeatmap =
    referenceModeEnabled && sauceIngredient?.id === "tomato-sauce" && pizza.sauceDeposits.length > 0;

  useEffect(() => {
    if (!showSauceHeatmap) return;
    const canvas = heatmapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const insideDeposits = pizza.sauceDeposits.filter((d) => isInsideDough(d.x, d.y));
    const outsideDeposits = pizza.sauceDeposits.filter((d) => !isInsideDough(d.x, d.y));
    const field = buildSauceField(insideDeposits);
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

    // Faint overflow markers where sauce landed off the dough -- a Human Feel cue, not a
    // penalty (Prototype Metrics' own overflow numbers are the actual measurement).
    ctx.fillStyle = "rgba(196, 46, 34, 0.55)";
    for (const deposit of outsideDeposits) {
      const px = (deposit.x / 100) * canvas.width;
      const py = (deposit.y / 100) * canvas.height;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [showSauceHeatmap, pizza.sauceDeposits]);

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
      >
        {sauceIngredient && (
          <div
            key={pizza.sauceToken}
            className={`pizza-sauce-layer ${isOilSauce ? "pizza-sauce-layer--oil" : ""}`}
            style={{
              ...(isOilSauce ? {} : { backgroundColor: sauceIngredient.color }),
              ...sauceOriginStyle,
              ...sauceOpacityStyle,
            }}
          />
        )}
        {showSauceHeatmap && (
          <canvas
            ref={heatmapRef}
            className="pizza-sauce-heatmap"
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
