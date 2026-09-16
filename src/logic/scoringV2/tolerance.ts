/**
 * Phase 4A-2 P1-1 (Tolerance-band validation): every Scoring 2.0 helper that takes a
 * full-credit/zero-credit tolerance band goes through `safeToleranceSimilarity` below instead
 * of calling ../referenceMatching.ts's `distanceSimilarity` directly, so an invalid band
 * (zero <= full, a negative radius, a non-finite value) can never propagate NaN/Infinity into
 * a Shadow score -- it fails closed to 0 (finite, deterministic, "no credit") instead.
 *
 * Reuses `distanceSimilarity`'s own reviewed smoothstep-interpolation shape (Phase 4A-1B) --
 * this file only adds the validation `distanceSimilarity` itself doesn't do, it does not
 * reimplement the curve.
 */
import { distanceSimilarity } from "../referenceMatching";

/** A tolerance band is valid only if both ends are finite, the full-credit radius is
 *  non-negative, and the zero-credit radius is strictly greater than it -- `zero <= full`
 *  (the P1-1 contract's explicit example) would make every distance either full or zero
 *  credit with no continuous region, or divide-by-zero inside `distanceSimilarity`'s own
 *  smoothstep interpolation. */
export function isValidToleranceBand(full: number, zero: number): boolean {
  return Number.isFinite(full) && Number.isFinite(zero) && full >= 0 && zero > full;
}

/**
 * `distance` -> similarity, 0-1, 1 at or below `full`, 0 at or above `zero`, continuous in
 * between -- but fails closed (returns 0, never NaN/Infinity) for a non-finite `distance` or
 * an invalid tolerance band, rather than trusting the caller's inputs. Every Scoring 2.0
 * component that compares a measured value against a tolerance band calls this, never
 * `distanceSimilarity` directly.
 */
export function safeToleranceSimilarity(distance: number, full: number, zero: number): number {
  if (!Number.isFinite(distance) || !isValidToleranceBand(full, zero)) return 0;
  const similarity = distanceSimilarity(distance, full, zero);
  return Number.isFinite(similarity) ? Math.min(1, Math.max(0, similarity)) : 0;
}

/** Clamps to [0, 1] and guards against a non-finite input (e.g. a divide-by-zero upstream) --
 *  the same fail-closed guarantee as `safeToleranceSimilarity`, for values that are already a
 *  0-1 similarity/ratio rather than a raw distance. */
export function safeUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
