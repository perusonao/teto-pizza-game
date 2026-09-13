export interface PlacedTopping {
  id: string;
  ingredientId: string;
  x: number;
  y: number;
}

export interface PizzaState {
  sauceIds: string[];
  toppings: PlacedTopping[];
  bakeResult: number | null;
}

export function createEmptyPizza(): PizzaState {
  return { sauceIds: [], toppings: [], bakeResult: null };
}

/** Minimum distance (in the same 0-100% unit as x/y) between two toppings. */
export const MIN_TOPPING_DISTANCE = 9;

/** Pizza dough is a circle of radius ~48% centered at (50, 50); see PizzaStage's tap clamp. */
const DOUGH_CENTER = 50;
const DOUGH_RADIUS = 48;

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
