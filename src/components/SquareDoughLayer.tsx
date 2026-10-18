/**
 * Square-Pan Dough B2 + C (Issues #535, #536, Epic #532): the square dough's DOUGH-step layer. It draws the 16x16 thickness sheet on
 * the square pan and turns a finger into the tap / long-press / drag of ../logic/pan/pressGesture.ts. The drag pulls the dough out
 * toward the corners (mass-conserving, ../logic/pan/squareDoughDrag.ts); the four corner marks and the drag hints are the picture of
 * where the dough stands. It judges nothing itself: the step and the finish are derived from the dough (squareDoughProgress.ts).
 *
 * It owns its pointer events (they stop here, so the round dough's handlers on the parent never see them) and the working dough
 * of the live gesture. The working dough is committed once, at a successful pointer-up; pointer cancel, a lost capture, window
 * blur and a hidden tab discard it, so a broken gesture never reaches game state.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { HOLD_START_MS, IDLE_PRESS_GESTURE, stepPressGesture, type PressEvent, type PressGestureState } from "../logic/pan/pressGesture";
import { applyGestureEffects } from "../logic/pan/squareDoughDrag";
import { squareDoughProgress } from "../logic/pan/squareDoughProgress";
import { SQUARE_PAN_HALF_SIDE } from "../logic/pan/panGeometry";
import {
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  isSquareCellOnPan,
  squareCellIndex,
  type SquareDough,
} from "../logic/pan/squareDough";
import { HOLD_BRUSH_RADIUS_MAX, PRESS_BRUSH_RADIUS, holdBrushRadius } from "../logic/pan/squareDoughSpread";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { CORNER_MARKS, changePoints, changedCells, cornerHint, thicknessFill, type SquareDoughRamp } from "../logic/pan/squareDoughView";
import { DOUGH_CENTER, type DoughPoint } from "../logic/pizzaCoordinates";
import { describeTarget, squareDoughDiag } from "../preview/squareDoughDiag"; // TEMPORARY on-device diagnostics (?diag=1)
import { SquareDoughDiagPanel } from "../preview/SquareDoughDiagPanel";

interface SquareDoughLayerProps {
  /** The committed dough this layer starts every gesture from. */
  dough: SquareDough;
  /** False: nothing is handled (the reference popover is open, input is paused, ...). */
  interactive: boolean;
  /** Fired once, at a successful pointer-up that changed the dough. Never for a cancelled gesture. */
  onCommit: (dough: SquareDough) => void;
  /** Bumped by the parent when the step/round changes: a gesture in flight is discarded. */
  resetToken?: number;
  /** The colour range of this round's start (the Preview lumpy sheet keeps B2's look; the production ball has its own). */
  ramp?: SquareDoughRamp;
}

const CELL = 100 / SQUARE_DOUGH_GRID;
/** The hold ring sits this far above the finger (dough-percent) so a fingertip never hides it. */
const HOLD_RING_OFFSET = HOLD_BRUSH_RADIUS_MAX + 6;

/** How long a finished gesture's changed cells stay marked, fading out (ms). Matches the CSS animation of `__changed--fade`. */
const HIGHLIGHT_FADE_MS = 500;

/** The cells the current / just-finished gesture really changed. `ended`: the finger is up and the marks are fading out. */
interface ChangeHighlight {
  cells: number[];
  ended: boolean;
  /** Restarts the fade animation for a new gesture. */
  key: number;
}

interface PressRing {
  x: number;
  y: number;
  /** 0 until the hold begins, then 0..1 over the brush growth. */
  holdProgress: number;
  holding: boolean;
  /** Changes with every new press so the tap pulse restarts. */
  pressKey: number;
}

/** The drag trail keeps at most this many points (older ones are thinned out) so a long stroke stays cheap to draw. */
const TRAIL_MAX_POINTS = 60;

export function SquareDoughLayer({ dough, interactive, onCommit, resetToken = 0, ramp = "lumpy" }: SquareDoughLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<PressGestureState>(IDLE_PRESS_GESTURE);
  const workingRef = useRef<SquareDough | null>(null);
  const rafRef = useRef<number | null>(null);
  const pressCountRef = useRef(0);
  const doughRef = useRef(dough);
  const lastCommittedRef = useRef<SquareDough | null>(null); // diagnostics only: the dough this layer last handed to onCommit
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    doughRef.current = dough;
    onCommitRef.current = onCommit;
    rampRef.current = ramp;
  }, [dough, onCommit, ramp]);
  const [working, setWorking] = useState<SquareDough | null>(null);
  const [ring, setRing] = useState<PressRing | null>(null);
  const [highlight, setHighlight] = useState<ChangeHighlight | null>(null);
  /** The live drag's path (dough-percent), from where the finger went down; null when no drag is live. */
  const [trail, setTrail] = useState<DoughPoint[] | null>(null);
  const rampRef = useRef(ramp);
  const gestureStartRef = useRef<SquareDough | null>(null); // the committed dough the live gesture started from
  const highlightKeyRef = useRef(0);
  const highlightTimerRef = useRef<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);

  // Diagnostics only (no-ops with ?diag absent): the committed dough coming back through the prop is the reducer accepting COMMIT_SQUARE_DOUGH.
  useEffect(() => {
    if (squareDoughDiag && lastCommittedRef.current !== null && dough === lastCommittedRef.current) {
      squareDoughDiag.count("reducerAccepted");
      lastCommittedRef.current = null;
    }
  }, [dough]);
  useEffect(() => {
    if (!squareDoughDiag) return;
    const el = layerRef.current;
    squareDoughDiag.setStatus({
      interactive,
      resetToken,
      layerRect: el ? (() => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; })() : "-",
      touchAction: el ? getComputedStyle(el).touchAction : "-",
    });
  }, [interactive, resetToken]);
  useEffect(() => (squareDoughDiag ? squareDoughDiag.attachWindow(() => gestureRef.current.phase) : undefined), []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Runs one event through the state machine and applies what it decided. */
  const feed = useCallback(
    (event: PressEvent) => {
      const step = stepPressGesture(gestureRef.current, event);
      gestureRef.current = step.state;
      if (event.type === "down" && step.state.phase === "pressing") {
        // A new press: forget the previous gesture's marks and remember the committed dough this one starts from.
        gestureStartRef.current = doughRef.current;
        clearHighlightTimer();
        setHighlight(null);
      }
      if (squareDoughDiag) {
        for (const effect of step.effects) {
          if (effect.kind === "press") squareDoughDiag.count("pressApplied");
          else if (effect.kind === "hold") squareDoughDiag.count("holdTicks");
        }
        squareDoughDiag.setStatus({ phase: step.state.phase });
      }
      if (step.effects.length > 0) {
        const base = workingRef.current ?? doughRef.current;
        workingRef.current = applyGestureEffects(base, gestureStartRef.current ?? doughRef.current, step.effects);
        setWorking(workingRef.current);
        // A drag draws its path: the trail starts where the finger went down (a "revert" restarts it with the drag).
        const dragTo = step.effects.filter((e): e is Extract<typeof e, { kind: "drag" }> => e.kind === "drag");
        if (dragTo.length > 0) {
          setTrail((previous) => {
            let next = previous && !step.effects.some((e) => e.kind === "revert") ? previous.slice() : [dragTo[0].from];
            for (const d of dragTo) next.push(d.to);
            if (next.length > TRAIL_MAX_POINTS) next = next.filter((_, i) => i === 0 || i === next.length - 1 || i % 2 === 0);
            return next;
          });
        }
        // The marks follow the real change while the finger is down: the cells that differ from where the gesture started.
        const start = gestureStartRef.current;
        if (start && step.end === null) {
          const cells = changedCells(start, workingRef.current, rampRef.current);
          setHighlight(cells.length > 0 ? { cells, ended: false, key: highlightKeyRef.current } : null);
        }
      }
      if (step.end !== null) {
        stopLoop();
        const final = workingRef.current;
        workingRef.current = null;
        setWorking(null);
        setRing(null);
        setTrail(null);
        const start = gestureStartRef.current;
        gestureStartRef.current = null;
        clearHighlightTimer();
        if (step.end === "commit" && start !== null) {
          // What the gesture really did, measured from the committed dough it started from: the gauge says it, the marks show where.
          const after = final ?? start;
          // The number the step is about: how far the dough has spread in STEP 1, how even it is in STEP 2 (the step the gesture started in).
          const p0 = squareDoughProgress(start);
          const p1 = squareDoughProgress(after);
          if (p0.step === 1) squareDoughGaugeStore.reportChange(changePoints(p0.coverage, p1.coverage), "coverage");
          else squareDoughGaugeStore.reportChange(changePoints(p0.evenness, p1.evenness), "evenness");
          const cells = changedCells(start, after, rampRef.current);
          if (cells.length > 0) {
            highlightKeyRef.current += 1;
            setHighlight({ cells, ended: true, key: highlightKeyRef.current });
            highlightTimerRef.current = window.setTimeout(() => {
              highlightTimerRef.current = null;
              setHighlight(null);
            }, HIGHLIGHT_FADE_MS + 100);
          } else setHighlight(null);
        } else setHighlight(null); // a discarded gesture changed nothing that stays: nothing to mark
        if (step.end === "commit" && final !== null && final !== doughRef.current) {
          lastCommittedRef.current = final;
          squareDoughDiag?.count("commitIssued");
          onCommitRef.current(final);
        } else if (step.end === "discard") {
          squareDoughDiag?.count("discarded");
        }
      } else if (step.state.phase === "dragging") {
        setRing(null); // the drag has its own picture: the trail
      } else if (step.state.center !== null) {
        const elapsed = Math.max(0, ("at" in event ? event.at : performance.now()) - step.state.downAt - HOLD_START_MS);
        const holding = step.state.phase === "holding";
        setRing((previous) => ({
          x: step.state.center!.x,
          y: step.state.center!.y,
          holding,
          holdProgress: holding ? Math.min(1, (holdBrushRadius(elapsed) - PRESS_BRUSH_RADIUS) / (HOLD_BRUSH_RADIUS_MAX - PRESS_BRUSH_RADIUS)) : 0,
          pressKey: previous?.pressKey ?? pressCountRef.current,
        }));
      }
      return step;
    },
    [stopLoop, clearHighlightTimer],
  );

  const startLoop = useCallback(() => {
    const frame = () => {
      if (gestureRef.current.phase !== "pressing" && gestureRef.current.phase !== "holding") {
        rafRef.current = null; // moved / dragging: events drive it, no ticks
        return;
      }
      feed({ type: "tick", at: performance.now() });
      rafRef.current = requestAnimationFrame(frame);
    };
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame);
  }, [feed]);

  const discard = useCallback(() => {
    if (gestureRef.current.phase === "idle") return;
    feed({ type: "cancel", at: performance.now() });
  }, [feed]);

  // A step/round change, blur, a hidden tab, `interactive` going false, or unmount all discard a live gesture.
  useEffect(() => {
    discard();
  }, [resetToken, interactive, discard]);
  useEffect(() => {
    const onHide = () => discard();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") discard();
    };
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      stopLoop();
    };
  }, [discard, stopLoop]);

  const toDoughPoint = useCallback((clientX: number, clientY: number): DoughPoint | null => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
  }, []);

  // When pointer capture is unavailable (it threw) a move or release outside the layer never reaches it: this window-level fallback
  // feeds the layer's own gesture the move, and ends it on pointerup (commit) / pointercancel (discard), so no press can stay live.
  useEffect(() => {
    const onWindowEnd = (event: PointerEvent) => {
      if (gestureRef.current.pointerId !== event.pointerId) return;
      squareDoughDiag?.count(event.type === "pointerup" ? "windowFallbackUp" : "windowFallbackCancel");
      feed(
        event.type === "pointerup"
          ? { type: "up", pointerId: event.pointerId, at: performance.now() }
          : { type: "cancel", pointerId: event.pointerId, at: performance.now() },
      );
    };
    // Movement too: without capture, a finger that leaves the layer must still stop the spread at the slop.
    const onWindowMove = (event: PointerEvent) => {
      if (gestureRef.current.pointerId !== event.pointerId) return;
      feed({ type: "move", pointerId: event.pointerId, at: performance.now(), clientX: event.clientX, clientY: event.clientY, point: toDoughPoint(event.clientX, event.clientY) ?? undefined });
    };
    window.addEventListener("pointerup", onWindowEnd);
    window.addEventListener("pointercancel", onWindowEnd);
    window.addEventListener("pointermove", onWindowMove);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowEnd);
      window.removeEventListener("pointercancel", onWindowEnd);
    };
  }, [feed, toDoughPoint]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (squareDoughDiag) {
      squareDoughDiag.event("layer", event, gestureRef.current.phase);
      const top = document.elementFromPoint(event.clientX, event.clientY);
      const rect = layerRef.current?.getBoundingClientRect();
      squareDoughDiag.setStatus({
        topAtDown: `${describeTarget(top)}${top === event.currentTarget ? "(=layer)" : "(NOT layer)"}`,
        interactive,
        layerRect: rect ? `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}` : "-",
      });
    }
    if (!interactive || (event.pointerType === "mouse" && event.button !== 0)) {
      if (!interactive) squareDoughDiag?.count("ignoredNotInteractive");
      return;
    }
    if (gestureRef.current.phase !== "idle") {
      squareDoughDiag?.count("ignoredBusy");
      return; // one finger at a time
    }
    const center = toDoughPoint(event.clientX, event.clientY);
    if (center === null) return;
    // The pan's own area only: a press on the border strip outside the pan does nothing.
    if (Math.abs(center.x - DOUGH_CENTER) > SQUARE_PAN_HALF_SIDE + 4 || Math.abs(center.y - DOUGH_CENTER) > SQUARE_PAN_HALF_SIDE + 4) {
      squareDoughDiag?.count("ignoredOutsidePan");
      return;
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (squareDoughDiag) {
        squareDoughDiag.count("capturedOk");
        squareDoughDiag.setStatus({ capture: "ok" });
      }
    } catch (error) {
      /* capture is best effort; the window fallback below still ends the gesture */
      if (squareDoughDiag) {
        squareDoughDiag.count("captureFailed");
        squareDoughDiag.setStatus({ capture: `FAIL ${error instanceof Error ? error.name : "?"}` });
      }
    }
    pressCountRef.current += 1;
    // STEP 1 (the dough has not been pulled to the corners yet): the drag is the main operation.
    const dragPrimary = squareDoughProgress(doughRef.current).step === 1;
    feed({ type: "down", pointerId: event.pointerId, at: performance.now(), clientX: event.clientX, clientY: event.clientY, center, dragPrimary });
    startLoop();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    squareDoughDiag?.event("layer", event, gestureRef.current.phase);
    if (gestureRef.current.pointerId !== event.pointerId) return;
    feed({ type: "move", pointerId: event.pointerId, at: performance.now(), clientX: event.clientX, clientY: event.clientY, point: toDoughPoint(event.clientX, event.clientY) ?? undefined });
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    squareDoughDiag?.event("layer", event, gestureRef.current.phase);
    if (gestureRef.current.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    feed({ type: "up", pointerId: event.pointerId, at: performance.now() });
  };

  const handleCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    squareDoughDiag?.event("layer", event, gestureRef.current.phase);
    if (gestureRef.current.pointerId !== event.pointerId) return;
    feed({ type: "cancel", pointerId: event.pointerId, at: performance.now() });
  };

  // A pointer lost without an up (the browser took it for a scroll, an alert, ...) is a cancel.
  const handleLostCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    squareDoughDiag?.event("layer", event, gestureRef.current.phase);
    if (gestureRef.current.pointerId !== event.pointerId) return;
    feed({ type: "cancel", pointerId: event.pointerId, at: performance.now() });
  };

  const shown = working ?? dough;
  const progress = useMemo(() => squareDoughProgress(shown), [shown]);
  // The guide in the dock shows exactly this dough (the one on screen), and forgets it when the layer goes.
  useEffect(() => {
    squareDoughGaugeStore.setDough(shown);
  }, [shown]);
  useEffect(
    () => () => {
      squareDoughGaugeStore.reset();
      clearHighlightTimer();
    },
    [clearHighlightTimer],
  );
  const cells = useMemo(() => {
    const out: { key: number; x: number; y: number; fill: string }[] = [];
    for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
      for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
        if (!isSquareCellOnPan(row, col)) continue;
        const value = shown.thickness[squareCellIndex(row, col)];
        if (!(value >= SQUARE_COVER_MIN_THICKNESS)) continue;
        out.push({ key: row * SQUARE_DOUGH_GRID + col, x: col * CELL, y: row * CELL, fill: thicknessFill(value, ramp) });
      }
    }
    return out;
  }, [shown, ramp]);
  // Drag hints: while STEP 1 is on and no finger is down, one dashed arrow per unreached corner, from the dough's edge to the corner.
  const hints = useMemo(
    () => (progress.step === 1 ? progress.corners.flatMap((reached, corner) => (reached ? [] : [{ corner, ...cornerHint(shown, corner) }])) : []),
    [progress, shown],
  );

  const panMin = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;
  const panSide = SQUARE_PAN_HALF_SIDE * 2;
  const holdRadius = ring ? PRESS_BRUSH_RADIUS + (HOLD_BRUSH_RADIUS_MAX - PRESS_BRUSH_RADIUS) * ring.holdProgress : 0;

  return (
    <>
    <div
      ref={layerRef}
      className="square-dough-layer"
      data-testid="square-dough-layer"
      data-evenness={progress.evenness.toFixed(3)}
      data-coverage={progress.coverage.toFixed(3)}
      data-step={progress.step}
      data-corners={progress.cornersReached}
      data-complete={progress.complete ? "true" : "false"}
      data-dragging={trail ? "true" : "false"}
      data-changed-cells={highlight ? highlight.cells.join(",") : ""}
      data-pressing={ring ? (ring.holding ? "hold" : "tap") : "none"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={handleCancel}
      onLostPointerCapture={handleLostCapture}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg className="square-dough-layer__svg" viewBox="0 0 100 100" aria-hidden="true">
        <rect className="square-dough-layer__pan" x={panMin} y={panMin} width={panSide} height={panSide} rx={3} />
        <defs>
          {/* A faint blur takes the hard grid edges off the thickness colours (the stretched ramp would otherwise make the 16x16 cells read as a
              checkerboard); clipped to the pan so nothing bleeds onto the rim. */}
          <filter id={`${uid}-soft`} x="-2%" y="-2%" width="104%" height="104%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          <clipPath id={`${uid}-clip`}>
            <rect x={panMin} y={panMin} width={panSide} height={panSide} rx={3} />
          </clipPath>
        </defs>
        <g filter={`url(#${uid}-soft)`} clipPath={`url(#${uid}-clip)`}>
          {cells.map((cell) => (
            <rect key={cell.key} data-dough-cell={cell.key} x={cell.x - 0.15} y={cell.y - 0.15} width={CELL + 0.3} height={CELL + 0.3} fill={cell.fill} />
          ))}
        </g>
        {highlight && (
          <g
            key={highlight.key}
            className={`square-dough-layer__changed${highlight.ended ? " square-dough-layer__changed--fade" : ""}`}
            data-testid="square-dough-changed"
          >
            {highlight.cells.map((index) => (
              <rect
                key={index}
                data-cell={index}
                x={(index % SQUARE_DOUGH_GRID) * CELL}
                y={Math.floor(index / SQUARE_DOUGH_GRID) * CELL}
                width={CELL}
                height={CELL}
                rx={1.2}
              />
            ))}
          </g>
        )}
        {/* The four corner marks: dashed and pulsing until the corner is reached, a green tick once it is (the picture of STEP 1). */}
        <g className="square-dough-layer__corners" data-testid="square-corner-marks">
          {CORNER_MARKS.map((mark, corner) => {
            const reached = progress.corners[corner];
            return (
              <g
                key={corner}
                className={`square-dough-layer__corner${reached ? " square-dough-layer__corner--reached" : ""}`}
                data-corner={["nw", "ne", "se", "sw"][corner]}
                data-reached={reached ? "true" : "false"}
              >
                <circle cx={mark.x} cy={mark.y} r={4.6} />
                {reached && <path d={`M ${mark.x - 2.2} ${mark.y} L ${mark.x - 0.6} ${mark.y + 1.7} L ${mark.x + 2.4} ${mark.y - 1.8}`} />}
              </g>
            );
          })}
        </g>
        {/* Drag hints (STEP 1, no finger down): from the dough's edge toward each corner that is still short. */}
        {!trail && !ring && hints.length > 0 && (
          <g className="square-dough-layer__hints" data-testid="square-drag-hints">
            {hints.map((hint) => {
              const angle = Math.atan2(hint.to.y - hint.from.y, hint.to.x - hint.from.x);
              const tipX = hint.to.x - Math.cos(angle) * 5.6;
              const tipY = hint.to.y - Math.sin(angle) * 5.6;
              return (
                <g key={hint.corner} data-corner={hint.corner}>
                  <circle className="square-dough-layer__hint-start" cx={hint.from.x} cy={hint.from.y} r={2.2} />
                  <line className="square-dough-layer__hint-line" x1={hint.from.x} y1={hint.from.y} x2={tipX} y2={tipY} />
                  <polygon
                    className="square-dough-layer__hint-head"
                    points={`${tipX + Math.cos(angle) * 3},${tipY + Math.sin(angle) * 3} ${tipX + Math.cos(angle + 2.5) * 2.6},${tipY + Math.sin(angle + 2.5) * 2.6} ${tipX + Math.cos(angle - 2.5) * 2.6},${tipY + Math.sin(angle - 2.5) * 2.6}`}
                  />
                </g>
              );
            })}
          </g>
        )}
        {/* The live drag: where it started, the path so far, and the fingertip. */}
        {trail && trail.length > 0 && (
          <g className="square-dough-layer__trail" data-testid="square-drag-trail">
            <polyline points={trail.map((q) => `${q.x},${q.y}`).join(" ")} />
            <circle className="square-dough-layer__trail-start" cx={trail[0].x} cy={trail[0].y} r={2.4} />
            <circle className="square-dough-layer__trail-tip" cx={trail[trail.length - 1].x} cy={trail[trail.length - 1].y} r={4} />
          </g>
        )}
        {ring && (
          <g className="square-dough-layer__feedback">
            <circle key={ring.pressKey} className="square-dough-layer__tap-ring" cx={ring.x} cy={ring.y} r={PRESS_BRUSH_RADIUS} />
            {ring.holding && (
              <circle
                className="square-dough-layer__hold-ring"
                data-testid="square-dough-hold-ring"
                cx={ring.x}
                cy={Math.max(HOLD_RING_OFFSET * 0.35, ring.y - HOLD_RING_OFFSET)}
                r={4 + 6 * ring.holdProgress}
              />
            )}
            {ring.holding && <circle className="square-dough-layer__reach" cx={ring.x} cy={ring.y} r={holdRadius} />}
          </g>
        )}
      </svg>
    </div>
    {squareDoughDiag && createPortal(<SquareDoughDiagPanel diag={squareDoughDiag} />, document.body)}
    </>
  );
}
