/**
 * DRIZZLE (Issue #579), D1: the post-bake liquid's type, its first material and its limits (pure; UNWIRED -- nothing outside `logic/drizzle/` imports it).
 *
 * The data model below is the DRAFT of the #579 Decision Brief (option C, a separate `postBakeLiquids` collection, NOT `sauceIds` and NOT a `stage: "post"`
 * topping). It is NOT approved as the persisted shape: the save / journal compatibility, atomic stock debit and scoring / identity gates are D2-D4 and on HOLD.
 * D1 only fixes what a liquid IS and how big it may get; it reads and writes nothing (no state, journal, stock, score, identification, Dex, Pitz or save).
 *
 * Coordinates are the production dough space of `../pizzaCoordinates.ts` (percent of the dough box; centre 50, radius 48). The gesture lab (#746) draws on its
 * own 100x100 surface with a dough radius of 44; its sizes are converted here by `labToDough` (the ratio 48 / 44) and the converted values are pinned by test.
 * All numbers are PROVISIONAL until the iPhone HV of the lab and the later integration slices.
 */
import { DOUGH_RADIUS } from "../pizzaCoordinates";

/** The first material (Owner 2026-11-06): the existing `olive-oil`. No new ingredient, recipe or ladder step. */
export const POST_BAKE_LIQUID_INGREDIENT_IDS = ["olive-oil"] as const;
export type PostBakeLiquidIngredientId = (typeof POST_BAKE_LIQUID_INGREDIENT_IDS)[number];

export function isPostBakeLiquidIngredient(id: unknown): id is PostBakeLiquidIngredientId {
  return typeof id === "string" && (POST_BAKE_LIQUID_INGREDIENT_IDS as readonly string[]).includes(id);
}

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
}

/** The phase tag. A liquid is always a post-bake record; the literal keeps it apart from pre-bake sauce deposits. */
export const POST_BAKE_LIQUID_STAGE = "post" as const;

export interface PostBakeLiquid {
  readonly id: string;
  readonly ingredientId: PostBakeLiquidIngredientId;
  /** One continuous stroke: at least two distinct points, every point inside the dough, coordinates in `QUANT_STEP` steps. */
  readonly trail: readonly TrailPoint[];
  readonly stage: typeof POST_BAKE_LIQUID_STAGE;
}

// -- limits ------------------------------------------------------------------------------------------------------------------------

/** The lab's (#746) dough radius on its own 100x100 surface. Only used to convert the lab's sizes. */
export const LAB_DOUGH_RADIUS = 44;
/** Converts a length measured on the lab surface into production dough percent (rounded to one decimal = `QUANT_STEP`). */
export function labToDough(labLength: number): number {
  return Math.round(((labLength * DOUGH_RADIUS) / LAB_DOUGH_RADIUS) * 10) / 10;
}

/** Coordinates are kept in steps of this many dough-percent (keeps the JSON short). */
export const QUANT_STEP = 0.1;

/** DISPLAY limits: the transient stroke while a finger is down (never saved). Same counts as the lab (#746). */
export const DISPLAY_MAX_POINTS_PER_STROKE = 160;
export const DISPLAY_MAX_STROKES = 24;
/** Points closer than this to the previous kept point are dropped (the lab's 1.4, converted). */
export const MIN_POINT_DISTANCE = labToDough(1.4);
/** A stroke whose total travel stays under this is a tap (the lab's 3, converted). */
export const TAP_TRAVEL = labToDough(3);
/** The deterministic tap line: a short slanted segment of this length (the lab's 16, converted). Never a dot. */
export const TAP_LINE_LENGTH = labToDough(16);
/** The tap line's angle, as in the lab (-30 degrees, rising to the right). */
export const TAP_LINE_ANGLE = -Math.PI / 6;

/** PERSIST limits (Owner 2026-11-06, PROVISIONAL): what one liquid keeps and how many a round may hold. The pending-round journal is capped at 64KB. */
export const PERSIST_MAX_POINTS_PER_STROKE = 24;
export const PERSIST_MAX_LIQUIDS = 4;

/** Defence limits for untrusted input (never reached by a legitimate stroke): longer input is refused outright instead of scanned. */
export const MAX_RAW_TRAIL_POINTS = 1000;
export const MAX_RAW_LIQUIDS = 64;
/** A coordinate beyond this magnitude is not a pointer position; the point is dropped. */
export const COORD_ABS_MAX = 1000;
/** Ids are short hyphenated ASCII tokens. */
export const LIQUID_ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
