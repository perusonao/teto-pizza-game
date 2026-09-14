import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";

export interface PlacedTopping {
  id: string;
  ingredientId: string;
  x: number;
  y: number;
}

export interface SauceOrigin {
  x: number;
  y: number;
}

/** One tick of the Phase 4A-1A tomato-sauce dispenser (../logic/sauceDispenseController.ts):
 *  where it landed (dough-percent coordinates, which may fall outside the dough circle --
 *  see ../logic/pizzaCoordinates.ts's `isInsideDough`) and how much normalized quantity it
 *  added (../logic/sauceQuantity.ts). Only ever populated by DEPOSIT_SAUCE; APPLY_SAUCE
 *  (every other ingredient, every other recipe, Mission play) never touches this array. */
export interface SauceDeposit {
  x: number;
  y: number;
  amount: number;
}

export interface PizzaState {
  sauceIds: string[];
  /** Tap point the sauce spread animation should originate from (Phase 2C "painted" feel). */
  sauceOrigin: SauceOrigin | null;
  /** Bumped every APPLY_SAUCE/first DEPOSIT_SAUCE so the spread animation replays even at
   *  the same spot. */
  sauceToken: number;
  /** Phase 4A-1A: raw deposit log for the current sauce application, used only to derive
   *  Prototype Metrics (../logic/sauceField.ts) for the Margherita Reference prototype.
   *  Always empty for every other recipe/ingredient path (APPLY_SAUCE never appends here). */
  sauceDeposits: SauceDeposit[];
  toppings: PlacedTopping[];
  bakeResult: number | null;
}

export function createEmptyPizza(): PizzaState {
  return {
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
