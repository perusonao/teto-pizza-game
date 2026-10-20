import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import { createInitialDoughShape, type DoughShape } from "../logic/doughShape";
import type { DoughKind } from "../logic/dough/doughKind";
import type { SquareDough } from "../logic/pan/squareDough";

export interface PlacedTopping {
  id: string;
  ingredientId: string;
  x: number;
  y: number;
  /**
   * Cooking Steps 2.0 FINISH engine (Issue #294): `"post"` = placed in the FINISH step after the bake.
   * Absent (or `"pre"`) = placed before the bake -- every piece the game places today. Not persisted.
   */
  stage?: "pre" | "post";
}

/** True for a piece placed in the FINISH step (after the bake). */
export function isPostBakePiece(piece: Pick<PlacedTopping, "stage">): boolean {
  return piece.stage === "post";
}

export interface SauceOrigin {
  x: number;
  y: number;
}

/** One tick of the shared recipe-sauce dispenser (../logic/sauceDispenseController.ts):
 *  where it landed (dough-percent coordinates, which may fall outside the dough circle --
 *  see ../logic/pizzaCoordinates.ts's `isInsideDough`) and how much normalized quantity it
 *  added (../logic/sauceQuantity.ts). Only ever populated by COMMIT_SAUCE_DISPENSE (never
 *  incrementally -- see that action's own reducer case). */
export interface SauceDeposit {
  x: number;
  y: number;
  amount: number;
  /**
   * Sauce B1: which sauce kind laid this deposit. ABSENT on a single-sauce pizza (the historical shape, kept
   * byte-identical); once a second kind is committed the reducer sets it on EVERY deposit (back-filling the earlier ones
   * with the only sauce used so far), so a log is either all-without or all-with. Not persisted (pizza state is not).
   */
  ingredientId?: string;
}

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/** A single deposit is only ever valid with finite x/y and a strictly positive, finite
 *  amount (Codex Broad Review MUST FIX 2 -- Reducer Scope Guard). NaN/Infinity/zero/negative
 *  amounts are exactly the "stale/late/corrupted action" shapes that guard exists for. */
export function isValidSauceDeposit(deposit: SauceDeposit): boolean {
  return isFiniteNumber(deposit.x) && isFiniteNumber(deposit.y) && isFiniteNumber(deposit.amount) &&
    deposit.amount > 0;
}

/** A commit batch is valid only if it is non-empty and every deposit in it is valid --
 *  partial application of a corrupted payload is never attempted; an invalid batch is
 *  rejected in full (see COMMIT_SAUCE_DISPENSE's reducer case). */
export function isValidSauceDepositBatch(deposits: readonly SauceDeposit[]): boolean {
  return deposits.length > 0 && deposits.every(isValidSauceDeposit);
}

/** The pan the round is cooked in (Square Dough F1, Owner decision 2026-10-18). Absent / `null` is the
 *  ordinary round cook; `"tray"` is the Technique 「天板焼き」 (panShape `square`). Never inferred from
 *  `squareDough`: only an explicit value counts. */
export type PanId = "tray";



export interface PizzaState {
  /** Square Dough F1: optional so every existing pizza (and `createEmptyPizza()`) is unchanged.
   *  Read only by `signatureOfPizza` (the `pan` identity axis); nothing else branches on it yet. */
  pan?: PanId | null;
  /** Dough Kind P1 (Issue #577): the kind of dough, independent of `pan`. Optional so every existing pizza is unchanged; absent /
   *  `"standard"` is the ordinary dough. Read only by `signatureOfPizza` (the `dough` identity axis); never inferred from `pan` or
   *  `squareDough`, never persisted. Nothing sets it in Production yet (the chip is P2). */
  dough?: DoughKind;
  /** Issue #33 D1: canonical, reducer-owned dough boundary (8-point radial array -- see
   *  ../logic/doughShape.ts), committed atomically by COMMIT_DOUGH_STRETCH at a successful
   *  pointerup, mirroring sauceDeposits' own ephemeral-gesture/canonical-commit split. Rides
   *  along on `pizza` through SAUCE/CHEESE/TOPPING/BAKE/RESULT unchanged once DOUGH confirms
   *  (D0 §5/§7) so the player's own hand-stretched shape stays visible instead of silently
   *  reverting to a perfect circle -- no Save schema impact, see createEmptyPizza below. */
  doughShape: DoughShape;
  /** Square-Pan Dough B (Issue #535, Epic #532): the square pan's dough (a thickness grid -- ../logic/pan/squareDough.ts),
   *  committed by COMMIT_SQUARE_DOUGH at a successful pointerup, exactly as `doughShape` is by COMMIT_DOUGH_STRETCH. **Optional and
   *  absent from every round pizza**, so `createEmptyPizza()` and every existing pizza object are unchanged (nothing deep-compared
   *  anywhere sees a new key); absent in a square-pan round means "still the initial small ball". Never persisted (nor is `pizza`). */
  squareDough?: SquareDough;
  sauceIds: string[];
  /** Tap point the sauce spread animation should originate from (Phase 2C "painted" feel). */
  sauceOrigin: SauceOrigin | null;
  /** Bumped every APPLY_SAUCE/first DEPOSIT_SAUCE so the spread animation replays even at
   *  the same spot. */
  sauceToken: number;
  /** Raw authoritative deposit log for the current sauce application. All recipe sauce
   *  profiles render from it; Margherita's Reference prototype additionally derives its
   *  shadow-only metrics from the same values. */
  sauceDeposits: SauceDeposit[];
  toppings: PlacedTopping[];
  bakeResult: number | null;
}

export function createEmptyPizza(): PizzaState {
  return {
    doughShape: createInitialDoughShape(),
    sauceIds: [],
    sauceOrigin: null,
    sauceToken: 0,
    sauceDeposits: [],
    toppings: [],
    bakeResult: null,
  };
}

/** Minimum distance (in the same 0-100% unit as x/y) between two toppings. */
export const MIN_TOPPING_DISTANCE = 9;

export function isTooClose(
  existing: PlacedTopping[],
  x: number,
  y: number,
  minDistance: number = MIN_TOPPING_DISTANCE,
): boolean {
  return existing.some((t) => Math.hypot(t.x - x, t.y - y) < minDistance);
}

export interface OpenSpot {
  x: number;
  y: number;
}

/**
 * Finds a valid spot for a new topping near (x, y). If the requested point is free, it is
 * returned as-is. Otherwise a small spiral search nudges the point to the nearest free spot
 * within the dough. Returns null when no free spot could be found nearby (dough is packed).
 */
export function findOpenSpot(
  existing: PlacedTopping[],
  x: number,
  y: number,
  minDistance: number = MIN_TOPPING_DISTANCE,
): OpenSpot | null {
  if (!isTooClose(existing, x, y, minDistance)) {
    return { x, y };
  }

  const ringCount = 4;
  const stepsPerRing = 8;
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const radius = minDistance * 0.6 * ring;
    for (let step = 0; step < stepsPerRing; step += 1) {
      const angle = (step / stepsPerRing) * Math.PI * 2 + ring;
      const nx = x + Math.cos(angle) * radius;
      const ny = y + Math.sin(angle) * radius;
      if (Math.hypot(nx - DOUGH_CENTER, ny - DOUGH_CENTER) > DOUGH_RADIUS) continue;
      if (nx < 0 || nx > 100 || ny < 0 || ny > 100) continue;
      if (!isTooClose(existing, nx, ny, minDistance)) {
        return { x: nx, y: ny };
      }
    }
  }

  return null;
}

export type PlacementStatus = "placed" | "adjusted" | "rejected";

export interface PlacementFeedback {
  status: PlacementStatus;
  x: number;
  y: number;
  token: number;
}
