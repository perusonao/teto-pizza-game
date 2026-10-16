import { useEffect, useRef } from "react";
import type { DoughShape } from "../logic/doughShape";
import {
  alphaPlaneOf,
  bakeOilHex,
  bakeOliveOilLook,
  buildSauceDisplayPixels,
  compositeOver,
  dimWhereOverlapping,
  SAUCE_DISPLAY_GRID,
} from "../logic/sauceDisplay";
import { insideDoughShapeFraction } from "../logic/sauceField";
import type { SauceLayer } from "../state/sauceLayers";
import { SauceDotsFallback } from "./SauceCanvasFallback";
import { getStagingSurface, platformSupports2d, useCanvasFailure } from "./sauceCanvasSupport";

/**
 * Codex P2 on PR #494 (canvas budget): the OLDEST sauce runs of a long pizza are flattened into shared canvases instead of one canvas
 * pair per run. Each run's raster is built exactly as its own canvas would build it (its own colour, its overlap dimming against
 * everything under it), then the runs are stacked in order with the same source-over blend the browser applies between canvases -- so the
 * chronological look and the overlap dimming are kept; the only difference from separate canvases is that the CSS blur is applied once to
 * the flattened result instead of to each run.
 */
const MERGED_CANVAS_PX = 200;

interface RunRaster {
  shape: DoughShape;
  color: string;
  plain: Uint8ClampedArray;
  baked: Uint8ClampedArray | null;
}
// a run's raster is a pure function of the run (its deposits, what lies under it), the dough shape and its colour, so it is built once
// per run object -- and runs are stable objects across commits (see `sauceRunsOf`)
const rasterOfRun = new WeakMap<SauceLayer, RunRaster>();

function runRaster(run: SauceLayer, shape: DoughShape, color: string, baked: boolean): Uint8ClampedArray {
  let entry = rasterOfRun.get(run);
  if (!entry || entry.shape !== shape || entry.color !== color) {
    const plain = buildSauceDisplayPixels(run.deposits, shape, color);
    if (run.under.length > 0) dimWhereOverlapping(plain, alphaPlaneOf(buildSauceDisplayPixels(run.under, shape, "#000000")));
    entry = { shape, color, plain, baked: null };
    rasterOfRun.set(run, entry);
  }
  if (!baked) return entry.plain;
  if (!entry.baked) {
    entry.baked = new Uint8ClampedArray(entry.plain);
    bakeOliveOilLook(entry.baked);
  }
  return entry.baked;
}

interface MergedProps {
  runs: readonly SauceLayer[];
  doughShape: DoughShape;
  colorOf: (ingredientId: string) => string;
  /** the group mixes oil with other sauces: its oil runs get the oil colour look baked into their pixels */
  bakedOil?: boolean;
  className?: string;
}

export function SauceMergedHeatmapCanvas({ runs, doughShape, colorOf, bakedOil = false, className }: MergedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // the stack built so far: when the group only grew at its end (a newer run aged into it) just the new runs are stacked -- but never across
  // a change of `bakedOil` (an oil-only group that became mixed): its oil runs were stacked as plain pixels and must be rebuilt
  const stacked = useRef<{ runs: readonly SauceLayer[]; shape: DoughShape; bakedOil: boolean; pixels: Uint8ClampedArray } | null>(null);
  const [failed, markFailed] = useCanvasFailure();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (runs.length > 0 && platformSupports2d()) markFailed();
      return;
    }
    try {
      const previous = stacked.current;
      const grewAtEnd =
        previous !== null && previous.shape === doughShape && previous.bakedOil === bakedOil && previous.runs.length <= runs.length && previous.runs.every((run, i) => run === runs[i]);
      const from = grewAtEnd ? previous.runs.length : 0;
      let pixels: Uint8ClampedArray;
      if (grewAtEnd && from === runs.length) pixels = previous.pixels;
      else {
        pixels = grewAtEnd ? new Uint8ClampedArray(previous.pixels) : new Uint8ClampedArray(SAUCE_DISPLAY_GRID * SAUCE_DISPLAY_GRID * 4);
        for (let i = from; i < runs.length; i += 1) {
          const run = runs[i];
          compositeOver(pixels, runRaster(run, doughShape, colorOf(run.ingredientId), bakedOil && run.ingredientId === "olive-oil"));
        }
      }
      stacked.current = { runs: [...runs], shape: doughShape, bakedOil, pixels };

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const staging = getStagingSurface();
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
    // `runs` is a new array on every render of the parent; the group only really changes in its length or its last run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.length, runs[runs.length - 1], doughShape, bakedOil]);

  if (failed) {
    return <SauceDotsFallback runs={runs.map((run) => ({ deposits: run.deposits, color: bakedOil && run.ingredientId === "olive-oil" ? bakeOilHex(colorOf(run.ingredientId)) : colorOf(run.ingredientId) }))} className={className} />;
  }
  return <canvas ref={canvasRef} className={className} width={MERGED_CANVAS_PX} height={MERGED_CANVAS_PX} aria-hidden="true" />;
}

/**
 * The overflow markers of a flattened group: every run's dots, in order, in the run's own colour, on one canvas. In a group that mixes oil with
 * other sauce the canvas is a plain one (no oil CSS filter), so the oil dots are drawn in the oil-look colour -- the same transform the group's
 * heatmap bakes into the oil pixels -- instead of the raw pale swatch, which would lose its contrast.
 */
export function SauceMergedOverflowCanvas({ runs, doughShape, colorOf, bakedOil = false, className }: MergedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, markFailed] = useCanvasFailure();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (platformSupports2d() && runs.some((run) => run.deposits.some((d) => insideDoughShapeFraction(doughShape, d.x, d.y) < 1))) markFailed();
      return;
    }
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const run of runs) {
        for (const deposit of run.deposits) {
          const overflowFraction = 1 - insideDoughShapeFraction(doughShape, deposit.x, deposit.y);
          if (overflowFraction <= 0) continue;
          ctx.save();
          ctx.globalAlpha = 0.55 * overflowFraction;
          ctx.fillStyle = bakedOil && run.ingredientId === "olive-oil" ? bakeOilHex(colorOf(run.ingredientId)) : colorOf(run.ingredientId);
          ctx.beginPath();
          ctx.arc((deposit.x / 100) * canvas.width, (deposit.y / 100) * canvas.height, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    } catch {
      markFailed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.length, runs[runs.length - 1], doughShape, bakedOil]);

  if (failed) {
    // The heatmap weights deposits by their inside-dough fraction, so sauce spent outside the dough is visible ONLY as these markers:
    // keep them as dots (off-dough deposits only) instead of dropping them when just this canvas fails (Codex P2 on PR #494).
    const outsideRuns = runs
      .map((run) => ({
        deposits: run.deposits.filter((d) => insideDoughShapeFraction(doughShape, d.x, d.y) < 1),
        color: bakedOil && run.ingredientId === "olive-oil" ? bakeOilHex(colorOf(run.ingredientId)) : colorOf(run.ingredientId),
      }))
      .filter((run) => run.deposits.length > 0);
    return <SauceDotsFallback runs={outsideRuns} className={className} />;
  }
  return <canvas ref={canvasRef} className={className} width={MERGED_CANVAS_PX} height={MERGED_CANVAS_PX} aria-hidden="true" />;
}
