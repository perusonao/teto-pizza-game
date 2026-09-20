/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §1.2/§4/§5/§11): pure data
 * shapes for the CUT step's geometry/evaluation foundation. No DOM, no React, no reducer, no
 * timing -- mirrors ../sauceField.ts's own "no DOM, no React, no timing" discipline verbatim.
 *
 * Reuses the existing dough coordinate system unchanged (../pizzaCoordinates.ts's `DoughPoint`/
 * `DOUGH_CENTER`/`DOUGH_RADIUS`/`distanceFromCenter`) -- CUT does not invent a second,
 * conflicting coordinate space. A `CutLine` lives in the exact same 0-100 dough-percent box
 * every other gesture family (DOUGH stretch, sauce dispense, topping drag) already uses.
 */
import { DOUGH_RADIUS, distanceFromCenter, type DoughPoint } from "../pizzaCoordinates";

/**
 * One committed cut: a straight segment in dough-percent coordinates. Per the design doc's own
 * gesture design (§2.2), every line that Phase 2's real gesture layer ever commits is, by
 * construction, a full rim-to-rim chord (`clampToDough` clamps the release point onto the rim
 * along the drag's own direction) -- but this type itself does not enforce that; it is pure
 * data. `isEdgeToEdgeCutLine` below is the explicit, checkable contract Phase 2's UI layer (or a
 * test fixture) uses to confirm a given line actually satisfies it before handing it to the
 * geometry/evaluation functions in ./geometry.ts / ./evaluation.ts, which accept *any* two
 * points and simply produce a well-defined -- if degenerate -- result either way (§4.1).
 */
export interface CutLine {
  readonly start: DoughPoint;
  readonly end: DoughPoint;
}

/** Phase 1 ships only 6 (design doc §3.2); 4/8 are represented in the type and fully supported
 *  by the geometry/evaluation engine (§4.2/§5 are general in `requestedSliceCount`) so a later
 *  phase can add them as pure data on a recipe's `CutConfig`, with zero engine changes. Never
 *  hard-code the literal `6` inside geometry/evaluation logic -- always read it from here. */
export type RequestedSliceCount = 4 | 6 | 8;

/** Phase 1's own official shipping target (design doc §3.2). */
export const DEFAULT_REQUESTED_SLICE_COUNT: RequestedSliceCount = 6;

/**
 * Mirrors the design doc's own `CookingProfile.cutConfig?: CutConfig` shape (§1.2) structurally,
 * but is intentionally *not* wired into `../../data/cookingProfiles.ts` in Phase 1 -- that wiring
 * (and any real recipe activation) is explicitly CUT Phase 2/4 scope (§18), not this one. Absent
 * `requestedSliceCount` resolves to `DEFAULT_REQUESTED_SLICE_COUNT`, never an undefined slice
 * count (`resolveRequestedSliceCount` below is the single place this resolution happens).
 */
export interface CutConfig {
  readonly requestedSliceCount?: RequestedSliceCount;
}

export const DEFAULT_CUT_CONFIG: CutConfig = { requestedSliceCount: DEFAULT_REQUESTED_SLICE_COUNT };

/** The one place `CutConfig`'s "absent means default" contract is resolved -- every caller reads
 *  a slice count through this function, never `config?.requestedSliceCount ?? 6` inline. */
export function resolveRequestedSliceCount(config: CutConfig | undefined): RequestedSliceCount {
  return config?.requestedSliceCount ?? DEFAULT_REQUESTED_SLICE_COUNT;
}

/**
 * The four independent evaluation signals (design doc §5) plus the standalone, never-summed-
 * into-`state.score.total` preview score (§6/§14 Option D). Computed once, by `evaluateCut`
 * (./evaluation.ts), from `lines`/`requestedSliceCount` alone -- mirrors `computeScoringV2`'s own
 * "one call site, computed from the exact canonical data that was just committed" contract.
 */
export interface CutEvaluation {
  readonly requestedSliceCount: number;
  readonly completedCutCount: number;
  readonly actualPieceCount: number;
  readonly pieceAreas: readonly number[];
  readonly countCorrectness: number; // 0-1
  readonly completeness: number; // 0-1
  readonly centerAccuracy: number; // 0-1
  readonly uniformity: number; // 0-1
  readonly cutScore: number; // 0-100, standalone preview only -- see ./evaluation.ts header
}

/**
 * Tolerance used to check whether a point lands on the dough's rim (within floating-point
 * rounding of `DOUGH_RADIUS`). Kept as a single named constant -- matching this repo's own
 * `CLAMP_INSET_EPSILON` precedent (../pizzaCoordinates.ts) -- rather than a magic number at each
 * call site. Generous enough to absorb `Math.cos`/`Math.sin`-derived rounding error (~1e-13 at
 * this radius) while still meaningfully rejecting a point nowhere near the rim.
 */
export const RIM_TOLERANCE_DOUGH_PERCENT = 1e-6;

/** Is this point within `toleranceEpsilon` of the dough's rim? */
export function isNearRim(
  point: DoughPoint,
  toleranceEpsilon: number = RIM_TOLERANCE_DOUGH_PERCENT,
): boolean {
  return Math.abs(distanceFromCenter(point.x, point.y) - DOUGH_RADIUS) <= toleranceEpsilon;
}

/**
 * The edge-to-edge gesture contract (design doc §2.2/"Edge-to-edge semantics"): a valid
 * committed `CutLine` has both endpoints on the rim. This is the check Phase 2's real UI layer
 * (pointer start -> drag -> pointer end -> `clampToDough`-clamped release) is responsible for
 * satisfying before ever dispatching a line into state; a synthetic test fixture uses the same
 * check to confirm it built a realistic fixture. The geometry/evaluation engine itself never
 * calls this -- it accepts any two points and produces a well-defined result regardless
 * (§4.1's "no malformed-single-line special case" design), so this function is a contract
 * boundary, not an internal guard.
 */
export function isEdgeToEdgeCutLine(
  line: CutLine,
  toleranceEpsilon: number = RIM_TOLERANCE_DOUGH_PERCENT,
): boolean {
  return isNearRim(line.start, toleranceEpsilon) && isNearRim(line.end, toleranceEpsilon);
}
