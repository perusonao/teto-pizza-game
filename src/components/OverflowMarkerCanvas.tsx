import { useEffect, useRef } from "react";
import { insideDoughShapeFraction, type SauceDepositLike } from "../logic/sauceField";
import type { DoughShape } from "../logic/doughShape";

/** Internal pixel resolution of the overflow-marker canvas -- matches `SauceHeatmapCanvas`'s own
 *  internal resolution purely so the two overlaid canvases share one rasterization fidelity. */
const OVERFLOW_MARKER_CANVAS_PX = 200;

export interface OverflowMarkerCanvasProps {
  deposits: readonly SauceDepositLike[];
  /** The player's actual (possibly hand-stretched) dough silhouette the deposits are tested against. */
  doughShape: DoughShape;
  color: string;
  className?: string;
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
export function OverflowMarkerCanvas({ deposits, doughShape, color, className }: OverflowMarkerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const deposit of deposits) {
      const overflowFraction = 1 - insideDoughShapeFraction(doughShape, deposit.x, deposit.y);
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
  }, [deposits, doughShape, color]);

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
