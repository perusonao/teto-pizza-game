import { useCallback, useEffect, useRef, useState } from "react";
import { bakeOilHex, overlapAlphaFactorFor, SAUCE_DISPLAY_GRID, SAUCE_OVERLAP_ALPHA_FACTOR } from "../logic/sauceDisplay";
import type { SauceDepositLike } from "../logic/sauceField";
import type { SauceLayer } from "../state/sauceLayers";
import { canvas2dAvailable } from "./CheesePoolCanvas";

/**
 * A 64x64 staging surface: the sauce pixels are written here with `putImageData` and then scaled onto the visible 200x200 canvas with `drawImage`.
 *
 * ONE PER CANVAS INSTANCE (never shared). It used to be a single module-level surface that every sauce canvas reused one after the other, on the
 * grounds that a redraw is synchronous. That holds only if `drawImage` reads its source canvas at the call. A GPU-accelerated canvas may read the source
 * LATER (iPhone Safari is the suspect for the "tomato disappears under the oil" report, #524 Owner HV: the two layer canvases that mount in the same
 * commit ended up with the SAME pixels): the second layer's `putImageData` then overwrites what the first layer has not read yet. A surface of its own
 * is only ever written for its own canvas, so a late read still sees that canvas's pixels. Cost: 2 x 16 KB per heatmap canvas (the 200x200 canvas itself is 160 KB).
 */
export interface StagingSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: ImageData;
}

/** A new staging surface, or null when the browser refuses a 2D context for it (canvas memory exhausted). */
export function createStagingSurface(): StagingSurface | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAUCE_DISPLAY_GRID;
  canvas.height = SAUCE_DISPLAY_GRID;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx, image: ctx.createImageData(SAUCE_DISPLAY_GRID, SAUCE_DISPLAY_GRID) };
}

/** Give the surface's backing store back to the browser now (iOS Safari keeps a detached canvas's memory until it is collected): a 0x0 canvas holds none. */
export function releaseStagingSurface(surface: StagingSurface | null): void {
  if (!surface) return;
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

/**
 * The staging surface of one canvas component: created on first use, released when the component unmounts (and re-created on demand, so a StrictMode
 * mount / unmount / mount cycle is fine). Returns the getter to call inside the draw effect.
 */
export function useStagingSurface(): () => StagingSurface | null {
  const ref = useRef<StagingSurface | null>(null);
  useEffect(
    () => () => {
      releaseStagingSurface(ref.current);
      ref.current = null;
    },
    [],
  );
  return useCallback(() => {
    if (ref.current === null) ref.current = createStagingSurface();
    return ref.current;
  }, []);
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

/** The dot fallback's overlap dimming for an olive-oil run over earlier sauce (Issue #519 / #521 S1): see `FallbackRun.overlap`. */
export interface FallbackOverlap {
  under: readonly SauceDepositLike[];
  factor: number;
}

/** A dot is "over" a deposit below it when they are within about one marker radius (the dot is 16% of the box wide). */
export const OVERLAP_RADIUS_PCT = 8;

/** The overlap dimming of a fallback run: only an olive-oil run that has something under it (the other sauces keep the generic, undimmed dot). */
export function overlapFallbackOf(ingredientId: string | undefined, under: readonly SauceDepositLike[] | undefined): FallbackOverlap | undefined {
  const factor = overlapAlphaFactorFor(ingredientId);
  if (factor === SAUCE_OVERLAP_ALPHA_FACTOR || !under || under.length === 0) return undefined;
  return { under, factor };
}

/**
 * The dot-fallback runs for a layered (two or more sauce kinds) pizza whose layers failed to render (`SauceLayersBoundary`). That fallback is a plain
 * box with no oil CSS filter, so an olive-oil dot would stay the raw pale swatch and vanish over the sauce below: it gets the baked oil colour (the same
 * transform the flattened canvases use) plus the oil overlap dimming. Other sauces keep their own colour. (Codex P2 on PR #524.)
 */
export function layeredFallbackRuns(layers: readonly SauceLayer[], colorOf: (ingredientId: string) => string) {
  return layers.map((layer) => ({
    deposits: layer.deposits,
    color: layer.ingredientId === "olive-oil" ? bakeOilHex(colorOf(layer.ingredientId)) : colorOf(layer.ingredientId),
    overlap: overlapFallbackOf(layer.ingredientId, layer.under),
  }));
}
