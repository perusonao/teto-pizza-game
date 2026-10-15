import { CHEESE_POOL_GRID, CHEESE_POOL_GRID_SMALL, type CheesePoolGrid } from "../logic/cheesePool";
import type { StorageLike } from "../state/persistence";

/**
 * #421 S2-B: the verification-only switch for the Canvas mozzarella. PREVIEW / DEV ONLY: the caller passes `allowed`
 * (`import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE`, replaced statically, so a production build never reads the query).
 *
 *   ?cheese=m1      the existing CSS mozzarella (the default, and the only mode in production)
 *   ?cheese=c64     the Canvas mozzarella, 64x64 bitmap
 *   ?cheese=c96     the Canvas mozzarella, 96x96 bitmap
 *   &cheesePx=<n>   optional: the Canvas element's CSS size in px (default 62; 36..96)
 */
export type CheeseRenderMode = { kind: "m1" } | { kind: "canvas"; grid: CheesePoolGrid; sizePx: number };

/** CSS px of the Canvas element (S2-B2: 54 -> 62): the raw lump is ~0.4 of it (about 25 px across, M1's 28x23 piece is ~25 px area-equivalent), and the finished pool
 *  ~0.66 of it (about 41 px): the melt spreads it over about 2.6x the raw area, the natural growth the S1 design keeps. */
export const CHEESE_CANVAS_DEFAULT_PX = 70;

export const CHEESE_RENDER_M1: CheeseRenderMode = { kind: "m1" };

export function resolveCheeseRenderMode(search: string, allowed: boolean): CheeseRenderMode {
  if (!allowed) return CHEESE_RENDER_M1;
  const params = new URLSearchParams(search);
  const mode = params.get("cheese");
  if (mode !== "c64" && mode !== "c96") return CHEESE_RENDER_M1;
  const px = Number(params.get("cheesePx"));
  const sizePx = Number.isFinite(px) && px >= 36 && px <= 96 ? Math.round(px) : CHEESE_CANVAS_DEFAULT_PX;
  return { kind: "canvas", grid: mode === "c64" ? CHEESE_POOL_GRID_SMALL : CHEESE_POOL_GRID, sizePx };
}

/**
 * #486: the Canvas mozzarella is the STANDARD display in production (T1 shipped it behind an opt-in that was OFF; this makes it ON by default). The M1 CSS
 * mozzarella stays as the way back, in three layers:
 *  - per page / per device: `?cheeseCanvas=0` shows M1 and remembers it ("0" in the key below, so it survives a reload); `?cheeseCanvas=1` turns Canvas on again;
 *  - per piece: a browser with no 2D context, a bitmap that cannot be built, a throwing draw, or a canvas read back all-transparent shows that piece as M1
 *    (CheesePoolCanvas.tsx), so nothing ever shows a transparent cheese;
 *  - for everyone: set `CHEESE_CANVAS_DEFAULT_ON` to false (a one-line change) and anyone without an explicit "1" is back on M1.
 * The choice lives in its own localStorage key, apart from the save (nothing in the save, scoring, economy or progression reads it), so a Full Game Reset does
 * not touch it, and a failing storage just means the default.
 */
export const CHEESE_CANVAS_DEFAULT_ON = true;

export const CHEESE_CANVAS_OPT_IN_KEY = "teto-pizza-cheese-canvas";

/** `?cheeseCanvas=1` -> "on", `?cheeseCanvas=0` -> "off", anything else -> null (leave the stored choice) */
export function parseCheeseCanvasParam(search: string): "on" | "off" | null {
  const value = new URLSearchParams(search).get("cheeseCanvas");
  return value === "1" ? "on" : value === "0" ? "off" : null;
}

/**
 * Whether the Canvas mozzarella is on for this page load. The parameter is remembered ("1" / "0"); an absent or unknown stored value follows `defaultOn`;
 * a storage that throws follows the parameter if there is one, else `defaultOn` (the Canvas path has its own per-piece fallback, so a broken storage never needs M1).
 */
export function resolveCheeseCanvasOptIn(search: string, storage: StorageLike | null, defaultOn: boolean = CHEESE_CANVAS_DEFAULT_ON): boolean {
  const param = parseCheeseCanvasParam(search);
  try {
    if (param === "on") {
      storage?.setItem(CHEESE_CANVAS_OPT_IN_KEY, "1");
      return true;
    }
    if (param === "off") {
      storage?.setItem(CHEESE_CANVAS_OPT_IN_KEY, "0");
      return false;
    }
    const stored = storage?.getItem(CHEESE_CANVAS_OPT_IN_KEY);
    return stored === "1" ? true : stored === "0" ? false : defaultOn;
  } catch {
    return param === null ? defaultOn : param === "on";
  }
}

/** the production decision alone: Canvas 64x64 at the default size when on (the default), M1 when switched off */
export function resolveCheeseOptInMode(search: string, storage: StorageLike | null): CheeseRenderMode {
  return resolveCheeseCanvasOptIn(search, storage) ? { kind: "canvas", grid: CHEESE_POOL_GRID_SMALL, sizePx: CHEESE_CANVAS_DEFAULT_PX } : CHEESE_RENDER_M1;
}

/**
 * The render mode of a DEV / Preview page load: the S2-B `?cheese=` comparison switch keeps working and wins (an explicit `?cheese=m1` is M1 even when opted
 * in); without it the opt-in decides. Production never calls this (it is behind a static env check below), so `cheesePx` etc. are not in a production bundle.
 */
export function resolveCheeseRenderModeWithOptIn(search: string, previewSwitch: boolean, storage: StorageLike | null): CheeseRenderMode {
  if (previewSwitch && new URLSearchParams(search).get("cheese") !== null) return resolveCheeseRenderMode(search, true);
  return resolveCheeseOptInMode(search, storage);
}

function pageStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" || !window.localStorage ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read once per page load. The env check is a static `import.meta.env` expression, so a production build folds it to `false` and drops the `?cheese=` switch
 * with it; the `?cheeseCanvas=` switch (default ON, `=0` for M1) exists in every build.
 */
export const CHEESE_RENDER_MODE: CheeseRenderMode =
  import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE
    ? resolveCheeseRenderModeWithOptIn(typeof window === "undefined" ? "" : window.location.search, true, pageStorage())
    : resolveCheeseOptInMode(typeof window === "undefined" ? "" : window.location.search, pageStorage());
