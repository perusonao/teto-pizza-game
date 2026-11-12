/**
 * MID_BAKE Lab placement (decision Q6): a DETERMINISTIC automatic placement is the initial method; per-ingredient operations (a sprinkle, a drag
 * to a chosen spot, ...) can replace it later by registering a strategy for that ingredient id. The same ingredient id and the same index always
 * give the same spot (no randomness), so the Lab, its tests and the iPhone HV are reproducible.
 *
 * Coordinates: a 0..100 square, the mock dough is the circle of radius `LAB_DOUGH_RADIUS` around the centre.
 */
export interface LabPoint {
  readonly x: number;
  readonly y: number;
}

export const LAB_DOUGH_CENTER: LabPoint = { x: 50, y: 50 };
export const LAB_DOUGH_RADIUS = 42;

/** Gives the spot of the `index`-th (0-based) piece of one ingredient. Must be pure and total for any non-negative integer index. */
export type PlacementStrategy = (index: number) => LabPoint;

/** Evenly spread spots on a ring (a golden-angle walk), clamped inside the dough. Total, pure and deterministic. */
export const spreadPlacement: PlacementStrategy = (index) => {
  const i = Number.isInteger(index) && index >= 0 ? index : 0;
  const angle = i * 2.399963229728653; // golden angle in radians
  const radius = LAB_DOUGH_RADIUS * 0.62 * Math.sqrt((i % 7) / 7 + 0.35);
  return { x: round(LAB_DOUGH_CENTER.x + radius * Math.cos(angle)), y: round(LAB_DOUGH_CENTER.y + radius * Math.sin(angle)) };
};

/** Fixed spots for the natto Lab: the first two pieces sit apart so both stay visible; later pieces fall back to the spread. */
const NATTO_SPOTS: readonly LabPoint[] = [
  { x: 40, y: 44 },
  { x: 60, y: 57 },
  { x: 48, y: 66 },
];

export const PLACEMENT_STRATEGIES: Readonly<Record<string, PlacementStrategy>> = {
  natto: (index) => NATTO_SPOTS[index] ?? spreadPlacement(index),
};

/** The spot for the `index`-th piece of `ingredientId`: its own strategy when registered, the spread otherwise. */
export function placementFor(ingredientId: string, index: number): LabPoint {
  return (PLACEMENT_STRATEGIES[ingredientId] ?? spreadPlacement)(index);
}

export function isInsideLabDough(point: LabPoint): boolean {
  return Math.hypot(point.x - LAB_DOUGH_CENTER.x, point.y - LAB_DOUGH_CENTER.y) <= LAB_DOUGH_RADIUS;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
