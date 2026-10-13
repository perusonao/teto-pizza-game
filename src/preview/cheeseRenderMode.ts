import { CHEESE_POOL_GRID, CHEESE_POOL_GRID_SMALL, type CheesePoolGrid } from "../logic/cheesePool";

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
export const CHEESE_CANVAS_DEFAULT_PX = 76;

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
 * Read once per page load. The env check is a static `import.meta.env` expression, so a production build folds it to `false` and drops the
 * query parsing and (through PizzaStage's `kind === "canvas"` branch) the Canvas path with it.
 */
export const CHEESE_RENDER_MODE: CheeseRenderMode =
  import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE
    ? resolveCheeseRenderMode(typeof window === "undefined" ? "" : window.location.search, true)
    : CHEESE_RENDER_M1;
