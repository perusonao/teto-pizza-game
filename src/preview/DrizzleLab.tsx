import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DOUGH_CENTER,
  DOUGH_RADIUS,
  DRIZZLE_LAB_LABEL,
  DRIZZLE_LAB_MARK,
  INITIAL_LAB_STATE,
  SURFACE_SIZE,
  clientToSurface,
  labReset,
  strokeCancel,
  strokeEnd,
  strokeMove,
  strokeStart,
  toPolyline,
  type LabState,
} from "./drizzleLab";
import "./drizzleLab.css";

/**
 * #579 DRIZZLE Gesture Lab (Preview / DEV only, `?drizzleLab=on`, see ./drizzleLab.ts). A standalone screen: a mock baked pizza, a finger-drawn
 * sauce line and a tap fallback. It imports NOTHING from the game (no reducer, state, persistence, inventory, scoring, recipes) and writes nothing
 * anywhere: the strokes live in this component's state and vanish on reset, leave or reload.
 */
function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function DrizzleLab() {
  const [state, setState] = useState<LabState>(INITIAL_LAB_STATE);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [reduced] = useState(prefersReducedMotion);

  const at = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    return svg ? clientToSurface(e.clientX, e.clientY, svg.getBoundingClientRect()) : null;
  }, []);

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = at(e);
    const id = e.pointerId;
    const target = e.currentTarget;
    setState((s) => {
      const next = strokeStart(s, id, p);
      if (next !== s) {
        try {
          target.setPointerCapture(id);
        } catch {
          // Capture is a nicety (jsdom, an already-gone pointer); the stroke still works without it.
        }
      }
      return next;
    });
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = at(e);
    const id = e.pointerId;
    setState((s) => strokeMove(s, id, p));
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const id = e.pointerId;
    setState((s) => strokeEnd(s, id));
  };
  const onCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    const id = e.pointerId;
    setState((s) => strokeCancel(s, id));
  };

  // Leaving the lab (unmount, tab hidden, page hidden) discards a pending stroke; nothing is kept anywhere.
  useEffect(() => {
    const drop = () => setState((s) => strokeCancel(s));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") drop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", drop);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", drop);
      drop();
    };
  }, []);

  const pending = state.pending;
  return (
    <main className="drizzle-lab" data-lab={DRIZZLE_LAB_MARK} data-reduced-motion={reduced ? "1" : "0"}>
      <header className="drizzle-lab__head">
        <h1 className="drizzle-lab__title">DRIZZLE Gesture Lab</h1>
        <p className="drizzle-lab__badge" role="note">
          {DRIZZLE_LAB_LABEL}
        </p>
      </header>
      <p className="drizzle-lab__help">指でソースの線を引いてみてください。ちょんと触れると短い線が出ます。</p>
      <div className="drizzle-lab__stage">
        <svg
          ref={svgRef}
          className="drizzle-lab__surface"
          viewBox={`0 0 ${SURFACE_SIZE} ${SURFACE_SIZE}`}
          role="img"
          aria-label="焼き上がりピザの模型。指でなぞるとソースの線が引けます"
          data-testid="drizzle-surface"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          onLostPointerCapture={onCancel}
        >
          <circle cx={DOUGH_CENTER.x} cy={DOUGH_CENTER.y} r={DOUGH_RADIUS + 5} fill="#c98a45" />
          <circle cx={DOUGH_CENTER.x} cy={DOUGH_CENTER.y} r={DOUGH_RADIUS} fill="#f1c768" />
          <circle cx={DOUGH_CENTER.x} cy={DOUGH_CENTER.y} r={DOUGH_RADIUS - 6} fill="#f7d98a" />
          {MOCK_BLOBS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? "#e4a94c" : "#fbe7a8"} opacity={0.75} />
          ))}
          {MOCK_PEPPERONI.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5} fill="#a4402f" opacity={0.9} />
          ))}
          <g className="drizzle-lab__strokes" data-testid="drizzle-strokes">
            {state.strokes.map((s) => (
              <polyline key={s.id} className={s.tap ? "drizzle-lab__stroke drizzle-lab__stroke--tap" : "drizzle-lab__stroke"} points={toPolyline(s.points)} data-stroke={s.tap ? "tap" : "drag"} />
            ))}
            {pending && pending.points.length > 1 ? <polyline className="drizzle-lab__stroke drizzle-lab__stroke--pending" points={toPolyline(pending.points)} data-stroke="pending" /> : null}
            {pending && pending.points.length === 1 ? <circle className="drizzle-lab__nib" cx={pending.points[0].x} cy={pending.points[0].y} r={1.6} data-stroke="pending" /> : null}
          </g>
        </svg>
      </div>
      <footer className="drizzle-lab__foot">
        <span className="drizzle-lab__count" aria-live="polite" data-testid="drizzle-count">
          線 {state.strokes.length} 本
        </span>
        <button type="button" className="drizzle-lab__reset" onClick={() => setState(labReset())}>
          リセット
        </button>
      </footer>
    </main>
  );
}

/** Fixed decoration of the mock baked surface (no randomness, so screenshots are stable). */
const MOCK_BLOBS: ReadonlyArray<readonly [number, number, number]> = [
  [34, 36, 7], [58, 30, 6], [68, 52, 8], [44, 62, 7], [30, 58, 5], [56, 74, 6], [72, 34, 4], [40, 22, 4],
];
const MOCK_PEPPERONI: ReadonlyArray<readonly [number, number]> = [
  [38, 44], [62, 42], [50, 64], [66, 62], [32, 66],
];
