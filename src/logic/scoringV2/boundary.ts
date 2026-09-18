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
 * `computeScoringV2` would propagate out of gameReducer.ts's CONFIRM_BAKE case and crash
 * the whole round, not just the score (see scoringV2.test.ts's "malformed input"
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

/**
 * Codex P1 blocker fix, Round 2 -- STRICT validation for *authoritative* Reference/
 * requirement data, deliberately different from every lenient `sanitize*` helper above.
 *
 * The sanitizers above exist for PLAYER input: a malformed element there genuinely means
 * "the player didn't place a real piece/deposit here", so dropping it and scoring the rest
 * is the correct, tolerant reading. Reference positions and required-ingredient lists are
 * the opposite kind of data -- they *are* the scoring truth (the target a player's pizza is
 * judged against). Silently filtering a malformed element out of a Reference/requirement
 * list doesn't mean "the Reference target has fewer requirements than it really does" -- it
 * means the data feeding the scorer is corrupt, and a smaller, filtered-down target is not a
 * fact about the recipe, it is an artifact of that corruption. Scoring a player's pizza
 * against a corrupted-and-shrunk target can silently award a normal (even 100) score for a
 * pizza that never actually matched the *real* Reference at all.
 *
 * `StrictReferenceValidation` is therefore all-or-nothing: a non-array container, or *any*
 * single malformed element anywhere in the array, invalidates the whole collection --
 * callers (./piecesComponent.ts, ./recipeComponent.ts) turn a `{ valid: false }` result into
 * an explicit `{ available: false, reason }` for the affected component (and ./index.ts
 * propagates that up into the whole `ScoringV2Result` being unavailable), never a numeric
 * score computed from whatever happened to survive filtering. A genuinely well-formed empty
 * array (`[]`) is still `{ valid: true, items: [] }` -- "this recipe legitimately requires
 * nothing here" is a real, valid fact a recipe's data can express, and stays available.
 */
export type StrictReferenceValidation<T> =
  | { valid: true; items: readonly T[] }
  | { valid: false };

/** Strictly validates a Reference position list (e.g. `ReferencePieceGroup.positions`): the
 *  container itself must be a real array, and every element must be a finite `{x, y}`
 *  coordinate -- one malformed position anywhere invalidates the whole list rather than
 *  quietly shrinking the target to whatever positions happened to be well-formed. */
export function validateCoordinateArrayStrict(value: unknown): StrictReferenceValidation<SafeCoordinate> {
  if (!Array.isArray(value)) return { valid: false };
  const items: SafeCoordinate[] = [];
  for (const element of value) {
    if (!isFiniteCoordinate(element)) return { valid: false };
    items.push({ x: element.x, y: element.y });
  }
  return { valid: true, items };
}

export interface StrictRequiredIngredient {
  ingredientId: string;
  minCount: number;
}

/** Strictly validates a recipe's required-ingredient list (`Recipe.requiredIngredients`):
 *  the container must be a real array, and every element must be a well-formed
 *  `{ingredientId: string, minCount: finite number}` -- one malformed requirement
 *  invalidates the whole list, the same all-or-nothing rule as `validateCoordinateArrayStrict`
 *  and for the same reason (a filtered-down requirement list is not a fact about the recipe). */
export function validateRequiredIngredientsStrict(
  value: unknown,
): StrictReferenceValidation<StrictRequiredIngredient> {
  if (!Array.isArray(value)) return { valid: false };
  const items: StrictRequiredIngredient[] = [];
  for (const element of value) {
    if (!isPlainObject(element)) return { valid: false };
    if (typeof element.ingredientId !== "string") return { valid: false };
    if (!isFiniteNumber(element.minCount)) return { valid: false };
    items.push({ ingredientId: element.ingredientId, minCount: element.minCount });
  }
  return { valid: true, items };
}

/** B1 (Bake component): `Recipe.bakeTarget` is authoritative per-recipe data (it defines what
 *  "correctly baked" even means), same category as `requiredIngredients` above, so it gets the
 *  same strict, non-collection validation -- a malformed target (missing/non-finite `start`/
 *  `end`, or an inverted/zero-width `end <= start` zone) fails the Bake component closed rather
 *  than silently computing a distance against a nonsensical zone. */
export function isValidBakeTarget(value: unknown): value is { start: number; end: number } {
  return (
    isPlainObject(value) &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.end) &&
    value.end > value.start
  );
}

/** Shared reason string for every "authoritative Reference/requirement data was malformed"
 *  unavailable result -- ./piecesComponent.ts and ./recipeComponent.ts both use this exact
 *  message. Distinct from ./index.ts's own `REFERENCE_UNAVAILABLE_REASON` ("no Reference
 *  fixture exists for this recipe at all", P0-1) -- this one means "a Reference fixture
 *  exists, but its own data failed strict validation" -- though both are handled identically
 *  by ./index.ts (the whole `ScoringV2Result` fails closed either way). */
export const MALFORMED_REFERENCE_REASON =
  "このレシピの Reference/必須材料データが不正なため、Scoring 2.0 はこの結果を採点できません（フェイルクローズ）。";
