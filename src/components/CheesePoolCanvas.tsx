import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { renderCheesePoolCached, type CheesePoolGrid, type CheesePoolImage } from "../logic/cheesePool";

/** one offscreen bitmap per memoised image: every canvas that shows the same pool (a cut pizza repeats each topping once per piece) just copies it */
const bitmaps = new WeakMap<CheesePoolImage, HTMLCanvasElement>();

function bitmapOf(image: CheesePoolImage): HTMLCanvasElement | null {
  const known = bitmaps.get(image);
  if (known) return known;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const data = ctx.createImageData(image.width, image.height);
  data.data.set(image.data);
  ctx.putImageData(data, 0, 0);
  bitmaps.set(image, canvas);
  return canvas;
}

/** drop the offscreen bitmap of an image, so the next draw rebuilds it from the pixel data (the old one may have lost its backing store) */
function forgetBitmap(image: CheesePoolImage): void {
  bitmaps.delete(image);
}

/**
 * #486 G1: whether any pixel of the canvas is visible. A cheese is always at least a few opaque pixels, so an all-transparent read-back means the browser dropped
 * the canvas contents (iOS memory pressure): drawing then "succeeds" without throwing, and the piece would be an invisible cheese. A read that throws is a
 * failure too (the caller shows M1).
 */
export function hasVisiblePixels(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
}

let canvas2dUsable: boolean | null = null;

/** whether this browser gives a 2D drawing context at all (probed once; an old WebView or a locked-down environment may return null) */
export function canvas2dAvailable(): boolean {
  if (canvas2dUsable !== null) return canvas2dUsable;
  try {
    canvas2dUsable = document.createElement("canvas").getContext("2d") !== null;
  } catch {
    canvas2dUsable = false;
  }
  return canvas2dUsable;
}

/** test hook: forget the probe result */
export function resetCanvas2dProbe(): void {
  canvas2dUsable = null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** #421: how much wider than the raw lump's box a fully melted pool is shown (the spread). 1 up to melt 0.3, so the pre-bake look is unchanged. */
export const CHEESE_POOL_MELT_SPREAD = 0.45;

/** CSS scale of the canvas box at `melt`: the melted pool spreads over the dough beyond the box the lump sat in (centre-anchored, no layout change) */
export function cheesePoolSpreadScale(melt: number): number {
  const t = Math.min(1, Math.max(0, (melt - 0.3) / 0.7));
  return 1 + CHEESE_POOL_MELT_SPREAD * t * t * (3 - 2 * t);
}

/** the smallest dough interior the game draws (CSS px; the compact RESULT dough is 196 across, less its border), used until the real size is measured, and as the floor of a measured one: a too-small reference only makes the reach larger, and a spare copy is clipped to its piece */
const MIN_INNER_DOUGH_PX = 160;
/** the dough's border (CSS px, `--dough-border-width`): the percent coordinates span the padding box inside it */
const DOUGH_BORDER_PX = 10;

/**
 * #421 / Codex P2: the half-width of a fully melted pool in dough-percent (the unit of `placeTopping`'s reach): the canvas box half, spread to its melted
 * scale, over the dough's own size. A cut that crosses the pool anywhere inside this must give the neighbouring piece its copy, or the part past the cut
 * vanishes when the slices separate. `doughPx` is the rendered dough width (the canvas is a fixed pixel size, so the same pool is a larger share of a
 * smaller dough, e.g. the compact RESULT layout); unmeasured (0) it falls back to the smallest dough. Rounded up.
 */
export function cheesePoolReachPercent(sizePx: number, doughPx = 0): number {
  const inner = Math.max(MIN_INNER_DOUGH_PX, doughPx - DOUGH_BORDER_PX * 2);
  return Math.ceil(((sizePx / 2) * (1 + CHEESE_POOL_MELT_SPREAD) * 100) / inner);
}

export interface CheesePoolCanvasProps {
  /** a stable id of the placed piece (its topping id), so a cut pizza's copies and every later frame show the same pool */
  seed: string;
  melt: number;
  toast: number;
  char: number;
  grid: CheesePoolGrid;
  /** CSS px per side */
  sizePx: number;
  className?: string;
  /** shown instead of the canvas when the browser gives no 2D context, or drawing this canvas fails (the pool would otherwise be an invisible piece): the caller's M1 piece */
  fallback?: ReactNode;
}

/**
 * #421 S2-B (verification only): the Canvas mozzarella, drawn by the pure `renderCheesePoolCached` (../logic/cheesePool.ts). It replaces the
 * `.pizza-cheese` span of one mozzarella piece when the preview switch asks for it (../preview/cheeseRenderMode.ts). No game state is read or written.
 */
export function CheesePoolCanvas({ seed, melt, toast, char, grid, sizePx, className, fallback }: CheesePoolCanvasProps) {
  const usable = canvas2dAvailable();
  // a drawing failure of THIS canvas (no context although the probe passed, the bitmap could not be built, or anything threw): sticky for the instance, so the
  // M1 fallback replaces the canvas once and nothing tries to draw again (the canvas is unmounted, so the effect below finds no element)
  const [drawFailed, setDrawFailed] = useState(false);
  const hasFallback = fallback !== undefined; // a boolean, not the element itself: a new element every render must not redraw the canvas
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fail = () => {
      if (hasFallback) setDrawFailed(true);
    };
    /** one draw attempt; true only when the visible canvas really holds pixels afterwards (#486 G1: a purged canvas draws nothing without throwing) */
    const draw = (): boolean => {
      // willReadFrequently: this canvas is read back after every draw (hasVisiblePixels), so keep it CPU-backed instead of forcing a GPU readback each time
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no 2d context");
      const image = renderCheesePoolCached(seed, melt, toast, char, { grid, reducedMotion: prefersReducedMotion() });
      const bitmap = bitmapOf(image);
      if (!bitmap) throw new Error("no bitmap");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);
      return hasVisiblePixels(ctx, canvas.width, canvas.height);
    };
    /** draw, verify, and on a blank result rebuild the offscreen bitmap once and retry; anything still blank (or any throw) becomes the M1 piece */
    const drawVerified = () => {
      try {
        if (draw()) return;
        forgetBitmap(renderCheesePoolCached(seed, melt, toast, char, { grid, reducedMotion: prefersReducedMotion() }));
        if (!draw()) fail();
      } catch {
        fail();
      }
    };
    drawVerified();
    // iOS may discard canvas memory while the page is hidden: look again when it comes back (a blank canvas is redrawn, then verified like any draw)
    const onReturn = () => {
      if (!canvas.isConnected) return; // already replaced by the M1 piece: nothing to look at or redraw
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const ctx = canvas.getContext("2d");
        if (ctx && hasVisiblePixels(ctx, canvas.width, canvas.height)) return;
      } catch {
        // fall through to a verified redraw
      }
      drawVerified();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [seed, melt, toast, char, grid, hasFallback]);
  if ((!usable || drawFailed) && hasFallback) return <>{fallback}</>;
  return (
    <canvas
      ref={ref}
      className={["pizza-cheese-canvas", className].filter(Boolean).join(" ")}
      width={grid}
      height={grid}
      aria-hidden="true"
      style={{ "--cheese-canvas-size": `${sizePx}px`, ...(melt > 0.3 ? { transform: `scale(${cheesePoolSpreadScale(melt).toFixed(3)})` } : null) } as CSSProperties}
    />
  );
}
