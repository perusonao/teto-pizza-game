import { useCallback, useState } from "react";
import { SAUCE_DISPLAY_GRID } from "../logic/sauceDisplay";
import { canvas2dAvailable } from "./CheesePoolCanvas";

/** One shared 64x64 staging surface: creating a canvas and an ImageData on every redraw cost more than the
 *  rasterizing itself (measured, Issue #475 Slice 1), and a redraw is synchronous, so instances can share it. */
let stagingSurface: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData } | null = null;
export function getStagingSurface() {
  if (stagingSurface) return stagingSurface;
  const canvas = document.createElement("canvas");
  canvas.width = SAUCE_DISPLAY_GRID;
  canvas.height = SAUCE_DISPLAY_GRID;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  stagingSurface = { canvas, ctx, image: ctx.createImageData(SAUCE_DISPLAY_GRID, SAUCE_DISPLAY_GRID) };
  return stagingSurface;
}

/** test hook: forget the shared staging surface */
export function resetStagingSurface(): void {
  stagingSurface = null;
}

/** Whether a sauce canvas failed (no 2D context after a working probe, or a draw that threw), and the call that records it (sticky). */
export function useCanvasFailure(): [boolean, () => void] {
  const [failed, setFailed] = useState(false);
  const markFailed = useCallback(() => setFailed(true), []);
  return [failed, markFailed];
}

// Probe 2D support ONCE, when this module is first loaded (app start), long before any sauce canvas exists. `canvas2dAvailable` caches its
// first answer, so a later refusal -- the browser running out of canvas memory after it had given contexts to the sauce canvases -- cannot
// be mistaken for "no 2D support at all": probing lazily, after the exhaustion, would get the probe canvas refused too and cache `false`.
if (typeof document !== "undefined") canvas2dAvailable();

/**
 * Whether this platform is known to support 2D canvas (the answer from the startup probe). A sauce canvas that is refused a context while
 * this is true is a runtime failure (`SauceDotsFallback`); while it is false (no 2D at all, e.g. a test DOM) nothing is drawn, as it always was.
 */
export function platformSupports2d(): boolean {
  return canvas2dAvailable();
}
