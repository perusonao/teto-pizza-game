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
 * #486 T1: the PRODUCTION opt-in (plan B, docs/reports/TETO_CANVAS-MOZZARELLA_PRODUCTION-GATE_486.md). While this is `false` (the committed value) a production
 * build carries no Canvas path at all (the bundle gate in ./cheeseCanvas.bundle.gate.test.ts pins that). Turning it on is a separate, Owner-approved change;
 * even then the default stays M1 and only a device that carries the opt-in key below shows the Canvas.
 */
export const CHEESE_CANVAS_PRODUCTION_ENABLED = false;

/** the opt-in key: its own localStorage entry, apart from the save (a Full Game Reset clears the save only). "c64" / "c96" = Canvas, anything else (or nothing) = M1; "0" is the kill switch. */
export const CHEESE_CANVAS_OPT_IN_KEY = "teto-pizza-cheese-canvas";

interface ReadableStorage {
  getItem(key: string): string | null;
}

/** The stored opt-in as a mode. A failing or missing storage reads as M1 (the safe side). */
export function resolveCheeseOptIn(storage: ReadableStorage | null): CheeseRenderMode {
  try {
    const v = storage?.getItem(CHEESE_CANVAS_OPT_IN_KEY);
    if (v === "c64") return { kind: "canvas", grid: CHEESE_POOL_GRID_SMALL, sizePx: CHEESE_CANVAS_DEFAULT_PX };
    if (v === "c96") return { kind: "canvas", grid: CHEESE_POOL_GRID, sizePx: CHEESE_CANVAS_DEFAULT_PX };
  } catch {
    // storage blocked: M1
  }
  return CHEESE_RENDER_M1;
}

function readStorage(): ReadableStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read once per page load. Preview / DEV: the query switch (`?cheese=`), else the stored opt-in. Production: the stored opt-in, only when
 * `CHEESE_CANVAS_PRODUCTION_ENABLED`; otherwise M1. The env check is a static `import.meta.env` expression and the constant is a literal, so a production
 * build folds both to `false` and drops this parsing and (through PizzaStage's `kind === "canvas"` branch) the Canvas path with it.
 */
export const CHEESE_RENDER_MODE: CheeseRenderMode =
  import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE
    ? (() => {
        const q = resolveCheeseRenderMode(typeof window === "undefined" ? "" : window.location.search, true);
        return q.kind === "canvas" ? q : resolveCheeseOptIn(readStorage());
      })()
    : CHEESE_CANVAS_PRODUCTION_ENABLED
      ? resolveCheeseOptIn(readStorage())
      : CHEESE_RENDER_M1;
