/**
 * Codex P1 blocker fix (PR #31 narrow review): boundary normalization for every public
 * Scoring 2.0 entry point that consumes a pizza/reference *collection* -- sauce deposits,
 * placed toppings, reference piece groups, reference positions.
 *
 * Real gameplay can never actually produce a malformed `PizzaState`/`ReferencePizza` --
 * `PizzaState` is only ever constructed through gameReducer.ts's own validated actions, and
 * `ReferencePizza` is static authored config (../../data/referencePizza.ts). But every
 * function in this module is independently exported/public, and the Scoring 2.0 contract
 * ("fail-closed, never throw, never NaN/Infinity") must hold even when called directly with
 * data that violates its own TypeScript types at runtime -- a thrown error inside
 * `computeScoringV2Shadow` would propagate out of gameReducer.ts's CONFIRM_BAKE case and crash
 * the whole round, not just the Shadow number (see scoringV2.test.ts's "malformed input"
 * describe block for the exact adversarial cases this defends against).
 *
 * Every helper below treats its argument as `unknown` and normalizes rather than trusts:
 * a non-array container becomes `[]`, a malformed/non-object element is dropped (never
 * "coerced" into some substitute value that could read as real data), and every coordinate is
 * required to be a finite number (NaN/+Infinity/-Infinity are all rejected, matching
 * ./tolerance.ts's own fail-closed contract for scalars).
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A non-array container (null, undefined, an object, a string, ...) normalizes to `[]`
 *  rather than throwing on the first `.map`/`.filter`/`for...of` a caller does with it. */
export function toSafeArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export interface SafeCoordinate {
  x: number;
  y: number;
}

/** True only for a non-null object with finite numeric `x`/`y` -- rejects `null`, `undefined`,
 *  every primitive (a string/number/boolean array element), and an object with a missing or
 *  wrong-typed/non-finite `x` or `y`. */
export function isFiniteCoordinate(value: unknown): value is SafeCoordinate {
  return isPlainObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

/** Sanitizes an arbitrary value into a clean array of finite `{x, y}` points -- reference
 *  positions (../../data/referencePizza.ts's `ReferencePieceGroup.positions`) go through this
 *  before ever reaching the Hungarian matcher (../referenceMatching.ts's `matchReferencePositions`),
 *  which can fail to terminate on a NaN/Infinity cost (see ./piecesComponent.ts's own comment
 *  on that finding). */
export function sanitizeCoordinates(value: unknown): SafeCoordinate[] {
  return toSafeArray(value)
    .filter(isFiniteCoordinate)
    .map((p) => ({ x: p.x, y: p.y }));
}

export interface SafeSauceDeposit extends SafeCoordinate {
  amount: number;
}

/** Sanitizes an arbitrary value into a clean array of finite `{x, y, amount}` deposits.
 *  Malformed elements (null, a primitive, missing/non-finite x/y/amount) are dropped, not
 *  substituted -- a dropped deposit contributes nothing, which is the correct fail-closed
 *  reading of "this wasn't a real deposit" rather than inventing one. */
export function sanitizeSauceDeposits(value: unknown): SafeSauceDeposit[] {
  const result: SafeSauceDeposit[] = [];
  for (const raw of toSafeArray(value)) {
    if (!isPlainObject(raw)) continue;
    const { x, y, amount } = raw;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(amount)) continue;
    result.push({ x, y, amount });
  }
  return result;
}

export interface SafeTopping extends SafeCoordinate {
  ingredientId: string;
}

/** Sanitizes an arbitrary value into a clean array of finite, string-`ingredientId` toppings.
 *  A malformed element (null, a primitive, a missing/non-string `ingredientId`, a non-finite
 *  x/y) is dropped entirely -- exactly ./piecesComponent.ts's pre-existing "treat as not
 *  really placed" reasoning for a non-finite coordinate, now applied to every other way a
 *  topping-shaped value can be malformed too. */
export function sanitizeToppings(value: unknown): SafeTopping[] {
  const result: SafeTopping[] = [];
  for (const raw of toSafeArray(value)) {
    if (!isPlainObject(raw)) continue;
    const { x, y, ingredientId } = raw;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || typeof ingredientId !== "string") continue;
    result.push({ x, y, ingredientId });
  }
  return result;
}

/** Sanitizes an arbitrary value into a clean array of non-null-object elements, for
 *  collections (e.g. `ReferencePizza.pieceGroups`) whose *elements* are validated by their own
 *  dedicated sanitizer downstream (./piecesComponent.ts's `scorePieceGroupV2` already treats a
 *  malformed single group defensively) -- this only normalizes the *container*. */
export function sanitizeObjectArray(value: unknown): Record<string, unknown>[] {
  return toSafeArray(value).filter(isPlainObject);
}

/** Sanitizes an arbitrary value into a clean array of strings, for id-list containers
 *  (`PizzaState.sauceIds`). */
export function sanitizeStringArray(value: unknown): string[] {
  return toSafeArray(value).filter((v): v is string => typeof v === "string");
}
