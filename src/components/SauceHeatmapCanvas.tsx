import { useEffect, useRef } from "react";
import {
  buildSauceField,
  insideDoughShapeFraction,
  isCellInsideDoughShape,
  SAUCE_FIELD_SIZE,
  sauceFieldToRgbaPixels,
  smoothSauceFieldForDisplay,
  type SauceDepositLike,
} from "../logic/sauceField";
import type { DoughShape } from "../logic/doughShape";

/** Internal pixel resolution of the rasterized heatmap -- purely a rendering detail (the
 *  browser's own image upscaler stretches this to whatever CSS size the caller's `className`
 *  gives the canvas), independent of `SAUCE_FIELD_SIZE` (the 16x16 metrics grid it visualizes).
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
}

/**
 * Issue #167 PR-B (Reference Truth): the shared sauce-field-to-pixels renderer. Extracted from
 * PizzaStage's own live gesture heatmap effect (buildSauceField -> smoothSauceFieldForDisplay ->
 * sauceFieldToRgbaPixels, ../logic/sauceField.ts) so the static Reference views
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
export function SauceHeatmapCanvas({ deposits, doughShape, color, className }: SauceHeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (deposits.length === 0) return;

    const insideWeighted = deposits
      .map((d) => ({ x: d.x, y: d.y, amount: d.amount * insideDoughShapeFraction(doughShape, d.x, d.y) }))
      .filter((d) => d.amount > 0);
    if (insideWeighted.length === 0) return;

    const field = buildSauceField(insideWeighted);
    const displayField = smoothSauceFieldForDisplay(field);
    const fieldCanvas = document.createElement("canvas");
    fieldCanvas.width = SAUCE_FIELD_SIZE;
    fieldCanvas.height = SAUCE_FIELD_SIZE;
    const fieldCtx = fieldCanvas.getContext("2d");
    if (!fieldCtx) return;

    const imageData = fieldCtx.createImageData(SAUCE_FIELD_SIZE, SAUCE_FIELD_SIZE);
    imageData.data.set(
      sauceFieldToRgbaPixels(displayField, color, (row, col) => isCellInsideDoughShape(row, col, doughShape)),
    );
    fieldCtx.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      fieldCanvas,
      0,
      0,
      SAUCE_FIELD_SIZE,
      SAUCE_FIELD_SIZE,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [deposits, doughShape, color]);

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
