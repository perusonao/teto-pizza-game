import { useCallback, useState } from "react";
import { SAUCE_DISPLAY_GRID } from "../logic/sauceDisplay";

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

/** Whether a sauce canvas failed (no 2D context after a working probe, or a draw that threw), and the call that records it (sticky). */
export function useCanvasFailure(): [boolean, () => void] {
  const [failed, setFailed] = useState(false);
  const markFailed = useCallback(() => setFailed(true), []);
  return [failed, markFailed];
}
