import { useEffect, useRef } from "react";
import type { SauceDepositLike } from "../logic/sauceField";
import { insidePanSauceFraction } from "../logic/pan/sauceSurface";
import type { PanShape } from "../logic/pan/panShape";
import type { DoughShape } from "../logic/doughShape";
import { platformSupports2d, useCanvasFailure } from "./sauceCanvasSupport";

/** Internal pixel resolution of the overflow-marker canvas -- matches `SauceHeatmapCanvas`'s own
 *  internal resolution purely so the two overlaid canvases share one rasterization fidelity. */
const OVERFLOW_MARKER_CANVAS_PX = 200;

export interface OverflowMarkerCanvasProps {
  deposits: readonly SauceDepositLike[];
  /** The player's actual (possibly hand-stretched) dough silhouette the deposits are tested against. */
  doughShape: DoughShape;
  color: string;
  className?: string;
  /** D2-a2 (#537): the pan the deposits are tested against. `"square"` = the pan's edge; absent / `"round"` = the dough silhouette, unchanged. */
  pan?: PanShape;
}

/**
 * Overflow markers where sauce landed off (or straddling) the player's *actual* dough silhouette --
 * alpha scaled by how much of that deposit actually missed it, so a near-rim dab reads as a faint
 * touch and a fully overflowed one as a solid mark. Sauce inside the silhouette is real heatmap
 * paint (SauceHeatmapCanvas), not a marker dot.
 *
 * Extracted from PizzaStage (Issue #418) so it is a pure function of its props: like
 * `SauceHeatmapCanvas` it can be rendered once per cut piece and each copy draws itself, instead of
 * a single ref-owned canvas that a duplicated pizza body could not share.
 */
export function OverflowMarkerCanvas({ deposits, doughShape, color, className, pan = "round" }: OverflowMarkerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Same safety net as `SauceHeatmapCanvas`: a refused 2D context or a throwing draw shows the markers as dots, and never unmounts the app.
  const [failed, markFailed] = useCanvasFailure();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (platformSupports2d() && deposits.some((d) => insidePanSauceFraction(pan, doughShape, d.x, d.y) < 1)) markFailed();
      return;
    }

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const deposit of deposits) {
        const overflowFraction = 1 - insidePanSauceFraction(pan, doughShape, deposit.x, deposit.y);
        if (overflowFraction <= 0) continue;
        const px = (deposit.x / 100) * canvas.width;
        const py = (deposit.y / 100) * canvas.height;
        ctx.save();
        ctx.globalAlpha = 0.55 * overflowFraction;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } catch {
      markFailed();
    }
  }, [deposits, doughShape, pan, color, markFailed]);

  // the markers are small dots: when their canvas is gone they are simply left out (the heatmap's own fallback carries the sauce)
  if (failed) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={OVERFLOW_MARKER_CANVAS_PX}
      height={OVERFLOW_MARKER_CANVAS_PX}
      aria-hidden="true"
    />
  );
}
