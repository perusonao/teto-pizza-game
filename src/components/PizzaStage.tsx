import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { getIngredient, type Ingredient } from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import type { PizzaState, PlacementFeedback } from "../state/pizzaState";
import { classifyBake } from "../logic/bake";
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
  onTap: (xPercent: number, yPercent: number) => void;
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
  onTap,
}: PizzaStageProps) {
  const circleRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const gestureRef = useRef<GestureState>(createGestureState());
  const fadeTimeoutRef = useRef<number | null>(null);

  const isPaintMode = activeIngredient?.placement === "spread";

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current !== null) window.clearTimeout(fadeTimeoutRef.current);
    };
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

  function appendPoint(x: number, y: number) {
    const g = gestureRef.current;
    g.pathD += g.pathD ? ` L ${x.toFixed(2)} ${y.toFixed(2)}` : `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    pathRef.current?.setAttribute("d", g.pathD);
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
  }

  function processMovePoint(clientX: number, clientY: number) {
    const g = gestureRef.current;
    if (!g.rect) return;

    if (!g.dragging) {
      const dx = clientX - g.startClientX;
      const dy = clientY - g.startClientY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      if (isPaintMode) appendPoint(g.startDough.x, g.startDough.y);
    }

    const dough = clientPointToDoughPercent(clientX, clientY, g.rect);
    if (isInsideDough(dough.x, dough.y)) g.lastInsideDough = dough;
    if (isPaintMode) appendPoint(dough.x, dough.y);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId || !g.rect) return;

    // Coalesced events give the finer-grained samples the browser batched between frames,
    // so a fast drag still produces a continuous trail instead of a few widely-spaced dots.
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

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (g.pointerId !== event.pointerId) return;
    releaseCapture(event);

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
      >
        {sauceIngredient && (
          <div
            key={pizza.sauceToken}
            className={`pizza-sauce-layer ${isOilSauce ? "pizza-sauce-layer--oil" : ""}`}
            style={{
              ...(isOilSauce ? {} : { backgroundColor: sauceIngredient.color, opacity: 0.85 }),
              ...sauceOriginStyle,
            }}
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
                <span className={`pizza-cheese pizza-cheese--${ingredient.id} ${meltClass}`} />
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
