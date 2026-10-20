/**
 * Square-Pan Dough C balance pass (Issue #536): the dough as one smooth sheet, drawn into a small <canvas> (128 x 128, scaled up
 * smoothly by the browser). The picture itself is ../logic/pan/squareDoughRaster.ts's; this component only puts it on the screen and is
 * careful about the ways a canvas fails on a phone:
 *   - no 2D context (or a draw that throws) -> `onFail()`: the layer falls back to its SVG cells, which always work;
 *   - the page coming back (visibilitychange / pageshow / focus / resize / orientationchange) or a restored context -> the sheet is
 *     drawn again, so a canvas the browser cleared while the tab was away cannot stay blank.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { SquareDough } from "../logic/pan/squareDough";
import { RASTER_SIZE } from "../logic/pan/squareDoughRaster";
import { rasterizeSquareDoughSheet } from "../logic/pan/squareDoughSheet";
import type { SquareDoughRamp } from "../logic/pan/squareDoughView";

interface SquareDoughCanvasProps {
  dough: SquareDough;
  ramp: SquareDoughRamp;
  /** The canvas cannot be used (no context, or a draw failed): draw the sheet another way. Called at most once per failure. */
  onFail: () => void;
}

export function SquareDoughCanvas({ dough, ramp, onFail }: SquareDoughCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef({ dough, ramp, onFail });
  useEffect(() => {
    latest.current = { dough, ramp, onFail };
  }, [dough, ramp, onFail]);

  const draw = useCallback((source: { dough: SquareDough; ramp: SquareDoughRamp; onFail: () => void }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const context = canvas.getContext("2d");
      if (!context) {
        source.onFail();
        return;
      }
      context.putImageData(new ImageData(rasterizeSquareDoughSheet(source.dough, source.ramp), RASTER_SIZE, RASTER_SIZE), 0, 0);
    } catch {
      source.onFail();
    }
  }, []);

  // Drawn before the browser paints, so the sheet never shows an empty frame.
  useLayoutEffect(() => {
    draw({ dough, ramp, onFail });
  }, [dough, ramp, onFail, draw]);

  // The page came back (a tab switch, a rotation, a restored context): the canvas may have been cleared, so draw it again.
  useEffect(() => {
    const redraw = () => draw(latest.current);
    const onVisibility = () => {
      if (document.visibilityState === "visible") redraw();
    };
    const canvas = canvasRef.current;
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", redraw);
    window.addEventListener("focus", redraw);
    window.addEventListener("resize", redraw);
    window.addEventListener("orientationchange", redraw);
    canvas?.addEventListener("contextrestored", redraw);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", redraw);
      window.removeEventListener("focus", redraw);
      window.removeEventListener("resize", redraw);
      window.removeEventListener("orientationchange", redraw);
      canvas?.removeEventListener("contextrestored", redraw);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="square-dough-layer__canvas" data-testid="square-dough-canvas" width={RASTER_SIZE} height={RASTER_SIZE} aria-hidden="true" />;
}
