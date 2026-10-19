import { useEffect, useMemo, useRef } from "react";
import type { SauceDepositLike } from "../../logic/sauceField";
import { SAUCE_DISPLAY_GRID } from "../../logic/sauceDisplay";
import { SauceDotsFallback } from "../SauceCanvasFallback";
import { overlapFallbackOf, platformSupports2d, useCanvasFailure, useStagingSurface } from "../sauceCanvasSupport";
import { buildSquareSauceLayerPixels } from "./squarePanStage";
import "./squarePanStage.css";

/** Same internal resolution as the round `SauceHeatmapCanvas` (a rendering detail; CSS stretches it to the stage box). */
const SQUARE_SAUCE_CANVAS_PX = 200;

export interface SquareSauceCanvasProps {
  /** Deposits of this layer (the live stroke's, or a fixed list for a static view). */
  deposits: readonly SauceDepositLike[];
  /** Sauce swatch colour (hex). */
  color: string;
  /** Extra classes (a bake tint, a layer modifier); the square box / clip class is always applied. */
  className?: string;
  /** Deposits of the layers below (see `SquareSauceRasterOptions`). */
  underDeposits?: readonly SauceDepositLike[];
  ingredientId?: string;
}

/**
 * Square-Pan Dough D2-a1: the square counterpart of `SauceHeatmapCanvas`. The same pipeline (deposits -> display pixels -> 64x64 staging ->
 * 200x200 canvas, same canvas-failure net), but the pixels come from D1-a's square rasterizer, so the four corners of the pan are reached and
 * nothing is drawn off it. Its CSS class also clips the element to the pan after any filter (a blur) is applied.
 *
 * Inert until D2-a2 mounts it. Never reads or writes game state.
 */
export function SquareSauceCanvas({ deposits, color, className, underDeposits, ingredientId }: SquareSauceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, markFailed] = useCanvasFailure();
  const stagingOf = useStagingSurface();
  const classes = ["square-sauce-canvas", className].filter(Boolean).join(" ");
  const options = useMemo(() => ({ underDeposits, ingredientId }), [underDeposits, ingredientId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (deposits.length > 0 && platformSupports2d()) markFailed(); // a refusal after a working probe is a failure; a test DOM draws nothing
      return;
    }
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (deposits.length === 0) return;
      const pixels = buildSquareSauceLayerPixels(deposits, color, options);
      if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) return;
      const staging = stagingOf();
      if (!staging) {
        if (platformSupports2d()) markFailed();
        return;
      }
      staging.image.data.set(pixels);
      staging.ctx.putImageData(staging.image, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(staging.canvas, 0, 0, SAUCE_DISPLAY_GRID, SAUCE_DISPLAY_GRID, 0, 0, canvas.width, canvas.height);
    } catch {
      markFailed();
    }
  }, [deposits, color, options, markFailed, stagingOf]);

  if (failed) {
    return <SauceDotsFallback runs={[{ deposits, color, overlap: overlapFallbackOf(ingredientId, underDeposits) }]} className={classes} />;
  }
  return <canvas ref={canvasRef} className={classes} width={SQUARE_SAUCE_CANVAS_PX} height={SQUARE_SAUCE_CANVAS_PX} aria-hidden="true" />;
}
