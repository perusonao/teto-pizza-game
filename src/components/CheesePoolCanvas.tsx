import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
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
  /** shown instead of the canvas when the browser gives no 2D context (the pool would otherwise be an invisible piece): the caller's M1 piece */
  fallback?: ReactNode;
}

/**
 * #421 S2-B (verification only): the Canvas mozzarella, drawn by the pure `renderCheesePoolCached` (../logic/cheesePool.ts). It replaces the
 * `.pizza-cheese` span of one mozzarella piece when the preview switch asks for it (../preview/cheeseRenderMode.ts). No game state is read or written.
 */
export function CheesePoolCanvas({ seed, melt, toast, char, grid, sizePx, className, fallback }: CheesePoolCanvasProps) {
  const usable = canvas2dAvailable();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = renderCheesePoolCached(seed, melt, toast, char, { grid, reducedMotion: prefersReducedMotion() });
    const bitmap = bitmapOf(image);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bitmap) ctx.drawImage(bitmap, 0, 0);
  }, [seed, melt, toast, char, grid]);
  if (!usable && fallback !== undefined) return <>{fallback}</>;
  return (
    <canvas
      ref={ref}
      className={["pizza-cheese-canvas", className].filter(Boolean).join(" ")}
      width={grid}
      height={grid}
      aria-hidden="true"
      style={{ "--cheese-canvas-size": `${sizePx}px` } as CSSProperties}
    />
  );
}
