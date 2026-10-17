import { useEffect, useMemo, useRef } from "react";
import type { SauceDepositLike } from "../logic/sauceField";
import { alphaPlaneOf, buildSauceDisplayPixels, dimWhereOverlapping, overlapAlphaFactorFor, SAUCE_DISPLAY_GRID } from "../logic/sauceDisplay";
import type { DoughShape } from "../logic/doughShape";
import { SauceDotsFallback } from "./SauceCanvasFallback";
import { getStagingSurface, overlapFallbackOf, platformSupports2d, useCanvasFailure } from "./sauceCanvasSupport";

/** Internal pixel resolution of the rasterized heatmap -- purely a rendering detail (the
 *  browser's own image upscaler stretches this to whatever CSS size the caller's `className`
 *  gives the canvas), independent of the 16x16 metrics grid (`SAUCE_FIELD_SIZE`) and of the 64x64
 *  display density (`SAUCE_DISPLAY_GRID`) it is drawn from.
 *  Kept as one shared constant so PizzaStage's live gesture heatmap and every static Reference
 *  view rasterize at the same fidelity. */
const HEATMAP_CANVAS_PX = 200;

export interface SauceHeatmapCanvasProps {
  /** Deposits to render -- PizzaStage passes the live gesture's accumulated deposits;
   *  Reference views pass a fixed, deterministic deposit list (see
   *  `../data/referencePizza.ts`'s `buildIdealSauceFixture`) so the same pipeline renders a
   *  stable target instead of PizzaStage's own in-progress paint. */
  deposits: readonly SauceDepositLike[];
  /** Boundary the deposits are weighted/clipped against -- PizzaStage passes the player's own
   *  live (possibly hand-stretched) `pizza.doughShape`; Reference views pass the ideal circular
   *  shape (`createIdealDoughShape`, ../logic/doughShape.ts) so a recipe's target sauce always
   *  renders against the same round target the dough itself is shown at. */
  doughShape: DoughShape;
  /** Sauce ingredient's own swatch color (hex) -- the same value every other sauce-adjacent UI
   *  (tray chip, flat legacy layer, paint trail) reads from `ingredients.ts`. */
  color: string;
  className?: string;
  /**
   * Layered painting (Owner Decision on PR #494): every deposit of the layers BELOW this one. Where this layer overlaps them its
   * opacity is dimmed (about x0.7) so the sauce underneath shows through; elsewhere, and when absent or empty (a one-sauce pizza, the
   * bottom layer, every Reference view), the raster is untouched.
   */
  underDeposits?: readonly SauceDepositLike[];
  /** The sauce kind that laid this layer; only picks the overlap factor (olive oil is dimmed harder, #519). Absent = the generic factor. */
  ingredientId?: string;
}

/**
 * Issue #167 PR-B (Reference Truth): the shared sauce-to-pixels renderer. Extracted from
 * PizzaStage's own live gesture heatmap effect (originally buildSauceField -> smoothSauceFieldForDisplay ->
 * sauceFieldToRgbaPixels, ../logic/sauceField.ts; now ../logic/sauceDisplay.ts, Issue #475 Slice 1) so the static Reference views
 * (ReferenceThumbnail/ReferencePreview/PlayerReferencePreview) render the *same* sauce visual
 * truth -- real painted-coverage pixels, not each hand-rolling an unrelated flat scaled circle
 * whose opacity/size only loosely gestured at "how much sauce". Deliberately excludes
 * PizzaStage's own overflow-marker dots (an interactive, in-progress-painting-mistake signal
 * with no meaning for a static target that is correct by construction) -- PizzaStage layers
 * those separately, on top of this component, unchanged.
 *
 * Never reads or writes canonical game/scoring state: this is purely `deposits` -> pixels, the
 * same one-way data flow `computeSauceMetrics` (../logic/sauceField.ts) already uses for
 * scoring, just rasterized instead of aggregated.
 */
export function SauceHeatmapCanvas({ deposits, doughShape, color, className, underDeposits, ingredientId }: SauceHeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // "How much sauce is already under this layer": colour-independent, so it is computed once per (under, dough shape) and not on every
  // tick of the stroke in progress (which only changes `deposits`).
  const underAlpha = useMemo(
    () => (underDeposits && underDeposits.length > 0 ? alphaPlaneOf(buildSauceDisplayPixels(underDeposits, doughShape, "#000000")) : null),
    [underDeposits, doughShape],
  );

  // A browser that refuses a 2D context after giving others one (canvas memory budget), or a draw that throws, must not leave this layer
  // invisible -- and an exception out of an effect must not unmount the app. Either shows the layer's deposits as dots instead (sticky).
  const [failed, markFailed] = useCanvasFailure();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // a platform with no 2D support at all (a test DOM) draws nothing, as it always has; only a refusal after a working probe is a failure
      if (deposits.length > 0 && platformSupports2d()) markFailed();
      return;
    }

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (deposits.length === 0) return;

      // Issue #475 Slice 1: the display density is built straight from the deposits (radially symmetric
      // splats on a 64x64 grid, ../logic/sauceDisplay.ts) instead of from the 16x16 metrics field, whose
      // square support showed as a staircase edge. Scoring still reads the 16x16 field, untouched.
      const pixels = buildSauceDisplayPixels(deposits, doughShape, color);
      if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) return;
      if (underAlpha) dimWhereOverlapping(pixels, underAlpha, overlapAlphaFactorFor(ingredientId));

      const staging = getStagingSurface();
      if (!staging) {
        // the 64x64 staging canvas is refused too (same exhaustion): the layer cannot be drawn, so it is shown as dots, not left blank
        if (platformSupports2d()) markFailed();
        return;
      }
      staging.image.data.set(pixels);
      staging.ctx.putImageData(staging.image, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        staging.canvas,
        0,
        0,
        SAUCE_DISPLAY_GRID,
        SAUCE_DISPLAY_GRID,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    } catch {
      markFailed();
    }
  }, [deposits, doughShape, color, underAlpha, ingredientId, markFailed]);

  if (failed) return <SauceDotsFallback runs={[{ deposits, color, overlap: overlapFallbackOf(ingredientId, underDeposits) }]} className={className} />;
  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={HEATMAP_CANVAS_PX}
      height={HEATMAP_CANVAS_PX}
      aria-hidden="true"
    />
  );
}
